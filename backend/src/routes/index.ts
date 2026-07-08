import { Router } from 'express'
import { authController } from '../controllers/authController'
import { customerController } from '../controllers/customerController'
import { loanController } from '../controllers/loanController'
import { dashboardController } from '../controllers/dashboardController'
import { badDebtController } from '../controllers/badDebtController'
import { userController } from '../controllers/userController'
import { authenticate, requireAdmin } from '../middleware/auth'
import { dashboardRepo } from '../repositories/dashboardRepository'
import { logAudit } from '../utils/auditLog'
import db from '../db/connection'

const router = Router()

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', authController.login)
router.post('/auth/refresh', authController.refresh)
router.get('/auth/me', authenticate, authController.me)

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/summary', authenticate, requireAdmin, dashboardController.summary)
router.get('/dashboard/cash-flow', authenticate, requireAdmin, dashboardController.cashFlow)
router.get('/dashboard/due-today', authenticate, dashboardController.dueToday)
router.get('/dashboard/top-customers', authenticate, requireAdmin, dashboardController.topCustomers)
router.get('/dashboard/overdue', authenticate, requireAdmin, dashboardController.overdueSummary)

// ─── Executive Dashboard ──────────────────────────────────────────────────────
router.get('/executive/dashboard', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const data = await dashboardRepo.getExecutiveDashboard()
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ─── Customers ────────────────────────────────────────────────────────────────
router.get('/customers', authenticate, customerController.list)
router.post('/customers', authenticate, customerController.create)
router.get('/customers/:id', authenticate, customerController.get)
router.put('/customers/:id', authenticate, customerController.update)
router.get('/customers/:id/loans', authenticate, customerController.loans)
router.get('/customers/:id/payment-stats', authenticate, customerController.paymentStats)

// ─── Loans ────────────────────────────────────────────────────────────────────
router.get('/loans', authenticate, loanController.list)
router.post('/loans', authenticate, loanController.create)
router.get('/loans/:id', authenticate, loanController.get)
router.get('/loans/:id/installments', authenticate, loanController.getInstallments)
router.get('/installments', authenticate, async (req: any, res, next) => {
  try {
    const status = req.query.status as string | undefined
    const dateFrom = req.query.dateFrom as string | undefined
    const dateTo = req.query.dateTo as string | undefined
    let query = db('loan_installments as li')
      .select(
        'li.id', 'li.loan_id', 'li.installment_no', 'li.amount_due',
        'li.principal_portion', 'li.interest_portion', 'li.paid_amount',
        'li.paid_date', 'li.status',
        db.raw("to_char(li.due_date, 'YYYY-MM-DD') as due_date"),
        'l.loan_number', 'l.loan_type', 'l.total_installments',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
        'c.phone AS customer_phone',
        'l.customer_id',
      )
      .join('loans as l', 'l.id', 'li.loan_id')
      .join('customers as c', 'c.id', 'l.customer_id')
      .whereIn('l.status', ['active', 'overdue'])
      .orderByRaw("to_char(li.due_date, 'YYYY-MM-DD') asc")
    if (status) query = query.where('li.status', status)
    if (dateFrom) query = query.whereRaw("to_char(li.due_date, 'YYYY-MM-DD') >= ?", [dateFrom])
    if (dateTo) query = query.whereRaw("to_char(li.due_date, 'YYYY-MM-DD') <= ?", [dateTo])
    const rows = await query
    res.json({ success: true, data: rows.map((r: any) => ({
      id: r.id, loanId: r.loan_id, loanNumber: r.loan_number, loanType: r.loan_type,
      totalInstallments: r.total_installments, customerId: r.customer_id,
      customerName: r.customer_name, customerPhone: r.customer_phone,
      installmentNo: r.installment_no,
      dueDate: String(r.due_date),
      amountDue: Number(r.amount_due), principalPortion: Number(r.principal_portion),
      interestPortion: Number(r.interest_portion), paidAmount: Number(r.paid_amount),
      paidDate: r.paid_date ?? null, status: r.status,
    })) })
  } catch (err) { next(err) }
})
router.post('/loans/:id/payment', authenticate, loanController.receivePayment)
router.post('/loans/:id/rollover', authenticate, loanController.rollover)
router.post('/loans/:id/mark-bad-debt', authenticate, loanController.markBadDebt)
router.post('/loans/:id/reset-balance', authenticate, loanController.resetBalance)
router.post('/loans/:id/mark-complete', authenticate, loanController.markComplete)
router.post('/loans/:id/convert-to-flexible', authenticate, loanController.convertToFlexible)
router.put('/loans/:id/due-date', authenticate, loanController.updateDueDate)
router.put('/loans/:id/adjust', authenticate, loanController.adjustAmounts)

// ─── Payments ─────────────────────────────────────────────────────────────────
router.get('/payments', authenticate, async (req, res, next) => {
  try {
    const { paymentRepo } = await import('../repositories/paymentRepository')
    const rows = await paymentRepo.findAll({
      loanId: req.query.loanId ? Number(req.query.loanId) : undefined,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    })
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
})

router.get('/payments/daily', authenticate, async (req, res, next) => {
  try {
    const date = (req.query.date as string) ?? new Date().toISOString().split('T')[0]
    const rows = await db('payments as p')
      .join('loans as l', 'l.id', 'p.loan_id')
      .join('customers as c', 'c.id', 'l.customer_id')
      .select(
        'p.id',
        'p.payment_number',
        'p.amount',
        'p.interest_paid',
        'p.principal_paid',
        'p.over_payment',
        'p.payment_type',
        'p.payment_method',
        'p.note',
        'l.loan_number',
        'l.loan_type',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
        'c.id as customer_id',
      )
      .whereRaw('p.payment_date::date = ?::date', [date])
      .orderBy('p.id', 'desc')
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
})

// ─── Bad Debts ────────────────────────────────────────────────────────────────
router.get('/bad-debts', authenticate, badDebtController.list)
router.put('/bad-debts/:id/recover', authenticate, badDebtController.recover)

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/monthly', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const rows = await db('monthly_snapshots').orderBy('snapshot_month', 'desc').limit(12)
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
})

router.get('/reports/profit', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const from = req.query.from as string ?? new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const to = req.query.to as string ?? new Date().toISOString().split('T')[0]
    const rows = await db('payments')
      .select(
        db.raw("DATE_TRUNC('month', payment_date::date) AS month"),
        db.raw('SUM(interest_paid + COALESCE(fine_paid, 0)) AS interest_collected'),
        db.raw('SUM(principal_paid) AS principal_collected'),
        db.raw('COUNT(*) AS payment_count'),
      )
      .whereBetween('payment_date', [from, to])
      .groupByRaw("DATE_TRUNC('month', payment_date::date)")
      .orderBy('month')
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
})

