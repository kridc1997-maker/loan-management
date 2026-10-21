import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import db from '../src/db/connection'
import { loanService } from '../src/services/loanService'
import { resetDb, createTestCustomer } from './helpers'

afterAll(async () => { await db.destroy() })
beforeEach(async () => { await resetDb() })

async function setup() {
  const c = await createTestCustomer()
  await db('cash_transactions').insert({ txn_number: 'CTX-T-1', txn_type: 'capital_in', direction: 'in', amount: 100000, balance_after: 100000, txn_date: '2026-08-01' })
  const loan = await loanService.createLoan({
    customerId: c.id, principalAmount: 3000, totalAmount: 3600, loanType: 'daily',
    totalInstallments: 6, issuedDate: '2026-09-01', dueDate: '2026-09-06',
  })
  return loan
}
const payNext = async (loanId: number) => {
  const inst = await db('loan_installments').where({ loan_id: loanId }).whereIn('status', ['pending', 'partial', 'overdue']).orderBy('installment_no').first()
  await loanService.receivePayment({ loanId, installmentId: inst.id, amount: Number(inst.amount_due), paymentType: 'normal', paymentMethod: 'cash', paymentDate: '2026-09-10' })
}

describe('loanService.resetBalance (รียอด)', () => {
  it('pays cash back, regenerates the schedule and zeroes progress', async () => {
    const loan = await setup()
    for (let i = 0; i < 3; i++) await payNext(loan.id)
    const before = Number((await db('cash_transactions').orderBy('id', 'desc').first()).balance_after)
    await loanService.resetBalance(loan.id, false, undefined)
    const after = await db('loans').where({ id: loan.id }).first()
    expect(Number(after.paid_installments)).toBe(0)
    expect(Number(after.paid_principal)).toBe(0)
    expect(Number(after.paid_interest)).toBe(0)
    // remaining = 3600 - 600*3 = 1800 ; cashBack = 3000 - 1800 = 1200
    expect(Number((await db('cash_transactions').orderBy('id', 'desc').first()).balance_after)).toBe(before - 1200)
    expect(Number((await db('loan_installments').where({ loan_id: loan.id }).count('id as c').first())!.c)).toBe(6)
  })

  it('a payment made AFTER the reset must not re-count pre-reset payments in paid_principal/paid_interest', async () => {
    const loan = await setup()
    for (let i = 0; i < 3; i++) await payNext(loan.id)
    await loanService.resetBalance(loan.id, false, undefined)
    await payNext(loan.id)
    const l = await db('loans').where({ id: loan.id }).first()
    // one fresh installment: 600 = 500 principal + 100 interest
    expect(Number(l.paid_principal)).toBe(500)
    expect(Number(l.paid_interest)).toBe(100)
    expect(Number(l.paid_installments)).toBe(1)
  })
})

describe('รียอด with deduct-first-installment', () => {
  it('keeps the deducted first installment counted after later payments', async () => {
    const loan = await setup()
    for (let i = 0; i < 3; i++) await payNext(loan.id)
    await loanService.resetBalance(loan.id, true, undefined)
    let l = await db('loans').where({ id: loan.id }).first()
    expect(Number(l.paid_installments)).toBe(1)
    expect(Number(l.paid_principal)).toBe(500)
    await payNext(loan.id)
    l = await db('loans').where({ id: loan.id }).first()
    expect(Number(l.paid_installments)).toBe(2)
    expect(Number(l.paid_principal)).toBe(1000)
    expect(Number(l.paid_interest)).toBe(200)
  })
})

describe('รียอด accounting', () => {
  it('records settlement + new payout; net cash equals what the customer receives; settled interest is profit', async () => {
    const loan = await setup()
    for (let i = 0; i < 3; i++) await payNext(loan.id)
    const cash0 = Number((await db('cash_transactions').orderBy('id', 'desc').first()).balance_after)
    const interest0 = Number((await db('payments').where({ loan_id: loan.id }).sum('interest_paid as s').first())!.s)
    await loanService.resetBalance(loan.id, true, undefined)
    // remaining 1800 (principal 1500 + interest 300), first installment 600, new principal 3000
    // customer receives 3000 - 1800 - 600 = 600
    expect(Number((await db('cash_transactions').orderBy('id', 'desc').first()).balance_after)).toBe(cash0 - 600)
    const interest1 = Number((await db('payments').where({ loan_id: loan.id }).sum('interest_paid as s').first())!.s)
    expect(interest1 - interest0).toBe(300 + 100) // settled interest + first installment's interest
    const l = await db('loans').where({ id: loan.id }).first()
    expect(new Date(l.issued_date).toDateString()).toBe(new Date().toDateString())
    const nums = (await db('cash_transactions').where({ loan_id: loan.id }).select('txn_number')).map((r: any) => r.txn_number)
    expect(new Set(nums).size).toBe(nums.length)
  })

  it('reset payments cannot be deleted', async () => {
    const loan = await setup()
    for (let i = 0; i < 3; i++) await payNext(loan.id)
    await loanService.resetBalance(loan.id, true, undefined)
    const p = await db('payments').where({ loan_id: loan.id, note: 'รียอด (หักงวดแรก)' }).first()
    await expect(loanService.deletePayment(p.id)).rejects.toThrow()
  })
})
