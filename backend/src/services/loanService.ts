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
  finePaid?: number
  paymentType: PaymentType
  paymentMethod: PaymentMethod
  paymentDate: string
  note?: string
  newDueDate?: string       // for rollover
  createdBy?: number
  explicitPrincipal?: number  // single+partial: admin-specified principal portion
  explicitInterest?: number   // single+partial: admin-specified interest portion
  newInterestAmount?: number  // single+partial: new interest for restructured remaining loan
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
        term_days: durationDays,
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
    const { loanId, installmentId, amount, finePaid = 0, paymentType, paymentMethod, paymentDate, note, newDueDate, createdBy, explicitPrincipal, explicitInterest, newInterestAmount } = input

    if (finePaid > amount) throw new AppError(400, 'ค่าปรับต้องไม่เกินยอดรับทั้งหมด')

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

      // loanAmount = portion of payment going toward principal/interest (excluding fine)
      const loanAmount = amount - finePaid

      if (paymentType === 'rollover') {
        // Full loan amount is interest — no cap because rollover can charge a different rate
        interestPaid = loanAmount
        cashTxnType = 'interest_in'
      } else if (paymentType === 'full') {
        // Pay everything remaining
        interestPaid = remainingInterest
        principalPaid = remainingPrincipal
        overPayment = Math.max(0, loanAmount - remainingInterest - remainingPrincipal)
        newLoanStatus = 'completed'
        cashTxnType = 'principal_in'
      } else if (paymentType === 'partial' && loan.loan_type === 'single' && explicitPrincipal !== undefined) {
        // single+partial with admin-specified split — use exact amounts provided
        principalPaid = Math.min(explicitPrincipal, remainingPrincipal)
        interestPaid = Math.min(explicitInterest ?? 0, remainingInterest)
        overPayment = Math.max(0, loanAmount - principalPaid - interestPaid)
        cashTxnType = principalPaid > 0 ? 'principal_in' : 'interest_in'
      } else if (installmentId) {
        // installment payment — use pre-calculated portions from the installment record
        const inst = await trx('loan_installments').where({ id: installmentId }).first()
        interestPaid = Math.min(Number(inst?.interest_portion ?? 0), remainingInterest)
        principalPaid = Math.min(Number(inst?.principal_portion ?? 0), remainingPrincipal)
        overPayment = Math.max(0, loanAmount - interestPaid - principalPaid)
        cashTxnType = principalPaid > 0 ? 'principal_in' : 'interest_in'
      } else {
        // normal / partial (no installment ref) — allocate interest first, then principal
        interestPaid = Math.min(loanAmount, remainingInterest)
        principalPaid = Math.min(loanAmount - interestPaid, remainingPrincipal)
        overPayment = Math.max(0, loanAmount - interestPaid - principalPaid)
        cashTxnType = principalPaid > 0 ? 'principal_in' : 'interest_in'
      }

      // Insert payment — amount = total cash received (loan + fine)
      const [payment] = await trx('payments').insert({
        payment_number: paymentNumber,
        loan_id: loanId,
        installment_id: installmentId ?? null,
        loan_type: loan.loan_type,
        amount,
        principal_paid: principalPaid,
        interest_paid: interestPaid,
        fine_paid: finePaid,
        over_payment: overPayment,
        payment_date: paymentDate,
        payment_type: paymentType,
        payment_method: paymentMethod,
        note,
        created_by: createdBy,
      }).returning('*')

      // For single loans: use incremental update to preserve rollover resets (paid_interest = 0 after each rollover).
      // Self-healing SUM would count all historical rollover interest, inflating paid_interest beyond total interest.
      // For other loan types: self-healing is safe since they don't use rollover resets.
      let newPaidPrincipal: number
      let newPaidInterest: number
      if (loan.loan_type === 'single') {
        newPaidPrincipal = Number(loan.paid_principal) + principalPaid
        newPaidInterest = Number(loan.paid_interest) + interestPaid
      } else {
        const paidTotals = await trx('payments')
          .where({ loan_id: loanId })
          .select(
            trx.raw('COALESCE(SUM(principal_paid), 0) AS paid_principal'),
            trx.raw('COALESCE(SUM(interest_paid), 0) AS paid_interest'),
          )
          .first()
        newPaidPrincipal = Number(paidTotals?.paid_principal ?? 0)
        newPaidInterest = Number(paidTotals?.paid_interest ?? 0)
      }

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
      // installment/daily: check paid_installments counter AND verify no unpaid installment records remain
      // (belt-and-suspenders: pre-paid installments don't create payment records so counter may differ)
      // single/flexible: complete when paid principal+interest covers all remaining amounts
      let allPaid: boolean
      if (isInstallmentBased(loan.loan_type)) {
        const unpaidCount = await trx('loan_installments')
          .where('loan_id', loanId)
          .whereIn('status', ['pending', 'partial'])
          .count('id as cnt')
          .first()
        allPaid = newPaidInstallments >= Number(loan.total_installments)
          || Number((unpaidCount as any)?.cnt ?? 1) === 0
      } else {
        allPaid = newPaidPrincipal >= Number(loan.principal_amount) && newPaidInterest >= totalInterest
      }
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

      // single+partial with newInterestAmount: restructure loan to remaining terms (same as adjustLoanAmounts)
      if (paymentType === 'partial' && loan.loan_type === 'single' && newInterestAmount !== undefined) {
        const newRemainingPrincipal = remainingPrincipal - principalPaid
        if (newRemainingPrincipal > 0) {
          const newTotalAmount = newRemainingPrincipal + newInterestAmount
          await trx('loans').where({ id: loanId }).update({
            principal_amount: newRemainingPrincipal,
            total_amount: newTotalAmount,
            interest_rate: newInterestAmount / newRemainingPrincipal,
            paid_principal: 0,
            paid_interest: 0,
            updated_at: new Date(),
          })
        }
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

      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'RECEIVE_PAYMENT',
        entity_type: 'loan',
        entity_id: loanId,
        new_data: JSON.stringify({
          amount, principalPaid, interestPaid, paymentType, paymentMethod,
          paymentNumber, installmentId: installmentId ?? null,
        }),
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

  async adjustLoanAmounts(loanId: number, principalAmount: number, totalAmount: number, createdBy?: number) {
    if (totalAmount < principalAmount) throw new AppError(400, 'ยอดรวมต้องมากกว่าหรือเท่ากับเงินต้น')

    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (loan.loan_type !== 'single') throw new AppError(400, 'ใช้ได้เฉพาะสัญญาแบบครั้งเดียวเท่านั้น')
    if (['completed', 'bad_debt', 'written_off'].includes(loan.status)) {
      throw new AppError(400, 'ไม่สามารถแก้ไขสัญญาที่ปิดแล้วได้')
    }
    const interestRate = (totalAmount - principalAmount) / principalAmount

    await db.transaction(async (trx) => {
      // Reset paid amounts to 0 — adjusting loan amounts means restructuring to new remaining terms,
      // so nothing has been paid yet against the new structure (history stays in payments table).
      await trx('loans').where({ id: loanId }).update({
        principal_amount: principalAmount,
        total_amount: totalAmount,
        interest_rate: interestRate,
        paid_principal: 0,
        paid_interest: 0,
        updated_at: new Date(),
      })
      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'ADJUST_LOAN_AMOUNT',
        entity_type: 'loan',
        entity_id: loanId,
        old_data: JSON.stringify({ principal_amount: loan.principal_amount, total_amount: loan.total_amount }),
        new_data: JSON.stringify({ principal_amount: principalAmount, total_amount: totalAmount }),
      })
    })

    return loanRepo.findById(loanId)
  },

  async markComplete(loanId: number, createdBy?: number) {
    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (loan.status === 'completed') throw new AppError(400, 'สัญญานี้ปิดแล้ว')
    if (['bad_debt', 'written_off'].includes(loan.status)) throw new AppError(400, 'ไม่สามารถปิดสัญญานี้ได้')

    let extraUpdate: Record<string, unknown> = {}
    if (isInstallmentBased(loan.loan_type)) {
      const unpaid = await db('loan_installments')
        .where('loan_id', loanId)
        .whereIn('status', ['pending', 'partial'])
        .count('id as cnt')
        .first()
      if (Number((unpaid as any)?.cnt ?? 1) > 0) throw new AppError(400, 'ยังมีงวดที่ยังไม่ได้ชำระ')
      // Sync paid_installments from the actual paid records in case the counter drifted
      const paidCount = await db('loan_installments')
        .where('loan_id', loanId)
        .where('status', 'paid')
        .count('id as cnt')
        .first()
      extraUpdate = { paid_installments: Number((paidCount as any)?.cnt ?? loan.paid_installments) }
    } else {
      const totalInterest = Number(loan.total_amount) - Number(loan.principal_amount)
      const fullyPaid = Number(loan.paid_principal) >= Number(loan.principal_amount)
        && Number(loan.paid_interest) >= totalInterest
      if (!fullyPaid) throw new AppError(400, 'ยอดชำระยังไม่ครบ')
    }

    await db('loans').where({ id: loanId }).update({ status: 'completed', closed_date: todayStr(), updated_at: new Date(), ...extraUpdate })
    await db('audit_logs').insert({
      user_id: createdBy, action: 'MARK_COMPLETE', entity_type: 'loan', entity_id: loanId,
      new_data: JSON.stringify({ status: 'completed' }),
    })
    return loanRepo.findById(loanId)
  },

  async resetBalance(loanId: number, deductFirstInstallment: boolean, note: string | undefined, createdBy?: number) {
    const loan = await loanRepo.findById(loanId)
    if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
    if (loan.loan_type !== 'daily') throw new AppError(400, 'ใช้ได้เฉพาะสินเชื่อรายวันเท่านั้น')
    if (!['active', 'overdue'].includes(loan.status)) throw new AppError(400, 'ไม่สามารถรียอดสัญญาที่ปิดแล้วได้')
    if (Number(loan.paid_installments) < Number(loan.total_installments) / 2) {
      throw new AppError(400, 'ต้องชำระอย่างน้อยครึ่งหนึ่งของจำนวนงวดก่อนจึงจะรียอดได้')
    }

    const installmentAmount = Number(loan.installment_amount)
    const remaining = Math.max(0, Number(loan.total_amount) - installmentAmount * Number(loan.paid_installments))
    let cashBack = Number(loan.principal_amount) - remaining
    if (deductFirstInstallment) cashBack -= installmentAmount
    if (cashBack <= 0) throw new AppError(400, 'ยอดที่ลูกค้าจะได้รับต้องมากกว่า 0')

    await db.transaction(async (trx) => {
      const today = todayStr()
      const totalInstallments = Number(loan.total_installments)
      const newDueDate = addDays(today, totalInstallments - 1)

      // Regenerate the installment schedule from scratch (first time this codebase deletes loan_installments —
      // existing payments keep their row via installment_id ON DELETE SET NULL, so payment history is unaffected)
      await trx('loan_installments').where({ loan_id: loanId }).del()
      const scheduleStart = addDays(today, -1)
      const schedule = buildInstallmentSchedule(scheduleStart, Number(loan.total_amount), totalInstallments, totalInstallments, Number(loan.principal_amount))
      await trx('loan_installments').insert(schedule.map((s) => ({ ...s, loan_id: loanId })))

      let newPaidPrincipal = 0
      let newPaidInterest = 0
      let newPaidInstallments = 0
      if (deductFirstInstallment) {
        const first = schedule[0]
        await trx('loan_installments')
          .where({ loan_id: loanId, installment_no: 1 })
          .update({ status: 'paid', paid_amount: first.amount_due, paid_date: today, updated_at: new Date() })
        newPaidPrincipal = first.principal_portion
        newPaidInterest = first.interest_portion
        newPaidInstallments = 1
      }

      await trx('loans').where({ id: loanId }).update({
        issued_date: today,
        due_date: newDueDate,
        paid_principal: newPaidPrincipal,
        paid_interest: newPaidInterest,
        paid_installments: newPaidInstallments,
        status: 'active',
        closed_date: null,
        updated_at: new Date(),
      })

      const paymentNumber = await generatePaymentNumber()
      const [payment] = await trx('payments').insert({
        payment_number: paymentNumber,
        loan_id: loanId,
        loan_type: 'daily',
        amount: cashBack,
        principal_paid: 0,
        interest_paid: 0,
        over_payment: 0,
        payment_date: today,
        payment_type: 'balance_reset',
        payment_method: 'cash',
        note: note ?? (deductFirstInstallment ? 'รียอด (หักงวดแรก)' : 'รียอด'),
        created_by: createdBy,
      }).returning('*')

      const currentBalance = await getCurrentBalance(trx)
      const txnNumber = await generateTxnNumber()
      await trx('cash_transactions').insert({
        txn_number: txnNumber,
        txn_type: 'loan_out',
        direction: 'out',
        amount: cashBack,
        balance_after: currentBalance - cashBack,
        loan_id: loanId,
        payment_id: payment.id,
        description: `รียอด ${loan.loan_number}`,
        txn_date: today,
        created_by: createdBy,
      })

      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'RESET_BALANCE',
        entity_type: 'loan',
        entity_id: loanId,
        old_data: JSON.stringify({ issued_date: loan.issued_date, due_date: loan.due_date, paid_principal: loan.paid_principal, paid_interest: loan.paid_interest, paid_installments: loan.paid_installments }),
        new_data: JSON.stringify({ issued_date: today, due_date: newDueDate, paid_principal: newPaidPrincipal, paid_interest: newPaidInterest, paid_installments: newPaidInstallments, cash_back: cashBack, deduct_first_installment: deductFirstInstallment }),
      })
    })

    // Re-read after commit so the reset loan_type/installments are visible (same pattern as convertToFlexible)
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

      await trx('audit_logs').insert({
        user_id: createdBy,
        action: 'MARK_BAD_DEBT',
        entity_type: 'loan',
        entity_id: loanId,
        old_data: JSON.stringify({ status: loan.status }),
        new_data: JSON.stringify({ status: 'bad_debt', reason }),
      })

      return badDebt
    })
  },
}

async function getCurrentBalance(trx: any): Promise<number> {
  const row = await trx('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
  return Number(row?.balance_after ?? 0)
}