router.get('/reports/monthly-stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()))
    const from = `${year}-01-01`
    const to = `${year}-12-31`

    const [paymentRows, loanRows] = await Promise.all([
      db('payments')
        .select(
          db.raw("TO_CHAR(DATE_TRUNC('month', payment_date::date), 'YYYY-MM') AS month_key"),
          db.raw('SUM(interest_paid + COALESCE(fine_paid, 0)) AS interest_collected'),
          db.raw('SUM(principal_paid) AS principal_collected'),
        )
        .whereBetween('payment_date', [from, to])
        .groupByRaw("DATE_TRUNC('month', payment_date::date)")
        .orderBy('month_key'),
      db('loans')
        .select(
          db.raw("TO_CHAR(DATE_TRUNC('month', issued_date::date), 'YYYY-MM') AS month_key"),
          db.raw('SUM(principal_amount) AS loans_issued'),
        )
        .whereBetween('issued_date', [from, to])
        .groupByRaw("DATE_TRUNC('month', issued_date::date)")
        .orderBy('month_key'),
    ])

    const paymentMap: Record<string, typeof paymentRows[0]> = {}
    paymentRows.forEach((r) => { paymentMap[r.month_key] = r })
    const loanMap: Record<string, typeof loanRows[0]> = {}
    loanRows.forEach((r) => { loanMap[r.month_key] = r })

    const allKeys = [...new Set([...paymentRows.map((r) => r.month_key), ...loanRows.map((r) => r.month_key)])].sort()
    const data = allKeys.map((key) => ({
      month_key: key,
      interest_collected: Number(paymentMap[key]?.interest_collected ?? 0),
      principal_collected: Number(paymentMap[key]?.principal_collected ?? 0),
      loans_issued: Number(loanMap[key]?.loans_issued ?? 0),
    }))

    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// Generate monthly snapshots for all months that have payment or loan data
router.post('/reports/snapshots/generate', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    // Find all distinct months from payments and loans
    const [paymentMonths, loanMonths] = await Promise.all([
      db('payments').select(db.raw("TO_CHAR(DATE_TRUNC('month', payment_date::date), 'YYYY-MM-DD') AS month")).groupByRaw("DATE_TRUNC('month', payment_date::date)"),
      db('loans').select(db.raw("TO_CHAR(DATE_TRUNC('month', issued_date::date), 'YYYY-MM-DD') AS month")).groupByRaw("DATE_TRUNC('month', issued_date::date)"),
    ])

    const allMonths = [...new Set([...paymentMonths.map((r) => r.month), ...loanMonths.map((r) => r.month)])].sort()
    let generated = 0

    for (const monthStart of allMonths) {
      const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0).toISOString().split('T')[0]

      const [payStats, loanStats, closedStats, cashOpen, cashClose, badDebtStats] = await Promise.all([
        db('payments')
          .select(
            db.raw('COALESCE(SUM(amount), 0) AS total_collected'),
            db.raw('COALESCE(SUM(interest_paid), 0) AS interest_collected'),
            db.raw('COALESCE(SUM(principal_paid), 0) AS principal_collected'),
          )
          .whereBetween('payment_date', [monthStart, monthEnd])
          .first(),
        db('loans')
          .select(
            db.raw('COALESCE(SUM(principal_amount), 0) AS total_loan_out'),
            db.raw('COUNT(*) AS new_loans_count'),
          )
          .whereBetween('issued_date', [monthStart, monthEnd])
          .first(),
        db('loans').count('id as cnt').whereBetween('closed_date', [monthStart, monthEnd]).first(),
        db('cash_transactions').select('balance_after').where('txn_date', '<', monthStart).orderBy('id', 'desc').first(),
        db('cash_transactions').select('balance_after').where('txn_date', '<=', monthEnd).orderBy('id', 'desc').first(),
        db('bad_debts').select(db.raw('COALESCE(SUM(total_lost), 0) AS total')).whereBetween('marked_date', [monthStart, monthEnd]).first(),
      ])

      const outstandingRow = await db('loans')
        .sum({ total: db.raw('principal_amount - paid_principal') })
        .whereIn('status', ['active', 'overdue'])
        .first()

      const snapshot = {
        snapshot_month: monthStart,
        opening_cash: Number(cashOpen?.balance_after ?? 0),
        closing_cash: Number(cashClose?.balance_after ?? 0),
        total_loan_out: Number(loanStats?.total_loan_out ?? 0),
        total_collected: Number(payStats?.total_collected ?? 0),
        interest_collected: Number(payStats?.interest_collected ?? 0),
        principal_collected: Number(payStats?.principal_collected ?? 0),
        outstanding_principal: Number(outstandingRow?.total ?? 0),
        new_bad_debt: Number(badDebtStats?.total ?? 0),
        net_profit: Number(payStats?.interest_collected ?? 0),
        active_loans_count: 0,
        new_loans_count: Number(loanStats?.new_loans_count ?? 0),
        closed_loans_count: Number(closedStats?.cnt ?? 0),
        collection_rate: 0,
      }

      await db('monthly_snapshots')
        .insert(snapshot)
        .onConflict('snapshot_month')
        .merge()

      generated++
    }

    res.json({ success: true, data: { generated, months: allMonths } })
  } catch (err) {
    next(err)
  }
})

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db('settings')
    const settings: Record<string, string> = {}
    rows.forEach((r) => { settings[r.key] = r.value })
    res.json({ success: true, data: settings })
  } catch (err) {
    next(err)
  }
})

