import db from '../db/connection'
import { loanRepo } from '../repositories/loanRepository'
import { AppError } from '../middleware/errorHandler'
import {
  generatePaymentNumber, generateTxnNumber,
  buildInstallmentSchedule, todayStr, addDays, isInstallmentBased,
  generateLoanNumber,
} from '../utils/helpers'
import type { LoanType, PaymentType, PaymentMethod } from '../types'

interface CreateLoanInput {
  customerId: number
  principalAmount: number
  totalAmount: number
  loanType: LoanType
  totalInstallments: number
  issuedDate: string
  dueDate: string
  note?: string
  createdBy?: number
  paidInstallmentsCount?: number
}

interface ReceivePaymentInput {
  loanId: number
  installmentId?: number
  amount: number
  paymentType: PaymentType
  paymentMethod: PaymentMethod
  paymentDate: string
  note?: string
  newDueDate?: string  // for rollover
  createdBy?: number
}

export const loanService = {
  async createLoan(input: CreateLoanInput) {
    const { customerId, principalAmount, totalAmount, loanType, totalInstallments, issuedDate, dueDate, note, createdBy, paidInstallmentsCount = 0 } = input

    if (totalAmount < principalAmount) throw new AppError(400, 'ยอดรวมต้องมากกว่าหรือเท่ากับเงินต้น')

    const loanNumber = await generateLoanNumber()
    const interestRate = (totalAmount - principalAmount) / principalAmount
    const installmentAmount = isInstallmentBased(loanType) ? Math.ceil(totalAmount / totalInstallments) : undefined
    const durationDays = Math.ceil((new Date(dueDate).getTime() - new Date(issuedDate).getTime()) / 86400000)

    return db.transaction(async (trx) => {
      // Create loan
      const [loan] = await trx('loans').insert({
        loan_number: loanNumber,
        customer_id: customerId,
        principal_amount: principalAmount,
        total_amount: totalAmount,
        interest_rate: interestRate,
        loan_type: loanType,
        total_installments: totalInstallments,
        installment_amount: installmentAmount,
        issued_date: issuedDate,
        due_date: dueDate,
        status: 'active',
        note,
        created_by: createdBy,
      }).returning('*')

      // Create installments
      if (isInstallmentBased(loanType)) {
        // daily: first installment = issuedDate (day 0), so shift start back 1 day
        const effectiveDuration = loanType === 'daily' ? totalInstallments : durationDays
        const scheduleStart = loanType === 'daily' ? addDays(issuedDate, -1) : issuedDate
        const schedule = buildInstallmentSchedule(scheduleStart, totalAmount, totalInstallments, effectiveDuration, principalAmount)
        await trx('loan_installments').insert(schedule.map((s) => ({ ...s, loan_id: loan.id })))

        // Mark pre-paid installments for historical data import
        if (paidInstallmentsCount > 0) {
          const n = Math.min(paidInstallmentsCount, totalInstallments)
          const prePayRows = schedule.slice(0, n)

          await trx('loan_installments')
            .where('loan_id', loan.id)
            .whereIn('installment_no', prePayRows.map((s) => s.installment_no))
            .update({ paid_amount: trx.raw('amount_due'), paid_date: issuedDate, status: 'paid', updated_at: new Date() })

          const prePaidPrincipal = prePayRows.reduce((s, r) => s + r.principal_portion, 0)
          const prePaidInterest  = prePayRows.reduce((s, r) => s + r.interest_portion, 0)

          await trx('loans').where({ id: loan.id }).update({
            paid_principal: prePaidPrincipal,
            paid_interest: prePaidInterest,
            paid_installments: n,
            updated_at: new Date(),
          })

          Object.assign(loan, { paid_principal: prePaidPrincipal, paid_interest: prePaidInterest, paid_installments: n })
        }
      }

      // Cash out transaction
      const currentBalance = await getCurrentBalance(trx)
      const txnNumber = await generateTxnNumber()
      await trx('cash_transactions').insert({
        txn_number: txnNumber,
        txn_type: 'loan_out',
        direction: 'out',
        amount: principalAmount,
        balance_after: currentBalance - principalAmount,
        loan_id: loan.id,
        description: `ปล่อยกู้ ${loanNumber}`,
        txn_date: issuedDate,
        created_by: createdBy,
      })

      // Audit log
      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'CREATE_LOAN',
        entity_type: 'loan',
        entity_id: loan.id,
        new_data: JSON.stringify(loan),
      })

      const installments = await trx('loan_installments').where({ loan_id: loan.id }).orderBy('installment_no')
      return { ...loan, installments }
    })
  },

  async receivePayment(input: ReceivePaymentInput) {
    const { loanId, installmentId, amount, paymentType, paymentMethod, paymentDate, note, newDueDate, createdBy } = input

    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (loan.status === 'completed') throw new AppError(400, 'สัญญานี้ปิดแล้ว')
    if (loan.status === 'bad_debt') throw new AppError(400, 'สัญญานี้เป็นหนี้เสีย')

    return db.transaction(async (trx) => {
      const paymentNumber = await generatePaymentNumber()
      const currentBalance = await getCurrentBalance(trx)

      let principalPaid = 0
      let interestPaid = 0
      let overPayment = 0
      let newLoanStatus = loan.status
      let cashTxnType: string = 'interest_in'

      const totalInterest = Number(loan.total_amount) - Number(loan.principal_amount)
      const remainingInterest = totalInterest - Number(loan.paid_interest)
      const remainingPrincipal = Number(loan.principal_amount) - Number(loan.paid_principal)

      if (paymentType === 'rollover') {
        // Full amount is interest — no cap against remainingInterest because a rollover
        // can charge a different rate than the original contract
        interestPaid = amount
        cashTxnType = 'interest_in'
      } else if (paymentType === 'full') {
        // Pay everything remaining
        interestPaid = remainingInterest
        principalPaid = remainingPrincipal
        overPayment = Math.max(0, amount - remainingInterest - remainingPrincipal)
        newLoanStatus = 'completed'
        cashTxnType = 'principal_in'
      } else if (installmentId) {
        // installment payment — use pre-calculated portions from the installment record
        const inst = await trx('loan_installments').where({ id: installmentId }).first()
        interestPaid = Math.min(Number(inst?.interest_portion ?? 0), remainingInterest)
        principalPaid = Math.min(Number(inst?.principal_portion ?? 0), remainingPrincipal)
        overPayment = Math.max(0, amount - interestPaid - principalPaid)
        cashTxnType = principalPaid > 0 ? 'principal_in' : 'interest_in'
      } else {
        // normal / partial (no installment ref) — allocate interest first, then principal
        interestPaid = Math.min(amount, remainingInterest)
        principalPaid = Math.min(amount - interestPaid, remainingPrincipal)
        overPayment = Math.max(0, amount - interestPaid - principalPaid)
        cashTxnType = principalPaid > 0 ? 'principal_in' : 'interest_in'
      }

      // Insert payment
      const [payment] = await trx('payments').insert({
        payment_number: paymentNumber,
        loan_id: loanId,
        installment_id: installmentId ?? null,
        loan_type: loan.loan_type,
        amount,
        principal_paid: principalPaid,
        interest_paid: interestPaid,
        over_payment: overPayment,
        payment_date: paymentDate,
        payment_type: paymentType,
        payment_method: paymentMethod,
        note,
        created_by: createdBy,
      }).returning('*')

      // Recalculate paid totals from DB (self-healing — avoids drift from manual edits)
      const paidTotals = await trx('payments')
        .where({ loan_id: loanId })
        .select(
          trx.raw('COALESCE(SUM(principal_paid), 0) AS paid_principal'),
          trx.raw('COALESCE(SUM(interest_paid), 0) AS paid_interest'),
        )
        .first()
      const newPaidPrincipal = Number(paidTotals?.paid_principal ?? 0)
      const newPaidInterest = Number(paidTotals?.paid_interest ?? 0)

      // Check if all installments paid
      let newPaidInstallments = loan.paid_installments
      if (installmentId) {
        await trx('loan_installments').where({ id: installmentId }).update({
          paid_amount: amount,
          paid_date: paymentDate,
          status: amount >= (await trx('loan_installments').where({ id: installmentId }).first().then((r) => r.amount_due)) ? 'paid' : 'partial',
          updated_at: new Date(),
        })
        newPaidInstallments += 1
      }

      // Determine if loan is complete
      const allPaid = newPaidPrincipal >= Number(loan.principal_amount) && newPaidInterest >= totalInterest
      let finalStatus = allPaid ? 'completed' : newLoanStatus

      // Revert overdue → active for installment/daily loans if no more overdue installments remain
      if (!allPaid && isInstallmentBased(loan.loan_type) && loan.status === 'overdue') {
        const today = todayStr()
        const overdueResult = await trx('loan_installments')
          .where('loan_id', loanId)
          .where('due_date', '<', today)
          .whereIn('status', ['pending', 'partial'])
          .count('id as cnt')
          .first()
        if (Number((overdueResult as any)?.cnt ?? 0) === 0) {
          finalStatus = 'active'
        }
      }

      if (paymentType === 'rollover') {
        // Rollover: extend due date, reset paid_interest for new period, keep same loan active
        if (!newDueDate) throw new AppError(400, 'กรุณาระบุวันครบกำหนดใหม่สำหรับการต่อดอก')
        await trx('loans').where({ id: loanId }).update({
          due_date: newDueDate,
          paid_interest: 0,
          status: 'active',
          updated_at: new Date(),
        })
      } else {
        await trx('loans').where({ id: loanId }).update({
          paid_principal: newPaidPrincipal,
          paid_interest: newPaidInterest,
          paid_installments: newPaidInstallments,
          status: finalStatus,
          closed_date: finalStatus === 'completed' ? paymentDate : null,
          updated_at: new Date(),
        })
      }

      // Cash in transaction — record full amount received (over_payment tracked in payment record)
      const txnNumber = await generateTxnNumber()
      await trx('cash_transactions').insert({
        txn_number: txnNumber,
        txn_type: cashTxnType,
        direction: 'in',
        amount,
        balance_after: currentBalance + amount,
        loan_id: loanId,
        payment_id: payment.id,
        description: `รับชำระ ${paymentNumber}${paymentType === 'rollover' ? ' (ต่อดอก)' : ''}`,
        txn_date: paymentDate,
        created_by: createdBy,
      })

      return { payment }
    })
  },

  async updateDueDate(loanId: number, newDueDate: string, createdBy?: number) {
    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (['completed', 'bad_debt', 'written_off'].includes(loan.status)) {
      throw new AppError(400, 'ไม่สามารถแก้ไขสัญญาที่ปิดแล้วได้')
    }

    const oldDueDate = String(loan.due_date).split('T')[0]

    await db.transaction(async (trx) => {
      await trx('loans').where({ id: loanId }).update({
        due_date: newDueDate,
        status: loan.status === 'overdue' ? 'active' : loan.status,
        updated_at: new Date(),
      })

      // For installment/daily loans: shift all pending/overdue installments by same delta
      if (isInstallmentBased(loan.loan_type)) {
        const oldMs = new Date(oldDueDate).getTime()
        const newMs = new Date(newDueDate).getTime()
        const daysDiff = Math.round((newMs - oldMs) / 86400000)

        if (daysDiff !== 0) {
          await trx('loan_installments')
            .where('loan_id', loanId)
            .whereIn('status', ['pending', 'partial', 'overdue'])
            .update({
              due_date: trx.raw(`due_date + INTERVAL '${daysDiff} days'`),
              status: trx.raw(`CASE WHEN status = 'overdue' THEN 'pending' ELSE status END`),
              updated_at: new Date(),
            })
        }
      }

      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'UPDATE_DUE_DATE',
        entity_type: 'loan',
        entity_id: loanId,
        old_data: JSON.stringify({ due_date: oldDueDate }),
        new_data: JSON.stringify({ due_date: newDueDate }),
      })
    })

    return loanRepo.findById(loanId)
  },

  async convertToFlexible(loanId: number, createdBy?: number) {
    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (loan.loan_type !== 'single') throw new AppError(400, 'ใช้ได้เฉพาะสัญญาแบบครั้งเดียวเท่านั้น')
    if (!['active', 'overdue'].includes(loan.status)) throw new AppError(400, 'ไม่สามารถแปลงสัญญาที่ปิดแล้วได้')

    await db.transaction(async (trx) => {
      await trx('loans').where({ id: loanId }).update({
        loan_type: 'flexible',
        total_installments: 0,
        installment_amount: null,
        status: 'active',
        updated_at: new Date(),
      })

      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'CONVERT_TO_FLEXIBLE',
        entity_type: 'loan',
        entity_id: loanId,
        new_data: JSON.stringify({ from: 'single', to: 'flexible' }),
      })
    })

    // Read AFTER transaction commits so the updated loan_type is visible
    return loanRepo.findById(loanId)
  },

  async markAsBadDebt(loanId: number, reason: string, createdBy?: number) {
    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (loan.status === 'bad_debt') throw new AppError(400, 'สัญญานี้เป็นหนี้เสียแล้ว')

    return db.transaction(async (trx) => {
      await trx('loans').where({ id: loanId }).update({ status: 'bad_debt', updated_at: new Date() })
      const principalLost = Number(loan.principal_amount) - Number(loan.paid_principal)
      const interestLost = (Number(loan.total_amount) - Number(loan.principal_amount)) - Number(loan.paid_interest)

      const [badDebt] = await trx('bad_debts').insert({
        loan_id: loanId,
        customer_id: loan.customer_id,
        principal_lost: principalLost,
        interest_lost: Math.max(0, interestLost),
        marked_date: todayStr(),
        reason,
        created_by: createdBy,
      }).returning('*')

      return badDebt
    })
  },
}

async function getCurrentBalance(trx: any): Promise<number> {
  const row = await trx('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
  return Number(row?.balance_after ?? 0)
}
