import db from '../db/connection'
import { CREDIT_SCORE_SQL } from './customerRepository'

export const dashboardRepo = {
  async getSummary() {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = `${today.slice(0, 7)}-01`

    const [
      cashRow,
      principalRow,
      overdueRow,
      badDebtRow,
      activeCountRow,
      profitTodayRow,
      profitMonthRow,
      expectedProfitRow,
      installmentStats,
      newLoansToday,
      expectedTodayRow,
      expenseMonthRow,
      forecast7Raw,
    ] = await Promise.all([
      // Latest cash balance
      db('cash_transactions').select('balance_after').orderBy('id', 'desc').first(),
      // Outstanding principal
      db('loans').sum({ total: db.raw('principal_amount - paid_principal') }).whereIn('status', ['active', 'overdue']).first(),
      // Overdue
      db('loans').whereIn('status', ['overdue']).select(db.raw('COUNT(*) AS count'), db.raw('SUM(total_amount - paid_principal - paid_interest) AS amount')).first(),
      // Bad debt
      db('bad_debts').where('is_recovered', false).select(db.raw('COUNT(*) AS count'), db.raw('SUM(total_lost) AS amount')).first(),
      // Active count
      db('loans').whereIn('status', ['active', 'overdue']).count('id as count').first(),
      // Profit today — sum interest_paid + fine_paid across all loan types
      db('payments')
        .select(db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total'))
        .whereRaw("payment_date::date = ?::date", [today])
        .first(),
      // Profit this month — sum interest_paid + fine_paid across all loan types
      db('payments')
        .select(db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total'))
        .whereRaw("payment_date::date >= ?::date", [monthStart])
        .first(),
      // Expected profit
      db('loans').sum({ total: db.raw('(total_amount - principal_amount) - paid_interest') }).whereIn('status', ['active', 'overdue']).first(),
      // Collection rate: paid / due installments (last 30 days)
      db('loan_installments')
        .select(db.raw('COUNT(*) AS total_due'), db.raw("COUNT(*) FILTER (WHERE status = 'paid') AS total_paid"))
        .where('due_date', '>=', db.raw(`CURRENT_DATE - INTERVAL '30 days'`))
        .where('due_date', '<=', today)
        .first(),
      // New loans today
      db('loans').whereRaw("issued_date::date = ?::date", [today]).count('id as count').first(),
      // Total received today (actual amount collected)
      db('payments').sum('amount as total').whereRaw("payment_date::date = ?::date", [today]).first(),
      // Expense/capital this month from cash_transactions
      db('cash_transactions')
        .select(
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'expense' THEN amount ELSE 0 END), 0) AS expense_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_out' THEN amount ELSE 0 END), 0) AS capital_out_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_in' THEN amount ELSE 0 END), 0) AS capital_in_total"),
        )
        .whereIn('txn_type', ['expense', 'capital_out', 'capital_in'])
        .whereRaw('txn_date::date >= ?::date', [monthStart])
        .first(),
      db.raw(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM (
          SELECT (li.amount_due - li.paid_amount) AS amount
          FROM loan_installments li
          JOIN loans l ON l.id = li.loan_id
          WHERE l.status IN ('active','overdue')
            AND li.status NOT IN ('paid')
            AND li.due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
          UNION ALL
          SELECT (l.total_amount - l.paid_principal - l.paid_interest) AS amount
          FROM loans l
          WHERE l.status IN ('active','overdue')
            AND l.loan_type IN ('single','flexible')
            AND l.due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
        ) sub
      `),
    ])

    const cashOnHand = Number(cashRow?.balance_after ?? 0)
    const outstandingPrincipal = Number(principalRow?.total ?? 0)
    const totalPaid = Number(installmentStats?.total_paid ?? 0)
    const totalDue = Number(installmentStats?.total_due ?? 0)

    return {
      cashOnHand,
      outstandingPrincipal,
      totalAsset: cashOnHand + outstandingPrincipal,
      profitToday: Number(profitTodayRow?.total ?? 0),
      profitThisMonth: Number(profitMonthRow?.total ?? 0),
      expectedProfit: Number(expectedProfitRow?.total ?? 0),
      overdueCount: Number(overdueRow?.count ?? 0),
      overdueAmount: Number(overdueRow?.amount ?? 0),
      badDebtCount: Number(badDebtRow?.count ?? 0),
      badDebtAmount: Number(badDebtRow?.amount ?? 0),
      collectionRate: totalDue > 0 ? totalPaid / totalDue : 0,
      activeLoansCount: Number(activeCountRow?.count ?? 0),
      newLoansToday: Number(newLoansToday?.count ?? 0),
      receivedToday: Number(expectedTodayRow?.total ?? 0),
      expenseThisMonth: Number(expenseMonthRow?.expense_total ?? 0),
      capitalOutThisMonth: Number(expenseMonthRow?.capital_out_total ?? 0),
      capitalInThisMonth: Number(expenseMonthRow?.capital_in_total ?? 0),
      forecast7Days: Number((forecast7Raw as any).rows?.[0]?.total ?? 0),
    }
  },

  async getCashFlow(days = 30) {
    const rows = await db('cash_transactions')
      .select(db.raw("to_char(txn_date, 'YYYY-MM-DD') as txn_date"), 'direction', db.raw('SUM(amount) AS total'))
      .where('txn_date', '>=', db.raw(`CURRENT_DATE - INTERVAL '${days} days'`))
      .groupByRaw("to_char(txn_date, 'YYYY-MM-DD'), direction")
      .orderByRaw("to_char(txn_date, 'YYYY-MM-DD')")

    // Pivot by day
    const map: Record<string, { in: number; out: number }> = {}
    for (const r of rows) {
      const d = String(r.txn_date)
      if (!map[d]) map[d] = { in: 0, out: 0 }
      map[d][r.direction as 'in' | 'out'] += Number(r.total)
    }

    const lastBalance = await db('cash_transactions').select('balance_after').orderBy('id', 'desc').first()
    const currentBalance = Number(lastBalance?.balance_after ?? 0)
    const daily = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, in: v.in, out: v.out, net: v.in - v.out, balance: 0 }))

    // compute running balance backward from current
    let balance = currentBalance
    for (let i = daily.length - 1; i >= 0; i--) {
      daily[i].balance = balance
      balance -= daily[i].net
    }

    const totalIn = daily.reduce((s, d) => s + d.in, 0)
    const totalOut = daily.reduce((s, d) => s + d.out, 0)
    return { totalIn, totalOut, netFlow: totalIn - totalOut, daily }
  },

  async getTopCustomers(limit = 10) {
    return db('loans as l')
      .select(
        'l.customer_id',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
        db.raw('COUNT(l.id) AS loan_count'),
        db.raw("COUNT(l.id) FILTER (WHERE l.status = 'completed') AS closed_loans_count"),
        db.raw('SUM(l.principal_amount) AS total_borrowed'),
        db.raw('SUM(l.paid_interest) AS total_interest_paid'),
        db.raw('SUM(l.total_amount - l.principal_amount) AS total_interest_expected'),
        db.raw(CREDIT_SCORE_SQL),
      )
      .join('customers as c', 'c.id', 'l.customer_id')
      .groupBy('l.customer_id', 'c.id', 'c.first_name', 'c.last_name')
      .orderByRaw('credit_score DESC NULLS LAST')
      .limit(limit)
  },

  async getOverdueSummary() {
    const today = new Date().toISOString().split('T')[0]
    return db('loans as l')
      .select(
        'l.*',
        db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
        'c.phone AS customer_phone',
        db.raw(`(CURRENT_DATE - l.due_date::date) AS days_overdue`),
        db.raw('l.total_amount - l.paid_principal - l.paid_interest AS outstanding'),
      )
      .join('customers as c', 'c.id', 'l.customer_id')
      .whereIn('l.status', ['overdue'])
      .orderBy('days_overdue', 'desc')
  },

  async getExecutiveDashboard() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const monthStart = `${today.slice(0, 7)}-01`
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    const sevenDaysLater = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0]
    const dayOfWeek = now.getDay() // 0=Sun..6=Sat
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now.getTime() - daysSinceMonday * 86400000).toISOString().split('T')[0]
    const lastWeekStart = new Date(now.getTime() - (daysSinceMonday + 7) * 86400000).toISOString().split('T')[0]
    const lastWeekEnd = new Date(now.getTime() - (daysSinceMonday + 1) * 86400000).toISOString().split('T')[0]

    const [
      cashRow,
      yesterdayCashRow,
      portfolioRow,
      profitMonthRow,
      profitLastMonthRow,
      overdueRow,
      badDebtRow,
      portfolioByTypeRows,
      forecastInstallmentRows,
      forecastSingleRows,
      revenueTrendRows,
      portfolioGrowthRows,
      expenseMonthRow,
      expectedProfitRow,
      expectedProfitThisMonthRow,
      profitTodayRow,
      receivedTodayRow,
      profitWeekRow,
      profitLastWeekRow,
      expenseWeekRow,
      profitYesterdayRow,
      expenseTodayRow,
      totalAssetTrendRaw,
    ] = await Promise.all([
      db('cash_transactions').select('balance_after').orderBy('id', 'desc').first(),
      db('cash_transactions')
        .select('balance_after')
        .whereRaw('txn_date::date <= ?::date', [yesterday])
        .orderBy('id', 'desc')
        .first(),
      db('loans')
        .whereIn('status', ['active', 'overdue'])
        .select(
          db.raw('COALESCE(SUM(principal_amount - paid_principal), 0) AS outstanding_principal'),
          db.raw('COUNT(*) AS active_count'),
        )
        .first(),
      db('payments')
        .whereRaw('payment_date::date >= ?::date', [monthStart])
        .select(db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) AS total'))
        .first(),
      db('payments')
        .whereRaw('payment_date::date >= ?::date', [lastMonthStart])
        .whereRaw('payment_date::date <= ?::date', [lastMonthEnd])
        .select(db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) AS total'))
        .first(),
      db('loans')
        .whereIn('status', ['overdue'])
        .select(
          db.raw('COUNT(*) AS count'),
          db.raw('COALESCE(SUM(principal_amount - paid_principal), 0) AS amount'),
        )
        .first(),
      db('bad_debts')
        .where('is_recovered', false)
        .select(
          db.raw('COUNT(*) AS count'),
          db.raw('COALESCE(SUM(total_lost), 0) AS amount'),
        )
        .first(),
      db('loans')
        .whereIn('status', ['active', 'overdue'])
        .select(
          'loan_type',
          db.raw('COALESCE(SUM(principal_amount - paid_principal), 0) AS amount'),
          db.raw('COUNT(*) AS count'),
        )
        .groupBy('loan_type'),
      db('loan_installments as li')
        .join('loans as l', 'l.id', 'li.loan_id')
        .whereIn('l.status', ['active', 'overdue'])
        .whereNotIn('li.status', ['paid'])
        .whereRaw('li.due_date::date >= ?::date', [today])
        .whereRaw('li.due_date::date <= ?::date', [sevenDaysLater])
        .select(
          db.raw("to_char(li.due_date::date, 'YYYY-MM-DD') AS due_date"),
          db.raw('COALESCE(SUM(li.amount_due - li.paid_amount), 0) AS amount'),
        )
        .groupByRaw("to_char(li.due_date::date, 'YYYY-MM-DD')")
        .orderByRaw("to_char(li.due_date::date, 'YYYY-MM-DD')"),
      db('loans')
        .whereIn('status', ['active', 'overdue'])
        .whereIn('loan_type', ['single', 'flexible'])
        .whereRaw('due_date::date >= ?::date', [today])
        .whereRaw('due_date::date <= ?::date', [sevenDaysLater])
        .select(
          db.raw("to_char(due_date::date, 'YYYY-MM-DD') AS due_date"),
          db.raw('COALESCE(SUM(total_amount - paid_principal - paid_interest), 0) AS amount'),
        )
        .groupByRaw("to_char(due_date::date, 'YYYY-MM-DD')")
        .orderByRaw("to_char(due_date::date, 'YYYY-MM-DD')"),
      db('payments')
        .whereRaw('payment_date::date >= ?::date', [twelveMonthsAgo])
        .select(
          db.raw("TO_CHAR(DATE_TRUNC('month', payment_date::date), 'YYYY-MM') AS month"),
          db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) AS interest'),
        )
        .groupByRaw("DATE_TRUNC('month', payment_date::date)")
        .orderBy('month'),
      db('monthly_snapshots')
        .whereRaw('snapshot_month >= ?::date', [twelveMonthsAgo])
        .select('snapshot_month', 'outstanding_principal', 'interest_collected')
        .orderBy('snapshot_month'),
      db('cash_transactions')
        .select(
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'expense' THEN amount ELSE 0 END), 0) AS expense_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_out' THEN amount ELSE 0 END), 0) AS capital_out_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_in' THEN amount ELSE 0 END), 0) AS capital_in_total"),
        )
        .whereIn('txn_type', ['expense', 'capital_out', 'capital_in'])
        .whereRaw('txn_date::date >= ?::date', [monthStart])
        .first(),
      db('loans').sum({ total: db.raw('(total_amount - principal_amount) - paid_interest') }).whereIn('status', ['active', 'overdue']).first(),
      db.raw(`
        SELECT
          COALESCE((
            SELECT SUM(li.interest_portion)
            FROM loan_installments li
            JOIN loans l ON l.id = li.loan_id
            WHERE l.status IN ('active', 'overdue')
              AND li.status != 'paid'
              AND li.due_date::date >= ?::date AND li.due_date::date <= ?::date
          ), 0)
          +
          COALESCE((
            SELECT SUM(l.total_amount - l.principal_amount - l.paid_interest)
            FROM loans l
            WHERE l.status IN ('active', 'overdue')
              AND l.loan_type IN ('single', 'flexible')
              AND l.due_date::date >= ?::date AND l.due_date::date <= ?::date
          ), 0)
          AS total
      `, [monthStart, monthEnd, monthStart, monthEnd]),
      db('payments')
        .select(db.raw("COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total"))
        .whereRaw("payment_date::date = ?::date", [today])
        .first(),
      db('payments').sum('amount as total').whereRaw("payment_date::date = ?::date", [today]).first(),
      db('payments')
        .select(db.raw("COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total"))
        .whereRaw("payment_date::date >= ?::date", [weekStart])
        .first(),
      db('payments')
        .select(db.raw("COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total"))
        .whereRaw("payment_date::date >= ?::date AND payment_date::date <= ?::date", [lastWeekStart, lastWeekEnd])
        .first(),
      db('cash_transactions')
        .select(
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'expense' THEN amount ELSE 0 END), 0) AS expense_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_out' THEN amount ELSE 0 END), 0) AS capital_out_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_in' THEN amount ELSE 0 END), 0) AS capital_in_total"),
        )
        .whereIn('txn_type', ['expense', 'capital_out', 'capital_in'])
        .whereRaw('txn_date::date >= ?::date', [weekStart])
        .first(),
      db('payments')
        .select(db.raw("COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total"))
        .whereRaw("payment_date::date = ?::date", [yesterday])
        .first(),
      db('cash_transactions')
        .select(
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'expense' THEN amount ELSE 0 END), 0) AS expense_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_out' THEN amount ELSE 0 END), 0) AS capital_out_total"),
          db.raw("COALESCE(SUM(CASE WHEN txn_type = 'capital_in' THEN amount ELSE 0 END), 0) AS capital_in_total"),
        )
        .whereIn('txn_type', ['expense', 'capital_out', 'capital_in'])
        .whereRaw('txn_date::date = ?::date', [today])
        .first(),
      // Reconstruct daily cash-on-hand (last ledger balance on/before each day) and outstanding
      // principal (cumulative disbursed minus cumulative principal collected as of each day) —
      // works retroactively over real history without needing a daily-snapshot job.
      //
      // A loan counts as outstanding on day d if it existed by then (issued_date <= d) and wasn't
      // yet closed as of that day. Filtering by the loan's CURRENT status instead (as this used to)
      // silently drops any loan that has since been paid off from every past day too — undercounting
      // history by however much has closed since. closed_date is the correct historical signal;
      // status is only a fallback for the (should-be-rare) case of a loan marked completed without
      // closed_date ever having been set, where we conservatively treat it as already closed rather
      // than open forever. bad_debt/written_off are excluded throughout, matching the live
      // "เงินต้นคงค้าง" KPI's definition.
      db.raw(`
        SELECT
          to_char(d.date, 'YYYY-MM-DD') AS date,
          COALESCE((
            SELECT ct.balance_after FROM cash_transactions ct
            WHERE ct.txn_date::date <= d.date
            ORDER BY ct.id DESC LIMIT 1
          ), 0) AS cash_on_hand,
          COALESCE((
            SELECT SUM(l.principal_amount) FROM loans l
            WHERE l.issued_date::date <= d.date
              AND l.status NOT IN ('bad_debt', 'written_off')
              AND (
                (l.closed_date IS NOT NULL AND l.closed_date::date > d.date)
                OR (l.closed_date IS NULL AND l.status IN ('active', 'overdue'))
              )
          ), 0) - COALESCE((
            SELECT SUM(p.principal_paid) FROM payments p JOIN loans l2 ON l2.id = p.loan_id
            WHERE p.payment_date::date <= d.date
              AND l2.status NOT IN ('bad_debt', 'written_off')
              AND (
                (l2.closed_date IS NOT NULL AND l2.closed_date::date > d.date)
                OR (l2.closed_date IS NULL AND l2.status IN ('active', 'overdue'))
              )
          ), 0) AS outstanding_principal
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(date)
        ORDER BY d.date
      `),
    ])

    const [repeatRaw, riskMonitorRaw, topCustomersRaw] = await Promise.all([
      db.raw(`
        SELECT
          COUNT(DISTINCT customer_id)::int AS total_customers,
          COUNT(DISTINCT CASE WHEN loan_count > 1 THEN customer_id END)::int AS repeat_customers
        FROM (SELECT customer_id, COUNT(*) AS loan_count FROM loans GROUP BY customer_id) sub
      `),
      db.raw(`
        SELECT
          l.id AS loan_id, l.loan_number, l.customer_id,
          c.first_name || ' ' || c.last_name AS customer_name,
          (l.principal_amount - l.paid_principal)::numeric AS outstanding,
          GREATEST(0, (CURRENT_DATE - l.due_date::date))::int AS days_overdue,
          COALESCE(rc.rollover_count, 0)::int AS rollover_count,
          l.status, c.risk_level,
          to_char(l.due_date, 'YYYY-MM-DD') AS due_date
        FROM loans l
        JOIN customers c ON c.id = l.customer_id
        LEFT JOIN (
          SELECT p.loan_id, COUNT(p.id)::int AS rollover_count
          FROM payments p
          WHERE p.payment_type = 'rollover'
          GROUP BY p.loan_id
        ) rc ON rc.loan_id = l.id
        WHERE l.status IN ('active', 'overdue')
          AND (
            l.status = 'overdue'
            OR COALESCE(rc.rollover_count, 0) >= 2
            OR c.risk_level IN ('high', 'blacklist')
            OR l.due_date::date <= CURRENT_DATE + INTERVAL '7 days'
          )
        ORDER BY
          CASE l.status WHEN 'overdue' THEN 0 ELSE 1 END,
          GREATEST(0, (CURRENT_DATE - l.due_date::date)) DESC,
          COALESCE(rc.rollover_count, 0) DESC,
          (l.principal_amount - l.paid_principal) DESC
        LIMIT 20
      `),
      db.raw(`
        SELECT
          l.customer_id,
          c.first_name || ' ' || c.last_name AS customer_name,
          COUNT(DISTINCT l.id)::int AS total_loan_count,
          COALESCE(SUM(CASE WHEN l.status IN ('active','overdue') THEN l.principal_amount - l.paid_principal ELSE 0 END), 0)::numeric AS outstanding_principal,
          COALESCE((
            SELECT SUM(p2.interest_paid + COALESCE(p2.fine_paid, 0))
            FROM payments p2
            JOIN loans l2 ON l2.id = p2.loan_id
            WHERE l2.customer_id = l.customer_id
          ), 0)::numeric AS total_interest_paid,
          to_char(MIN(l.issued_date), 'YYYY-MM-DD') AS first_loan_date,
          CASE WHEN COUNT(CASE WHEN l.status = 'overdue' THEN 1 END) > 0 THEN 'overdue' ELSE 'active' END AS current_status
        FROM loans l
        JOIN customers c ON c.id = l.customer_id
        WHERE l.status IN ('active', 'overdue')
        GROUP BY l.customer_id, c.id, c.first_name, c.last_name
        ORDER BY outstanding_principal DESC
        LIMIT 10
      `),
    ])

    // ── Computed values ────────────────────────────────────────────────────────
    const cashOnHand = Number(cashRow?.balance_after ?? 0)
    const cashYesterday = Number(yesterdayCashRow?.balance_after ?? 0)
    const outstandingPrincipal = Number(portfolioRow?.outstanding_principal ?? 0)
    const activeLoansCount = Number(portfolioRow?.active_count ?? 0)
    const profitThisMonth = Number(profitMonthRow?.total ?? 0)
    const profitLastMonth = Number(profitLastMonthRow?.total ?? 0)
    const overdueCount = Number(overdueRow?.count ?? 0)
    const overdueAmount = Number(overdueRow?.amount ?? 0)
    const badDebtCount = Number(badDebtRow?.count ?? 0)
    const badDebtAmount = Number(badDebtRow?.amount ?? 0)
    const totalAsset = cashOnHand + outstandingPrincipal

    const expenseThisMonth = Number(expenseMonthRow?.expense_total ?? 0)
    const capitalOutThisMonth = Number(expenseMonthRow?.capital_out_total ?? 0)
    const capitalInThisMonth = Number(expenseMonthRow?.capital_in_total ?? 0)
    const netExpense = expenseThisMonth + capitalOutThisMonth

    const expectedProfit = Number((expectedProfitRow as any)?.total ?? 0)
    const expectedProfitThisMonth = Number((expectedProfitThisMonthRow as any).rows?.[0]?.total ?? 0)
    const profitToday = Number((profitTodayRow as any)?.total ?? 0)
    const receivedToday = Number((receivedTodayRow as any)?.total ?? 0)
    const profitThisWeek = Number((profitWeekRow as any)?.total ?? 0)
    const profitLastWeek = Number((profitLastWeekRow as any)?.total ?? 0)
    const expenseThisWeek = Number((expenseWeekRow as any)?.expense_total ?? 0)
    const capitalOutThisWeek = Number((expenseWeekRow as any)?.capital_out_total ?? 0)
    const capitalInThisWeek = Number((expenseWeekRow as any)?.capital_in_total ?? 0)
    const netExpenseThisWeek = expenseThisWeek + capitalOutThisWeek
    const profitYesterday = Number((profitYesterdayRow as any)?.total ?? 0)
    const expenseToday = Number((expenseTodayRow as any)?.expense_total ?? 0)
    const capitalOutToday = Number((expenseTodayRow as any)?.capital_out_total ?? 0)
    const capitalInToday = Number((expenseTodayRow as any)?.capital_in_total ?? 0)
    const netExpenseToday = expenseToday + capitalOutToday

    const repeatData = (repeatRaw as any).rows?.[0] ?? {}
    const totalCustomers = Number(repeatData.total_customers ?? 0)
    const repeatCustomers = Number(repeatData.repeat_customers ?? 0)
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0

    // 7-day cash forecast
    const forecastMap: Record<string, number> = {}
    for (const r of forecastInstallmentRows) {
      const d = String(r.due_date)
      forecastMap[d] = (forecastMap[d] ?? 0) + Number(r.amount)
    }
    for (const r of forecastSingleRows) {
      const d = String(r.due_date)
      forecastMap[d] = (forecastMap[d] ?? 0) + Number(r.amount)
    }
    const cashForecast = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() + i * 86400000).toISOString().split('T')[0]
      return { date: d, amount: forecastMap[d] ?? 0 }
    })
    const forecast7Days = cashForecast.reduce((s, r) => s + r.amount, 0)

    // KPI derivations
    const nplBase = outstandingPrincipal + badDebtAmount
    const nplRate = nplBase > 0 ? badDebtAmount / nplBase : 0
    const roi = outstandingPrincipal > 0 ? (profitThisMonth / outstandingPrincipal) * 100 : 0
    const cashUtilization = totalAsset > 0 ? (outstandingPrincipal / totalAsset) * 100 : 0
    const averageLoan = activeLoansCount > 0 ? outstandingPrincipal / activeLoansCount : 0

    // Health score (0–100)
    const nplScore = nplRate === 0 ? 30 : nplRate < 0.05 ? 20 : nplRate < 0.10 ? 10 : 0
    const overdueScore = overdueCount === 0 ? 30 : overdueCount <= 5 ? 20 : overdueCount <= 10 ? 10 : 0
    const activeScore = activeLoansCount > 0 ? 20 : 0
    const badDebtScore = badDebtCount === 0 ? 20 : nplRate < 0.05 ? 10 : 0
    const healthScore = nplScore + overdueScore + activeScore + badDebtScore

    // Total asset trend (30 days)
    const totalAssetTrend = ((totalAssetTrendRaw as any).rows ?? []).map((r: any) => {
      const cashOnHand = Number(r.cash_on_hand)
      const outstandingPrincipal = Number(r.outstanding_principal)
      return { date: r.date, cashOnHand, outstandingPrincipal, totalAsset: cashOnHand + outstandingPrincipal }
    })

    // Revenue trend (12 months)
    const revenueTrendMap: Record<string, number> = {}
    for (const r of revenueTrendRows) { revenueTrendMap[String(r.month)] = Number(r.interest) }
    const revenueTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { month: key, interest: revenueTrendMap[key] ?? 0 }
    })

    // Portfolio growth (12 months from snapshots)
    const snapshotMap: Record<string, { outstanding: number; profit: number }> = {}
    for (const r of portfolioGrowthRows) {
      const raw = r.snapshot_month
      const key = typeof raw === 'string' ? raw.slice(0, 7) : new Date(raw).toISOString().slice(0, 7)
      snapshotMap[key] = {
        outstanding: Number(r.outstanding_principal ?? 0),
        profit: Number(r.interest_collected ?? 0),
      }
    }
    let cumProfit = 0
    const portfolioGrowth = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const snap = snapshotMap[key]
      cumProfit += snap?.profit ?? 0
      const outstanding = snap?.outstanding ?? (i === 11 ? outstandingPrincipal : 0)
      return { month: key, outstanding, cumulativeProfit: cumProfit }
    })

    return {
      kpi: {
        cashOnHand, cashYesterday,
        outstandingPrincipal, activeLoansCount,
        profitThisMonth, profitLastMonth,
        roi, nplRate, nplAmount: badDebtAmount,
        overdueCount, overdueAmount,
        badDebtCount, badDebtAmount,
        totalCustomers, repeatCustomers, repeatCustomerRate,
        forecast7Days, cashUtilization, totalAsset, averageLoan,
        healthScore,
        healthNplScore: nplScore,
        healthOverdueScore: overdueScore,
        healthActiveScore: activeScore,
        healthBadDebtScore: badDebtScore,
        expenseThisMonth, capitalOutThisMonth, capitalInThisMonth, netExpense,
        expectedProfit, expectedProfitThisMonth, profitToday, receivedToday,
        profitThisWeek, profitLastWeek, expenseThisWeek, capitalOutThisWeek, capitalInThisWeek, netExpenseThisWeek,
        profitYesterday, expenseToday, capitalOutToday, capitalInToday, netExpenseToday,
      },
      cashForecast,
      portfolioByType: portfolioByTypeRows.map((r: any) => ({
        loanType: r.loan_type as string,
        amount: Number(r.amount),
        count: Number(r.count),
      })),
      revenueTrend,
      portfolioGrowth,
      totalAssetTrend,
      topCustomers: ((topCustomersRaw as any).rows ?? []).map((r: any) => ({
        customerId: r.customer_id,
        customerName: r.customer_name,
        loanCount: r.total_loan_count,
        outstandingPrincipal: Number(r.outstanding_principal),
        totalInterestPaid: Number(r.total_interest_paid),
        customerSince: String(r.first_loan_date ?? '').split('T')[0],
        status: r.current_status,
      })),
      riskMonitor: ((riskMonitorRaw as any).rows ?? []).map((r: any) => ({
        loanId: r.loan_id,
        loanNumber: r.loan_number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        outstandingAmount: Number(r.outstanding),
        daysOverdue: Number(r.days_overdue ?? 0),
        rolloverCount: Number(r.rollover_count ?? 0),
        status: r.status,
        riskLevel: r.risk_level,
        dueDate: String(r.due_date ?? ''),
      })),
    }
  },
}
