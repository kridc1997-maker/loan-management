import db from '../db/connection'
import type { CustomerRow, CustomerFilter } from '../types'

// ─── Credit score helpers ─────────────────────────────────────────────────────
export function getCreditLabel(score: number | null): string | null {
  if (score === null) return null
  if (score >= 85) return 'ดีมาก'
  if (score >= 70) return 'ดี'
  if (score >= 50) return 'ปานกลาง'
  if (score >= 30) return 'แย่'
  return 'แย่มาก'
}

/*
 Credit score formula (0–100):
   base 60
   Installment loans (from loan_installments):
     + on-time paid installments × 3
     − paid-late 1–7 days × 5  / 8–30 days × 10  / 31+ days × 15
   Single/non-installment loans (from payments table, installment_id IS NULL):
     + on-time payment × 2
     − late 1–7 days × 5  / 8–30 days × 10  / 31+ days × 15
   − excess rollovers per loan (>3) × 5
   + clean-closed loans × 8   (installment: no late installments;
                                single: no payment after loan due_date)
   + 20 bonus if 3+ clean-closed loans
   NULL when customer has no loans at all
*/
export const CREDIT_SCORE_SQL = `(SELECT
  CASE WHEN (SELECT COUNT(*) FROM loans lc WHERE lc.customer_id = c.id) = 0 THEN NULL
  ELSE LEAST(100, GREATEST(0, (
    60
    + on_time * 3  - late7 * 5  - late30 * 10 - late_more * 15
    + s_on   * 2   - s_l7  * 5  - s_l30  * 10 - s_lm     * 15
    - excess_roll
    + clean_closed * 8 + CASE WHEN clean_closed >= 3 THEN 20 ELSE 0 END
  )::integer)) END
FROM (SELECT
    -- Installment-based payments
    COALESCE((SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND li2.due_date::date <= CURRENT_DATE
     AND li2.status IN ('paid','partial')
     AND (li2.paid_date IS NULL OR li2.paid_date::date <= li2.due_date::date)), 0)::integer AS on_time,
    COALESCE((SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND li2.paid_date IS NOT NULL
     AND (li2.paid_date::date - li2.due_date::date) BETWEEN 1 AND 7), 0)::integer AS late7,
    COALESCE((SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND li2.paid_date IS NOT NULL
     AND (li2.paid_date::date - li2.due_date::date) BETWEEN 8 AND 30), 0)::integer AS late30,
    COALESCE((SELECT COUNT(*) FROM loan_installments li2 JOIN loans l2 ON li2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND li2.paid_date IS NOT NULL
     AND (li2.paid_date::date - li2.due_date::date) > 30), 0)::integer AS late_more,
    -- Non-installment payments (single loans / rollovers without installment_id)
    -- compare payment_date to loan.due_date at the time of payment
    COALESCE((SELECT COUNT(*) FROM payments p2 JOIN loans l2 ON p2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND p2.installment_id IS NULL
     AND p2.payment_type IN ('normal','full','rollover')
     AND p2.payment_date::date <= l2.due_date::date), 0)::integer AS s_on,
    COALESCE((SELECT COUNT(*) FROM payments p2 JOIN loans l2 ON p2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND p2.installment_id IS NULL
     AND p2.payment_type IN ('normal','full','rollover')
     AND (p2.payment_date::date - l2.due_date::date) BETWEEN 1 AND 7), 0)::integer AS s_l7,
    COALESCE((SELECT COUNT(*) FROM payments p2 JOIN loans l2 ON p2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND p2.installment_id IS NULL
     AND p2.payment_type IN ('normal','full','rollover')
     AND (p2.payment_date::date - l2.due_date::date) BETWEEN 8 AND 30), 0)::integer AS s_l30,
    COALESCE((SELECT COUNT(*) FROM payments p2 JOIN loans l2 ON p2.loan_id = l2.id
     WHERE l2.customer_id = c.id AND p2.installment_id IS NULL
     AND p2.payment_type IN ('normal','full','rollover')
     AND (p2.payment_date::date - l2.due_date::date) > 30), 0)::integer AS s_lm,
    -- Excess rollover penalty
    COALESCE((SELECT SUM(GREATEST(0, rc - 3)) * 5 FROM (
      SELECT COUNT(*) FILTER (WHERE p.payment_type = 'rollover') AS rc
      FROM loans l3 JOIN payments p ON p.loan_id = l3.id
      WHERE l3.customer_id = c.id GROUP BY l3.id) t), 0)::integer AS excess_roll,
    -- Clean closed loans: no late installments AND no late non-installment payment
    COALESCE((SELECT COUNT(*) FROM loans l3 WHERE l3.customer_id = c.id AND l3.status = 'completed'
     AND NOT EXISTS (SELECT 1 FROM loan_installments li3 WHERE li3.loan_id = l3.id
       AND li3.paid_date IS NOT NULL AND li3.paid_date::date > li3.due_date::date)
     AND NOT EXISTS (SELECT 1 FROM payments p3 WHERE p3.loan_id = l3.id
       AND p3.installment_id IS NULL AND p3.payment_date::date > l3.due_date::date)
    ), 0)::integer AS clean_closed
) s) AS credit_score`

