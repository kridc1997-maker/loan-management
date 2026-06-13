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
        db.raw(`CASE WHEN (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE) = 0 THEN NULL ELSE (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE AND li2.status IN ('paid','partial'))::decimal / (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE) END AS collection_rate`),
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
        db.raw(`CASE WHEN (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE) = 0 THEN NULL ELSE (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE AND li2.status IN ('paid','partial'))::decimal / (SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE) END AS collection_rate`),
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

  async getPaymentStats(customerId: number) {
    const row = await db('loan_installments as li')
      .join('loans as l', 'l.id', 'li.loan_id')
      .where('l.customer_id', customerId)
      .whereRaw('li.due_date::date <= CURRENT_DATE')
      .select(
        db.raw('COUNT(*) as total_due'),
        db.raw("COUNT(*) FILTER (WHERE li.status IN ('paid','partial')) as total_paid"),
        db.raw("COUNT(*) FILTER (WHERE li.paid_date IS NOT NULL AND li.paid_date::date > li.due_date::date) as late_count"),
        db.raw(`COALESCE(AVG(
          CASE WHEN li.paid_date IS NOT NULL AND li.paid_date::date > li.due_date::date
          THEN (li.paid_date::date - li.due_date::date) ELSE NULL END
        ), 0) as avg_days_late`),
      )
      .first()

    const totalDue = Number(row?.total_due ?? 0)
    const totalPaid = Number(row?.total_paid ?? 0)
    const lateCount = Number(row?.late_count ?? 0)
    const avgDaysLate = Math.round(Number(row?.avg_days_late ?? 0))

    // Late payment history
    const latePayments = await db('loan_installments as li')
      .join('loans as l', 'l.id', 'li.loan_id')
      .where('l.customer_id', customerId)
      .whereIn('li.status', ['paid', 'partial'])
      .whereRaw('li.paid_date IS NOT NULL AND li.paid_date::date > li.due_date::date')
      .select(
        'li.id',
        'li.installment_no',
        db.raw("to_char(li.due_date, 'YYYY-MM-DD') as due_date"),
        db.raw("to_char(li.paid_date, 'YYYY-MM-DD') as paid_date"),
        db.raw('(li.paid_date::date - li.due_date::date) as days_late'),
        'li.amount_due',
        'li.paid_amount',
        'l.loan_number',
        'l.loan_type',
        'l.id as loan_id',
      )
      .orderBy('li.paid_date', 'desc')

    return {
      totalDue,
      totalPaid,
      lateCount,
      avgDaysLate,
      collectionRate: totalDue > 0 ? totalPaid / totalDue : null,
      latePayments,
    }
  },
}
