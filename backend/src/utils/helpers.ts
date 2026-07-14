import crypto from 'crypto'
import db from '../db/connection'
import type { LoanType } from '../types'

// ─── Loan Type Helpers ────────────────────────────────────────────────────────

/** Types that use loan_installments records (installment schedule). */
export const INSTALLMENT_BASED_TYPES: LoanType[] = ['installment', 'daily']

/** Returns true if the loan type creates and tracks per-installment records. */
export const isInstallmentBased = (loanType: LoanType): boolean =>
  INSTALLMENT_BASED_TYPES.includes(loanType)

// ─── Sequential Code Generators ───────────────────────────────────────────────

export const generateLoanNumber = async (): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `LN-${today}-`
  const last = await db('loans')
    .where('loan_number', 'like', `${prefix}%`)
    .orderBy('loan_number', 'desc')
    .first()
  const seq = last
    ? String(Number(last.loan_number.split('-').pop()) + 1).padStart(3, '0')
    : '001'
  return `${prefix}${seq}`
}

export const generatePaymentNumber = async (): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `PAY-${today}-`
  const last = await db('payments')
    .where('payment_number', 'like', `${prefix}%`)
    .orderBy('payment_number', 'desc')
    .first()
  const seq = last
    ? String(Number(last.payment_number.split('-').pop()) + 1).padStart(3, '0')
    : '001'
  return `${prefix}${seq}`
}

export const generateTxnNumber = async (): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `CTX-${today}-`
  const last = await db('cash_transactions')
    .where('txn_number', 'like', `${prefix}%`)
    .orderBy('txn_number', 'desc')
    .first()
  const seq = last
    ? String(Number(last.txn_number.split('-').pop()) + 1).padStart(3, '0')
    : '001'
  return `${prefix}${seq}`
}

export const generateCustomerCode = async (): Promise<string> => {
  const last = await db('customers').orderBy('id', 'desc').first()
  const seq = last ? String(last.id + 1).padStart(4, '0') : '0001'
  return `CUS-${seq}`
}

/** 192-bit random token for the customer self-service portal link — opaque and
 *  unguessable, never derived from the customer's numeric id. */
export const generatePortalToken = (): string => crypto.randomBytes(24).toString('hex')

// ─── Date Utilities ────────────────────────────────────────────────────────────

/** Add/subtract days from a YYYY-MM-DD string. Uses UTC arithmetic to avoid
 *  timezone-local-day-boundary issues (safe regardless of server timezone). */
export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Today's date as YYYY-MM-DD in UTC (safe for comparison with DB TIMESTAMPTZ
 *  values after to_char conversion, and consistent with addDays). */
export const todayStr = (): string => new Date().toISOString().slice(0, 10)

export const daysOverdue = (dueDateStr: string): number => {
  const todayMs = new Date(todayStr() + 'T00:00:00Z').getTime()
  const dueMs = new Date(dueDateStr + 'T00:00:00Z').getTime()
  return Math.max(0, Math.floor((todayMs - dueMs) / 86400000))
}

// ─── Schedule Builder ─────────────────────────────────────────────────────────

/** Build an installment payment schedule.
 *  @param scheduleStartDate Date from which (i+1)*daysBetween offsets are calculated.
 *                           For daily loans pass addDays(issuedDate, -1) so installment 1 = issuedDate.
 *  @param durationDays      Total duration in days (used to compute daysBetween).
 */
export const buildInstallmentSchedule = (
  scheduleStartDate: string,
  totalAmount: number,
  count: number,
  durationDays: number,
  principalAmount: number,
) => {
  const interest = totalAmount - principalAmount
  const installmentAmount = Math.ceil(totalAmount / count)
  const principalPerInstallment = Math.floor(principalAmount / count)
  const interestPerInstallment = Math.floor(interest / count)
  const daysBetween = Math.ceil(durationDays / count)

  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1
    return {
      installment_no: i + 1,
      due_date: addDays(scheduleStartDate, (i + 1) * daysBetween),
      amount_due: isLast ? totalAmount - installmentAmount * (count - 1) : installmentAmount,
      principal_portion: isLast ? principalAmount - principalPerInstallment * (count - 1) : principalPerInstallment,
      interest_portion: isLast ? interest - interestPerInstallment * (count - 1) : interestPerInstallment,
      paid_amount: 0,
      status: 'pending',
    }
  })
}