router.put('/settings', authenticate, requireAdmin, async (req: any, res, next) => {
  try {
    const updates = req.body as Record<string, string>
    const keys = Object.keys(updates)
    const before = await db('settings').whereIn('key', keys)
    const oldValues: Record<string, string> = {}
    before.forEach((r) => { oldValues[r.key] = r.value })

    for (const [key, value] of Object.entries(updates)) {
      await db('settings').where({ key }).update({ value, updated_at: new Date() })
    }

    await logAudit({
      userId: req.user?.userId,
      action: 'UPDATE_SETTINGS',
      entityType: 'settings',
      oldData: oldValues,
      newData: updates,
    })

    res.json({ success: true, data: { message: 'อัพเดทเรียบร้อย' } })
  } catch (err) {
    next(err)
  }
})

// ─── Cash Management ──────────────────────────────────────────────────────────
router.get('/cash/daily', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const from = (req.query.from as string) ?? (req.query.date as string) ?? today
    const to   = (req.query.to   as string) ?? from
    const rows = await db('cash_transactions as ct')
      .leftJoin('loans as l', 'l.id', 'ct.loan_id')
      .leftJoin('customers as c', 'c.id', 'l.customer_id')
      .leftJoin('payments as p', 'p.id', 'ct.payment_id')
      .select(
        'ct.id',
        'ct.txn_number',
        'ct.txn_type',
        'ct.direction',
        'ct.amount',
        'ct.balance_after',
        'ct.description',
        db.raw("to_char(ct.txn_date, 'YYYY-MM-DD') as txn_date"),
        'ct.created_at',
        'l.loan_number',
        'l.loan_type',
        db.raw("CASE WHEN c.id IS NOT NULL THEN c.first_name || ' ' || c.last_name ELSE NULL END AS customer_name"),
        'p.payment_type',
        'p.principal_paid',
        'p.interest_paid',
        'p.fine_paid',
        'p.payment_method',
      )
      .whereRaw('ct.txn_date::date >= ?::date', [from])
      .whereRaw('ct.txn_date::date <= ?::date', [to])
      .orderBy('ct.id', 'desc')
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

router.get('/cash/balance', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const last = await db('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
    const recent = await db('cash_transactions')
      .whereIn('txn_type', ['capital_in', 'capital_out', 'expense'])
      .orderBy('id', 'desc')
      .limit(10)
    res.json({ success: true, data: { currentBalance: Number(last?.balance_after ?? 0), recent } })
  } catch (err) { next(err) }
})