export const customerRepo = {
  async findAll(filter: CustomerFilter = {}) {
    const { search, riskLevel, hasActiveLoans, page = 1, limit = 20, sortBy = 'created_at', order = 'desc' } = filter
    const offset = (page - 1) * limit

    let query = db('customers as c')
      .select(
        'c.*',
        db.raw(`(SELECT COUNT(*) FROM loans l2 WHERE l2.customer_id = c.id AND l2.status IN ('active','overdue')) AS active_loans_count`),
        db.raw(`COALESCE((SELECT SUM(l2.total_amount - l2.paid_principal - l2.paid_interest) FROM loans l2 WHERE l2.customer_id = c.id AND l2.status IN ('active','overdue')), 0) AS total_outstanding`),
        db.raw(CREDIT_SCORE_SQL),
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
        db.raw(CREDIT_SCORE_SQL),
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

    // Loan-level data for credit scoring
    const loanScoreData = await db('loans as l')
      .where('l.customer_id', customerId)
      .select(
        'l.id', 'l.status',
        db.raw(`COALESCE((SELECT COUNT(*) FILTER (WHERE p.payment_type = 'rollover') FROM payments p WHERE p.loan_id = l.id), 0) AS rollover_count`),
        db.raw(`COALESCE((SELECT COUNT(*) FROM loan_installments li WHERE li.loan_id = l.id AND li.paid_date IS NOT NULL AND li.paid_date::date > li.due_date::date), 0) AS late_installment_count`),
        db.raw(`EXISTS(SELECT 1 FROM payments p WHERE p.loan_id = l.id AND p.installment_id IS NULL AND p.payment_date::date > l.due_date::date) AS has_late_single_payment`)
      )

    // Non-installment payments (single loans / rollovers without installment_id)
    const nonInstPayments = await db('payments as p')
      .join('loans as l', 'l.id', 'p.loan_id')
      .where('l.customer_id', customerId)
      .whereNull('p.installment_id')
      .whereIn('p.payment_type', ['normal', 'full', 'rollover'])
      .select(db.raw('(p.payment_date::date - l.due_date::date) as days_diff'))

    // Compute credit score
    let creditScore: number | null = null
    if (loanScoreData.length > 0) {
      let score = 60

      // Installment-based on-time/late
      const onTimeCount = totalPaid - lateCount
      score += onTimeCount * 3
      for (const lp of latePayments) {
        const days = Number(lp.days_late)
        if (days <= 7) score -= 5
        else if (days <= 30) score -= 10
        else score -= 15
      }

      // Non-installment (single loan) payments
      for (const sp of nonInstPayments) {
        const diff = Number(sp.days_diff)
        if (diff <= 0) score += 2          // on time
        else if (diff <= 7) score -= 5
        else if (diff <= 30) score -= 10
        else score -= 15
      }

      // Excess rollover penalty
      for (const loan of loanScoreData) {
        score -= Math.max(0, Number(loan.rollover_count) - 3) * 5
      }

      // Clean closed: no late installments AND no late single payment
      const cleanClosed = loanScoreData.filter(
        (l) => l.status === 'completed'
          && Number(l.late_installment_count) === 0
          && !l.has_late_single_payment
      )
      score += cleanClosed.length * 8
      if (cleanClosed.length >= 3) score += 20

      creditScore = Math.max(0, Math.min(100, Math.round(score)))
    }

    return {
      totalDue,
      totalPaid,
      lateCount,
      avgDaysLate,
      collectionRate: totalDue > 0 ? totalPaid / totalDue : null,
      creditScore,
      creditLabel: getCreditLabel(creditScore),
      latePayments,
    }
  },
}
