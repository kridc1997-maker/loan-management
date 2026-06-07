import db from '../db/connection'
import type { PaymentRow } from '../types'

export const paymentRepo = {
  async findAll(filter: { loanId?: number; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}) {
    const { loanId, dateFrom, dateTo, page = 1, limit = 20 } = filter
    const offset = (page - 1) * limit

    let query = db('payments as p')
      .select('p.*', db.raw("c.first_name || ' ' || c.last_name AS customer_name"), 'l.loan_number')
      .join('loans as l', 'l.id', 'p.loan_id')
      .join('customers as c', 'c.id', 'l.customer_id')
      .orderBy('p.payment_date', 'desc')
      .limit(limit)
      .offset(offset)

    if (loanId) query = query.where('p.loan_id', loanId)
    if (dateFrom) query = query.where('p.payment_date', '>=', dateFrom)
    if (dateTo) query = query.where('p.payment_date', '<=', dateTo)

    const [rows] = await Promise.all([query])
    return rows
  },

  async create(data: Partial<PaymentRow>) {
    const [row] = await db('payments').insert(data).returning('*')
    return row as PaymentRow
  },

  // Daily interest collected
  async interestToday() {
    const today = new Date().toISOString().split('T')[0]
    const result = await db('payments')
      .sum('interest_paid as total')
      .where('payment_date', today)
      .first()
    return Number(result?.total ?? 0)
  },

  async interestThisMonth() {
    const now = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const result = await db('payments')
      .sum('interest_paid as total')
      .where('payment_date', '>=', from)
      .first()
    return Number(result?.total ?? 0)
  },
}