router.post('/cash/set-balance', authenticate, requireAdmin, async (req: any, res, next) => {
  try {
    const { targetBalance, description } = req.body as { targetBalance: number; description?: string }
    if (targetBalance === undefined || targetBalance < 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุยอดเงินสดที่ต้องการ' })
    }
    const last = await db('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
    const currentBalance = Number(last?.balance_after ?? 0)
    const diff = targetBalance - currentBalance
    if (diff === 0) return res.json({ success: true, data: { message: 'ยอดเงินสดไม่มีการเปลี่ยนแปลง', currentBalance } })

    const direction = diff > 0 ? 'in' : 'out'
    const amount = Math.abs(diff)
    const txnType = diff > 0 ? 'capital_in' : 'capital_out'
    const count = await db('cash_transactions').count('id as c').first()
    const txnNum = `CTX-${String(Number((count as any).c) + 1).padStart(4, '0')}`

    await db('cash_transactions').insert({
      txn_number: txnNum,
      txn_type: txnType,
      direction,
      amount,
      balance_after: targetBalance,
      description: description ?? 'ปรับยอดเงินสดเริ่มต้น',
      txn_date: new Date().toISOString().split('T')[0],
      created_by: req.user?.userId ?? null,
      created_at: new Date(),
    })

    await logAudit({
      userId: req.user?.userId,
      action: 'CASH_SET_BALANCE',
      entityType: 'cash',
      newData: { targetBalance, diff, description },
    })

    res.json({ success: true, data: { newBalance: targetBalance, diff } })
  } catch (err) { next(err) }
})

router.post('/cash/adjust', authenticate, requireAdmin, async (req: any, res, next) => {
  try {
    const { type, amount, description, txnDate } = req.body as {
      type: 'capital_in' | 'capital_out' | 'expense'
      amount: number
      description?: string
      txnDate?: string
    }
    if (!type || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
    }
    const last = await db('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
    const prevBalance = Number(last?.balance_after ?? 0)
    const direction = type === 'capital_in' ? 'in' : 'out'
    const newBalance = direction === 'in' ? prevBalance + Number(amount) : prevBalance - Number(amount)

    // Generate txn_number
    const count = await db('cash_transactions').count('id as c').first()
    const txnNum = `CTX-${String(Number((count as any).c) + 1).padStart(4, '0')}`

    const [row] = await db('cash_transactions')
      .insert({
        txn_number: txnNum,
        txn_type: type,
        direction,
        amount: Number(amount),
        balance_after: newBalance,
        description: description ?? '',
        txn_date: txnDate ?? new Date().toISOString().split('T')[0],
        created_by: req.user?.userId ?? null,
        created_at: new Date(),
      })
      .returning('*')

    await logAudit({
      userId: req.user?.userId,
      action: 'CASH_ADJUST',
      entityType: 'cash',
      entityId: row.id,
      newData: { type, amount, description },
    })

    res.json({ success: true, data: { ...row, newBalance } })
  } catch (err) { next(err) }
})

// ─── Audit Logs (Admin) ───────────────────────────────────────────────────────
router.get('/audit-logs', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 50)
    const dateFrom = req.query.dateFrom as string | undefined
    const dateTo = req.query.dateTo as string | undefined

    const applyDateFilter = (q: any) => {
      if (dateFrom) q = q.whereRaw('a.created_at::date >= ?::date', [dateFrom])
      if (dateTo) q = q.whereRaw('a.created_at::date <= ?::date', [dateTo])
      return q
    }

    const [rows, totalRow] = await Promise.all([
      applyDateFilter(
        db('audit_logs as a')
          .leftJoin('users as u', 'u.id', 'a.user_id')
          // Resolve "who/what this action was about" — entity_id is polymorphic
          // (loan/customer/user/bad_debt id), so each join only matches its own entity_type.
          .joinRaw("LEFT JOIN loans l ON a.entity_type = 'loan' AND l.id = a.entity_id")
          .joinRaw("LEFT JOIN customers lc ON lc.id = l.customer_id")
          .joinRaw("LEFT JOIN customers cust ON a.entity_type = 'customer' AND cust.id = a.entity_id")
          .joinRaw("LEFT JOIN users au ON a.entity_type = 'user' AND au.id = a.entity_id")
          .joinRaw("LEFT JOIN bad_debts bd ON a.entity_type = 'bad_debt' AND bd.id = a.entity_id")
          .joinRaw('LEFT JOIN loans bdl ON bdl.id = bd.loan_id')
          .joinRaw('LEFT JOIN customers bdc ON bdc.id = bdl.customer_id')
          .select(
            'a.id', 'a.action', 'a.entity_type', 'a.entity_id',
            'a.old_data', 'a.new_data', 'a.created_at',
            'u.full_name as user_full_name', 'u.username',
            db.raw("COALESCE(l.loan_number, bdl.loan_number, cust.code, au.username) as target_ref"),
            db.raw("COALESCE(lc.first_name || ' ' || lc.last_name, bdc.first_name || ' ' || bdc.last_name, cust.first_name || ' ' || cust.last_name, au.full_name) as target_name"),
          ),
      )
        .orderBy('a.id', 'desc')
        .limit(limit)
        .offset((page - 1) * limit),
      applyDateFilter(db('audit_logs as a')).count('a.id as c').first(),
    ])
    res.json({
      success: true,
      data: rows,
      meta: { total: Number((totalRow as any)?.c ?? 0), page, limit },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Users (Admin) ────────────────────────────────────────────────────────────
router.get('/users', authenticate, requireAdmin, userController.list)
router.post('/users', authenticate, requireAdmin, userController.create)
router.put('/users/:id', authenticate, requireAdmin, userController.update)
router.put('/users/:id/password', authenticate, requireAdmin, userController.resetPassword)
router.delete('/users/:id', authenticate, requireAdmin, userController.remove)

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get('/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1')
    res.json({ success: true, data: { status: 'ok', db: 'connected' } })
  } catch {
    res.status(503).json({ success: false, data: { status: 'error', db: 'disconnected' } })
  }
})

export default router
