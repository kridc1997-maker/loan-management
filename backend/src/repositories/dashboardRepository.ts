import db from '../db/connection'

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
      // Profit today — interest + fine (daily loans excluded via loan_type column)
      db('payments')
        .select(db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total'))
        .whereRaw("payment_date::date = ?::date", [today])
        .where((q) => q.whereNot('loan_type', 'daily').orWhereNull('loan_type'))
        .first(),
      // Profit this month — interest + fine (daily loans excluded via loan_type column)
      db('payments')
        .select(db.raw('COALESCE(SUM(interest_paid + COALESCE(fine_paid, 0)), 0) as total'))
        .whereRaw("payment_date::date >= ?::date", [monthStart])
        .where((q) => q.whereNot('loan_type', 'daily').orWhereNull('loan_type'))
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
      )
      .join('customers as c', 'c.id', 'l.customer_id')
      .groupBy('l.customer_id', 'c.first_name', 'c.last_name')
      .orderBy('total_interest_paid', 'desc')
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
}
