import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import db from '../src/db/connection'
import { loanService } from '../src/services/loanService'
import { resetDb, createTestCustomer } from './helpers'

afterAll(async () => {
  await db.destroy()
})

beforeEach(async () => {
  await resetDb()
})

async function singleLoan(customerId: number, principal: number, total: number) {
  return loanService.createLoan({
    customerId, principalAmount: principal, totalAmount: total, loanType: 'single',
    totalInstallments: 1, issuedDate: '2026-09-01', dueDate: '2026-09-30',
  })
}

const latestBalance = async () => Number((await db('cash_transactions').orderBy('id', 'desc').first()).balance_after)

describe('loanService.mergeLoans', () => {
  it('combines remaining principal + interest into one flexible loan, closes the old ones as merged, moves no cash', async () => {
    const c = await createTestCustomer()
    await db('cash_transactions').insert({ txn_number: 'CTX-T-1', txn_type: 'capital_in', direction: 'in', amount: 100000, balance_after: 100000, txn_date: '2026-08-01' })
    const a = await singleLoan(c.id, 3000, 3600)
    const b = await singleLoan(c.id, 2000, 2300)
    // b: partial payment of 500 principal + 100 interest
    await loanService.receivePayment({
      loanId: b.id, amount: 600, paymentType: 'partial', paymentMethod: 'cash', paymentDate: '2026-09-10',
      explicitPrincipal: 500, explicitInterest: 100,
    })
    const cashBefore = await latestBalance()
    const paymentsBefore = Number((await db('payments').count('id as c').first())!.c)

    const merged = await loanService.mergeLoans(c.id, [a.id, b.id])

    // remaining: a = 3000 + 600 ; b = 1500 + 200  => principal 4500, total 5300
    expect(Number(merged.principal_amount)).toBe(4500)
    expect(Number(merged.total_amount)).toBe(5300)
    expect(merged.loan_type).toBe('flexible')
    expect(merged.status).toBe('active')
    expect(Number(merged.paid_principal)).toBe(0)
    expect(Number(merged.paid_interest)).toBe(0)
    expect(merged.merged_from).toEqual([a.id, b.id])

    for (const id of [a.id, b.id]) {
      const old = await db('loans').where({ id }).first()
      expect(old.status).toBe('merged')
      expect(old.closed_date).not.toBeNull()
    }

    // no cash movement, no payment rows created
    expect(await latestBalance()).toBe(cashBefore)
    expect(Number((await db('payments').count('id as c').first())!.c)).toBe(paymentsBefore)
  })

  it('rejects fewer than 2 loans, other customers\' loans, and non single/flexible loans', async () => {
    const c1 = await createTestCustomer()
    const c2 = await createTestCustomer()
    const a = await singleLoan(c1.id, 1000, 1200)
    const b = await singleLoan(c1.id, 1000, 1200)
    const other = await singleLoan(c2.id, 1000, 1200)
    const inst = await loanService.createLoan({
      customerId: c1.id, principalAmount: 4000, totalAmount: 5000, loanType: 'installment',
      totalInstallments: 4, issuedDate: '2026-09-01', dueDate: '2026-09-09',
    })

    await expect(loanService.mergeLoans(c1.id, [a.id])).rejects.toThrow()
    await expect(loanService.mergeLoans(c1.id, [a.id, other.id])).rejects.toThrow()
    await expect(loanService.mergeLoans(c1.id, [a.id, inst.id])).rejects.toThrow()
    // nothing changed by the failed attempts
    expect((await db('loans').where({ id: a.id }).first()).status).toBe('active')
    expect((await db('loans').where({ id: b.id }).first()).status).toBe('active')
  })

  it('merged loans can no longer receive payments, and a merged loan is not re-mergeable', async () => {
    const c = await createTestCustomer()
    const a = await singleLoan(c.id, 1000, 1200)
    const b = await singleLoan(c.id, 1000, 1200)
    await loanService.mergeLoans(c.id, [a.id, b.id])

    await expect(loanService.receivePayment({
      loanId: a.id, amount: 100, paymentType: 'partial', paymentMethod: 'cash', paymentDate: '2026-09-20',
    })).rejects.toThrow()
    await expect(loanService.mergeLoans(c.id, [a.id, b.id])).rejects.toThrow()
  })

  it('rolled-over loans merge by their remaining (post-rollover) balance', async () => {
    const c = await createTestCustomer()
    const a = await singleLoan(c.id, 3000, 3600)
    const b = await singleLoan(c.id, 1000, 1200)
    await loanService.receivePayment({
      loanId: a.id, amount: 600, paymentType: 'rollover', paymentMethod: 'cash', paymentDate: '2026-09-25', newDueDate: '2026-10-30',
    })
    const merged = await loanService.mergeLoans(c.id, [a.id, b.id])
    // a after rollover still owes 3000 principal + a fresh 600 interest period; b owes 1200
    expect(Number(merged.principal_amount)).toBe(4000)
    expect(Number(merged.total_amount)).toBe(4800)
  })
})
