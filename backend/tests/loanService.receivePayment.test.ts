import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import db from '../src/db/connection'
import { loanService } from '../src/services/loanService'
import { resetDb, createTestCustomer } from './helpers'

// Single process, single test file for now — safe to own the connection teardown here.
afterAll(async () => {
  await db.destroy()
})

beforeEach(async () => {
  await resetDb()
})

describe('loanService.receivePayment — fine-only payments (regression)', () => {
  it('single loan, partial payment type, fine only: does not touch principal/interest, loan stays active', async () => {
    const customer = await createTestCustomer()
    const loan = await loanService.createLoan({
      customerId: customer.id,
      principalAmount: 2000,
      totalAmount: 2300,
      loanType: 'single',
      totalInstallments: 1,
      issuedDate: '2026-06-20',
      dueDate: '2026-07-20',
    })

    const { payment } = await loanService.receivePayment({
      loanId: loan.id,
      amount: 400,
      finePaid: 400,
      paymentType: 'partial',
      paymentMethod: 'cash',
      paymentDate: '2026-07-20',
    })

    expect(Number(payment.principal_paid)).toBe(0)
    expect(Number(payment.interest_paid)).toBe(0)
    expect(Number(payment.fine_paid)).toBe(400)

    const updatedLoan = await db('loans').where({ id: loan.id }).first()
    expect(updatedLoan.status).toBe('active')
    expect(Number(updatedLoan.paid_principal)).toBe(0)
    expect(Number(updatedLoan.paid_interest)).toBe(0)
  })

  it('installment loan, normal payment type, fine only: leaves the installment schedule untouched', async () => {
    const customer = await createTestCustomer()
    const loan = await loanService.createLoan({
      customerId: customer.id,
      principalAmount: 4000,
      totalAmount: 5000,
      loanType: 'installment',
      totalInstallments: 4,
      issuedDate: '2026-07-01',
      dueDate: '2026-07-09',
    })

    const installmentsBefore = await db('loan_installments').where({ loan_id: loan.id }).orderBy('installment_no', 'asc')
    const currentInstallment = installmentsBefore.find((i: any) => i.status === 'pending')

    const { payment } = await loanService.receivePayment({
      loanId: loan.id,
      installmentId: currentInstallment.id,
      amount: 200,
      finePaid: 200,
      paymentType: 'normal',
      paymentMethod: 'cash',
      paymentDate: '2026-07-20',
    })

    expect(Number(payment.principal_paid)).toBe(0)
    expect(Number(payment.interest_paid)).toBe(0)
    expect(Number(payment.fine_paid)).toBe(200)

    const installmentAfter = await db('loan_installments').where({ id: currentInstallment.id }).first()
    expect(installmentAfter.status).toBe('pending')
    expect(Number(installmentAfter.paid_amount)).toBe(0)

    const updatedLoan = await db('loans').where({ id: loan.id }).first()
    expect(Number(updatedLoan.paid_installments)).toBe(0)
  })
})

describe('loanService.receivePayment — happy paths', () => {
  it('single loan, full payment: closes the loan and pays off all remaining principal + interest', async () => {
    const customer = await createTestCustomer()
    const loan = await loanService.createLoan({
      customerId: customer.id,
      principalAmount: 2000,
      totalAmount: 2300,
      loanType: 'single',
      totalInstallments: 1,
      issuedDate: '2026-06-20',
      dueDate: '2026-07-20',
    })

    await loanService.receivePayment({
      loanId: loan.id,
      amount: 2300,
      paymentType: 'full',
      paymentMethod: 'cash',
      paymentDate: '2026-07-20',
    })

    const updatedLoan = await db('loans').where({ id: loan.id }).first()
    expect(updatedLoan.status).toBe('completed')
    expect(Number(updatedLoan.paid_principal)).toBe(2000)
    expect(Number(updatedLoan.paid_interest)).toBe(300)
  })

  it('installment loan, normal payment for the full installment amount: marks that installment paid', async () => {
    const customer = await createTestCustomer()
    const loan = await loanService.createLoan({
      customerId: customer.id,
      principalAmount: 4000,
      totalAmount: 5000,
      loanType: 'installment',
      totalInstallments: 4,
      issuedDate: '2026-07-01',
      dueDate: '2026-07-09',
    })

    const installmentsBefore = await db('loan_installments').where({ loan_id: loan.id }).orderBy('installment_no', 'asc')
    const currentInstallment = installmentsBefore.find((i: any) => i.status === 'pending')

    await loanService.receivePayment({
      loanId: loan.id,
      installmentId: currentInstallment.id,
      amount: Number(currentInstallment.amount_due),
      paymentType: 'normal',
      paymentMethod: 'cash',
      paymentDate: '2026-07-20',
    })

    const installmentAfter = await db('loan_installments').where({ id: currentInstallment.id }).first()
    expect(installmentAfter.status).toBe('paid')

    const updatedLoan = await db('loans').where({ id: loan.id }).first()
    expect(Number(updatedLoan.paid_installments)).toBe(1)
  })

  it('single loan, rollover: resets paid_interest and extends the due date', async () => {
    const customer = await createTestCustomer()
    const loan = await loanService.createLoan({
      customerId: customer.id,
      principalAmount: 2000,
      totalAmount: 2300,
      loanType: 'single',
      totalInstallments: 1,
      issuedDate: '2026-06-20',
      dueDate: '2026-07-20',
    })

    await loanService.receivePayment({
      loanId: loan.id,
      amount: 300,
      paymentType: 'rollover',
      paymentMethod: 'cash',
      paymentDate: '2026-07-20',
      newDueDate: '2026-08-20',
    })

    const updatedLoan = await db('loans').where({ id: loan.id }).first()
    const dueDate: Date = updatedLoan.due_date
    const formattedDueDate = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`
    expect(updatedLoan.status).toBe('active')
    expect(Number(updatedLoan.paid_interest)).toBe(0)
    expect(formattedDueDate).toBe('2026-08-20')
  })
})
