import db from '../db/connection'
import type { LoanRow, LoanFilter } from '../types'
import { todayStr, INSTALLMENT_BASED_TYPES } from '../utils/helpers'

export const loanRepo = {
  async findAll(filter: LoanFilter = {}) {
    const { status, customerId, search, page = 1, limit = 20, sortBy = 'due_date', order = 'asc', dueDateFrom, dueDateTo } = filter
    const offset = (page - 1) * limit

    let query = db('loans as l')
      .select(
        'l.*',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
        'c.phone AS customer_phone',
        db.raw("to_char(l.issued_date, 'YYYY-MM-DD') as issued_date"),
        db.raw("to_char(l.due_date, 'YYYY-MM-DD') as due_date"),
        db.raw("to_char(l.closed_date, 'YYYY-MM-DD') as closed_date"),
      )
      .join('customers as c', 'c.id', 'l.customer_id')
      .orderBy(`l.${sortBy}`, order)
      .limit(limit)
      .offset(offset)

    if (status) query = query.where('l.status', status)
    if (customerId) query = query.where('l.customer_id', customerId)
    if (dueDateFrom) query = query.where('l.due_date', '>=', dueDateFrom)
    if (dueDateTo) query = query.where('l.due_date', '<=', dueDateTo)
    if (search) {
      query = query.where((qb) =>
        qb
          .whereILike('l.loan_number', `%${search}%`)
          .orWhereILike('c.first_name', `%${search}%`)
          .orWhereILike('c.last_name', `%${search}%`)
          .orWhereILike('c.phone', `%${search}%`)
      )
    }

    const countQuery = db('loans as l')
      .join('customers as c', 'c.id', 'l.customer_id')
      .count('l.id as total')
    if (status) countQuery.where('l.status', status)
    if (customerId) countQuery.where('l.customer_id', customerId)

    const [rows, [{ total }]] = await Promise.all([query, countQuery])
    return { rows, total: Number(total) }
  },

  async findById(id: number) {
    return db('loans as l')
      .select(
        'l.*',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
        'c.phone AS customer_phone',
        db.raw("to_char(l.issued_date, 'YYYY-MM-DD') as issued_date"),
        db.raw("to_char(l.due_date, 'YYYY-MM-DD') as due_date"),
        db.raw("to_char(l.closed_date, 'YYYY-MM-DD') as closed_date"),
      )
      .join('customers as c', 'c.id', 'l.customer_id')
      .where('l.id', id)
      .first()
  },

  async create(data: Partial<LoanRow>) {
    const [row] = await db('loans').insert(data).returning('*')
    return row as LoanRow
  },

  async update(id: number, data: Partial<LoanRow>) {
    const [row] = await db('loans')
      .where({ id })
      .update({ ...data, updated_at: new Date() })
      .returning('*')
    return row as LoanRow
  },

  async getInstallments(loanId: number) {
    return db('loan_installments')
      .select(
        'id', 'loan_id', 'installment_no', 'amount_due',
        'principal_portion', 'interest_portion', 'paid_amount', 'paid_date', 'status',
        db.raw("to_char(due_date, 'YYYY-MM-DD') as due_date"),
      )
      .where({ loan_id: loanId })
      .orderBy('installment_no')
  },

  async createInstallments(installments: object[]) {
    return db('loan_installments').insert(installments).returning('*')
  },

  async updateInstallment(id: number, data: object) {
    const [row] = await db('loan_installments')
      .where({ id })
      .update({ ...data, updated_at: new Date() })
      .returning('*')
    return row
  },

  // ─── Overdue Management ───────────────────────────────────────────────────

  async markOverdue() {
    const today = todayStr()

    // single/flexible: overall loan due_date passed
    await db('loans')
      .where('due_date', '<', today)
      .where('status', 'active')
      .whereIn('loan_type', ['single', 'flexible'])
      .update({ status: 'overdue', updated_at: new Date() })

    // installment/daily: any unpaid installment past its due date
    const rows = await db('loan_installments as li')
      .join('loans as l', 'l.id', 'li.loan_id')
      .where('li.due_date', '<', today)
      .whereIn('li.status', ['pending', 'partial'])
      .where('l.status', 'active')
      .whereIn('l.loan_type', INSTALLMENT_BASED_TYPES)
      .distinct('li.loan_id')

    if (rows.length > 0) {
      await db('loans')
        .whereIn('id', rows.map((r: any) => r.loan_id))
        .update({ status: 'overdue', updated_at: new Date() })
    }
  },

  /** Revert installment/daily loan back to active if no overdue installments remain. */
  async reEvaluateInstallmentStatus(loanId: number) {
    if (!(await hasOverdueInstallments(db, loanId))) {
      await db('loans')
        .where({ id: loanId })
        .whereIn('loan_type', INSTALLMENT_BASED_TYPES)
        .whereIn('status', ['overdue'])
        .update({ status: 'active', updated_at: new Date() })
    }
  },

  // ─── Dashboard Queries ────────────────────────────────────────────────────

  async dueToday() {
    const today = todayStr()
    return db('loans as l')
      .select(
        'l.id as loan_id', 'l.loan_number', 'l.customer_id', 'l.loan_type', 'l.status',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"), 'c.phone AS customer_phone',
        db.raw('COALESCE(li.installment_no, NULL) AS installment_no'),
        db.raw('l.total_installments'),
        db.raw('COALESCE(li.amount_due, l.total_amount - l.paid_principal - l.paid_interest) AS amount_due'),
        db.raw("COALESCE(to_char(li.due_date, 'YYYY-MM-DD'), to_char(l.due_date, 'YYYY-MM-DD')) AS due_date"),
      )
      .join('customers as c', 'c.id', 'l.customer_id')
      // Left join: installment/daily get installment rows; single/flexible get NULL (handled by COALESCE)
      .leftJoin(
        db('loan_installments')
          .select('*')
          .whereIn('status', ['pending', 'overdue'])
          .orderBy('installment_no')
          .as('li'),
        function () { this.on('li.loan_id', 'l.id') }
      )
      .where(function () {
        // single/flexible: use the loan-level due_date
        this.whereIn('l.loan_type', ['single', 'flexible']).andWhere('l.due_date', '<=', today)
          // installment/daily: use the installment-level due_date
          .orWhere('li.due_date', '<=', today)
      })
      .whereIn('l.status', ['active', 'overdue'])
      .orderBy('due_date')
  },
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Returns true if the loan has any installments past their due date that are unpaid/partial. */
async function hasOverdueInstallments(knex: typeof db, loanId: number): Promise<boolean> {
  const today = todayStr()
  const result = await knex('loan_installments')
    .where('loan_id', loanId)
    .where('due_date', '<', today)
    .whereIn('status', ['pending', 'partial'])
    .count('id as cnt')
    .first()
  return Number((result as any)?.cnt ?? 0) > 0
}
