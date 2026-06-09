import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, TrendingUp, PiggyBank, BadgeDollarSign,
  AlertTriangle, Users, CheckCircle, Phone, Landmark, Receipt,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import KpiCard from '../components/ui/KpiCard'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatPercent, overdueBadgeClass, daysOverdue, isInstallmentBased } from '../utils/financial'
import { dashboardApi, paymentApi } from '../api/endpoints'
import type { DashboardSummary, CashFlowSummary, TopCustomer, DueTodayItem } from '../types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-600 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-gray-900">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [dueToday, setDueToday] = useState<DueTodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyPayments, setDailyPayments] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      dashboardApi.cashFlow(30),
      dashboardApi.topCustomers(5),
      dashboardApi.dueToday(),
    ]).then(([s, cf, top, due]) => {
      setSummary(s.data.data)
      setCashFlow(cf.data.data)
      setTopCustomers(top.data.data ?? [])
      setDueToday(due.data.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    paymentApi.daily(selectedDate).then((res) => {
      setDailyPayments(res.data.data ?? [])
    }).catch(() => {})
  }, [selectedDate])

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const d = summary
  const chartData = (cashFlow?.daily ?? []).slice(-14).map((day) => ({
    date: day.date.slice(5).replace('-', '/'),
    รับเข้า: day.in,
    จ่ายออก: day.out,
    คงเหลือ: day.balance,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">ภาพรวมธุรกิจวันนี้</p>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="เงินสดในมือ"
          value={formatCurrency(d.cashOnHand)}
          sub="ยอดคงเหลือปัจจุบัน"
          icon={<Wallet size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <KpiCard
          title="เงินต้นคงค้าง"
          value={formatCurrency(d.outstandingPrincipal)}
          sub={`${d.activeLoansCount} สัญญา Active`}
          icon={<BadgeDollarSign size={18} className="text-purple-600" />}
          iconBg="bg-purple-50"
          onClick={() => navigate('/loans')}
        />
        <KpiCard
          title="ทุนรวม (Total Asset)"
          value={formatCurrency(d.totalAsset)}
          sub="เงินสด + เงินต้นคงค้าง"
          icon={<PiggyBank size={18} className="text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <KpiCard
          title="ยอดรับคืนทั้งหมด"
          value={formatCurrency(d.cashOnHand + d.outstandingPrincipal + d.expectedProfit)}
          sub="เงินสด + เงินต้นคงค้าง + กำไรคาดการณ์"
          icon={<Landmark size={18} className="text-orange-600" />}
          iconBg="bg-orange-50"
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="กำไรเดือนนี้"
          value={formatCurrency(d.profitThisMonth)}
          sub={`คาดการณ์ ${formatCurrency(d.expectedProfit)}`}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <KpiCard
          title="กำไรวันนี้"
          value={formatCurrency(d.profitToday)}
          sub={`รับมาทั้งหมด ${formatCurrency(d.receivedToday)}`}
          icon={<TrendingUp size={18} className="text-green-600" />}
          iconBg="bg-green-50"
          trend={{ value: 'วันนี้', positive: true }}
        />
        <KpiCard
          title="ลูกหนี้ค้างชำระ"
          value={formatCurrency(d.overdueAmount)}
          sub={`${d.overdueCount} ราย`}
          icon={<AlertTriangle size={18} className="text-yellow-600" />}
          iconBg="bg-yellow-50"
          onClick={() => navigate('/overdue')}
        />
        <KpiCard
          title="Collection Rate"
          value={formatPercent(d.collectionRate)}
          sub="อัตราการเก็บหนี้"
          icon={<CheckCircle size={18} className="text-teal-600" />}
          iconBg="bg-teal-50"
        />
      </div>

      {/* Charts + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Cash Flow (14 วันล่าสุด)</h2>
              <p className="text-xs text-gray-500 mt-0.5">รับเข้า vs จ่ายออก</p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="text-gray-500">รับเข้า</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                <span className="text-gray-500">จ่ายออก</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="รับเข้า" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="จ่ายออก" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-50">
            <div>
              <p className="text-xs text-gray-500">รับเข้ารวม</p>
              <p className="text-sm font-bold text-blue-600">{formatCurrency(cashFlow?.totalIn ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">จ่ายออกรวม</p>
              <p className="text-sm font-bold text-red-500">{formatCurrency(cashFlow?.totalOut ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Flow</p>
              <p className={`text-sm font-bold ${(cashFlow?.netFlow ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(cashFlow?.netFlow ?? 0) >= 0 ? '+' : ''}{formatCurrency(cashFlow?.netFlow ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Top ลูกค้า</h2>
            <Users size={16} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            {topCustomers.map((c, idx) => (
              <div
                key={c.customerId}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/customers/${c.customerId}`)}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{c.customerName}</p>
                  <p className="text-xs text-gray-500">{c.loanCount} สัญญา · ปิดแล้ว {c.closedLoansCount} สัญญา</p>
                </div>
                <span className={`text-xs font-medium ${c.collectionRate >= 0.9 ? 'text-green-600' : c.collectionRate >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatPercent(c.collectionRate, 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Due Today Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">ครบกำหนดวันนี้</h2>
            <p className="text-xs text-gray-500 mt-0.5">{dueToday.length} รายการ</p>
          </div>
          <button onClick={() => navigate('/payments')} className="btn-primary text-xs py-1.5">
            รับชำระ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header text-left">ลูกค้า</th>
                <th className="table-header text-left">เลขสัญญา</th>
                <th className="table-header text-left">งวด</th>
                <th className="table-header text-right">ยอดที่ต้องรับ</th>
                <th className="table-header text-center">สถานะ</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {dueToday.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-gray-400">ไม่มีรายการครบกำหนดวันนี้</td>
                </tr>
              ) : (
                dueToday.map((item) => {
                  const overdue = daysOverdue(item.dueDate)
                  return (
                    <tr key={item.loanId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-gray-900">{item.customerName}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone size={10} /> {item.customerPhone}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">{item.loanNumber}</td>
                      <td className="table-cell text-gray-500">
                        {isInstallmentBased(item.loanType)
                          ? `งวด ${item.installmentNo}/${item.totalInstallments}`
                          : item.loanType === 'flexible'
                            ? 'ยืดหยุ่น'
                            : 'ครั้งเดียว'}
                      </td>
                      <td className="table-cell text-right font-semibold text-gray-900">
                        {formatCurrency(item.amountDue)}
                      </td>
                      <td className="table-cell text-center">
                        {overdue > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${overdueBadgeClass(overdue)}`}>
                            ค้าง {overdue} วัน
                          </span>
                        ) : (
                          <StatusBadge status={item.status} />
                        )}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => navigate('/payments', { state: { loanId: item.loanId } })}
                          className="btn-primary text-xs py-1 px-2.5"
                        >
                          รับชำระ
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Received Payments */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-gray-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">ยอดรับวันนี้</h2>
              <p className="text-xs text-gray-400">{dailyPayments.length} รายการ · รวม {formatCurrency(dailyPayments.reduce((s, p) => s + Number(p.amount), 0))}</p>
            </div>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เลขสัญญา</th>
                <th className="table-header">ประเภท</th>
                <th className="table-header text-right">ยอดรับ</th>
                <th className="table-header text-right">ดอกเบี้ย</th>
                <th className="table-header text-right">เงินต้น</th>
                <th className="table-header">ช่องทาง</th>
              </tr>
            </thead>
            <tbody>
              {dailyPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-gray-400">ไม่มีรายการรับชำระในวันนี้</td>
                </tr>
              ) : (
                dailyPayments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell">
                      <p className="font-medium text-gray-900 text-sm">{p.customer_name}</p>
                    </td>
                    <td className="table-cell text-gray-500 text-xs">{p.loan_number}</td>
                    <td className="table-cell">
                      <span className="text-xs text-gray-500">
                        {p.loan_type === 'single' ? 'ครั้งเดียว'
                          : p.loan_type === 'installment' ? 'แบ่งงวด'
                          : p.loan_type === 'flexible' ? 'ต่อดอก'
                          : 'รายวัน'}
                        {p.payment_type === 'rollover' ? ' (ต่อดอก)' : p.payment_type === 'full' ? ' (ปิด)' : ''}
                      </span>
                    </td>
                    <td className="table-cell text-right font-semibold text-gray-900">{formatCurrency(Number(p.amount))}</td>
                    <td className="table-cell text-right text-green-600 font-medium">{formatCurrency(Number(p.interest_paid))}</td>
                    <td className="table-cell text-right text-blue-600">{formatCurrency(Number(p.principal_paid))}</td>
                    <td className="table-cell text-xs text-gray-500">
                      {p.payment_method === 'cash' ? 'เงินสด' : p.payment_method === 'transfer' ? 'โอน' : 'อื่นๆ'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
