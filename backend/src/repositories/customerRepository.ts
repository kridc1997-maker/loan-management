import db from '../db/connection'
import type { CustomerRow, CustomerFilter } from '../types'

export const customerRepo = {
  async findAll(filter: CustomerFilter = {}) {
    const { search, riskLevel, hasActiveLoans, page = 1, limit = 20, sortBy = 'created_at', order = 'desc' } = filter
    const offset = (page - 1) * limit

    let query = db('customers as c')
      .select(
        'c.*',
        db.raw(`(SELECT COUNT(*) FROM loans l2 WHERE l2.customer_id = c.id AND l2.status IN ('active','overdue')) AS active_loans_count`),
        db.raw(`COALESCE((SELECT SUM(l2.total_amount - l2.paid_principal - l2.paid_interest) FROM loans l2 WHERE l2.customer_id = c.id AND l2.status IN ('active','overdue')), 0) AS total_outstanding`),
        db.raw(`CASE WHEN (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id) = 0 THEN NULL ELSE (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.status = 'paid')::decimal / (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id) END AS collection_rate`),
      )
      .orderBy(`c.${sortBy}`, order)
      .limit(limit)
      .offset(offset)

    if (search) {
      query = query.where((qb) =>
        qb
          .whereILike('c.first_name', `%${search}%`)
          .orWhereILike('c.last_name', `%${search}%`)
          .orWhereILike('c.phone', `%${search}%`)
      )
    }
    if (riskLevel) query = query.where('c.risk_level', riskLevel)
    if (hasActiveLoans !== undefined) {
      query = query.havingRaw(
        hasActiveLoans
          ? 'COUNT(DISTINCT l.id) FILTER (WHERE l.status IN (\'active\',\'overdue\')) > 0'
          : 'COUNT(DISTINCT l.id) FILTER (WHERE l.status IN (\'active\',\'overdue\')) = 0'
      )
    }

    const countQuery = db('customers as c').count('* as total')
    if (search) {
      countQuery.where((qb) =>
        qb.whereILike('first_name', `%${search}%`).orWhereILike('last_name', `%${search}%`).orWhereILike('phone', `%${search}%`)
      )
    }
    if (riskLevel) countQuery.where('risk_level', riskLevel)

    const [rows, [{ total }]] = await Promise.all([query, countQuery])
    return { rows, total: Number(total) }
  },

  async findById(id: number) {
    return db('customers as c')
      .select(
        'c.*',
        db.raw(`(SELECT COUNT(*) FROM loans l2 WHERE l2.customer_id = c.id AND l2.status IN ('active','overdue')) AS active_loans_count`),
        db.raw(`COALESCE((SELECT SUM(l2.total_amount - l2.paid_principal - l2.paid_interest) FROM loans l2 WHERE l2.customer_id = c.id AND l2.status IN ('active','overdue')), 0) AS total_outstanding`),
        db.raw(`CASE WHEN (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id) = 0 THEN NULL ELSE (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.status = 'paid')::decimal / (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id) END AS collection_rate`),
      )
      .where('c.id', id)
      .first()
  },

  async create(data: Partial<CustomerRow>) {
    const [row] = await db('customers').insert(data).returning('*')
    return row as CustomerRow
  },

  async update(id: number, data: Partial<CustomerRow>) {
    const [row] = await db('customers')
      .where({ id })
      .update({ ...data, updated_at: new Date() })
      .returning('*')
    return row as CustomerRow
  },

  async getLoanHistory(customerId: number) {
    return db('loans as l')
      .select(
        'l.*',
        db.raw(`EXISTS(SELECT 1 FROM payments p WHERE p.loan_id = l.id AND p.payment_type = 'rollover') AS is_rolled_over`),
        db.raw(`COALESCE((SELECT SUM(p.interest_paid) FROM payments p WHERE p.loan_id = l.id), 0) AS total_paid_interest`),
        db.raw(`(SELECT COUNT(*) FROM payments p WHERE p.loan_id = l.id AND p.payment_type = 'rollover') AS rollover_count`),
      )
      .where({ customer_id: customerId })
      .orderBy('l.issued_date', 'desc')
  },
}
