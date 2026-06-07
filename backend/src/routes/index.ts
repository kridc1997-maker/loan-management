import { Router } from 'express'
import { authController } from '../controllers/authController'
import { customerController } from '../controllers/customerController'
import { loanController } from '../controllers/loanController'
import { dashboardController } from '../controllers/dashboardController'
import { badDebtController } from '../controllers/badDebtController'
import { userController } from '../controllers/userController'
import { authenticate, requireAdmin } from '../middleware/auth'
import db from '../db/connection'

const router = Router()

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', authController.login)
router.post('/auth/refresh', authController.refresh)
router.get('/auth/me', authenticate, authController.me)

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard/summary', authenticate, dashboardController.summary)
router.get('/dashboard/cash-flow', authenticate, dashboardController.cashFlow)
router.get('/dashboard/due-today', authenticate, dashboardController.dueToday)
router.get('/dashboard/top-customers', authenticate, dashboardController.topCustomers)
router.get('/dashboard/overdue', authenticate, dashboardController.overdueSummary)

// ─── Customers ────────────────────────────────────────────────────────────────
router.get('/customers', authenticate, customerController.list)
router.post('/customers', authenticate, customerController.create)
router.get('/customers/:id', authenticate, customerController.get)
router.put('/customers/:id', authenticate, customerController.update)
router.get('/customers/:id/loans', authenticate, customerController.loans)

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
router.post('/loans/:id/convert-to-flexible', authenticate, loanController.convertToFlexible)
router.put('/loans/:id/due-date', authenticate, loanController.updateDueDate)

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

// ─── Bad Debts ────────────────────────────────────────────────────────────────
router.get('/bad-debts', authenticate, badDebtController.list)
router.put('/bad-debts/:id/recover', authenticate, badDebtController.recover)

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/monthly', authenticate, async (req, res, next) => {
  try {
    const rows = await db('monthly_snapshots').orderBy('snapshot_month', 'desc').limit(12)
    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
})

router.get('/reports/profit', authenticate, async (req, res, next) => {
  try {
    const from = req.query.from as string ?? new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const to = req.query.to as string ?? new Date().toISOString().split('T')[0]
    const rows = await db('payments')
      .select(
        db.raw("DATE_TRUNC('month', payment_date::date) AS month"),
        db.raw('SUM(interest_paid) AS interest_collected'),
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

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', authenticate, async (_req, res, next) => {
  try {
    const rows = await db('settings')
    const settings: Record<string, string> = {}
    rows.forEach((r) => { settings[r.key] = r.value })
    res.json({ success: true, data: settings })
  } catch (err) {
    next(err)
  }
})

router.put('/settings', authenticate, async (req, res, next) => {
  try {
    const updates = req.body as Record<string, string>
    for (const [key, value] of Object.entries(updates)) {
      await db('settings').where({ key }).update({ value, updated_at: new Date() })
    }
    res.json({ success: true, data: { message: 'อัพเดทเรียบร้อย' } })
  } catch (err) {
    next(err)
  }
})

// ─── Cash Management ──────────────────────────────────────────────────────────
router.get('/cash/balance', authenticate, async (_req, res, next) => {
  try {
    const last = await db('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
    const recent = await db('cash_transactions')
      .whereIn('txn_type', ['capital_in', 'capital_out', 'expense'])
      .orderBy('id', 'desc')
      .limit(10)
    res.json({ success: true, data: { currentBalance: Number(last?.balance_after ?? 0), recent } })
  } catch (err) { next(err) }
})

router.post('/cash/set-balance', authenticate, async (req: any, res, next) => {
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

    res.json({ success: true, data: { newBalance: targetBalance, diff } })
  } catch (err) { next(err) }
})

router.post('/cash/adjust', authenticate, async (req: any, res, next) => {
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

    res.json({ success: true, data: { ...row, newBalance } })
  } catch (err) { next(err) }
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
