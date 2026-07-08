import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, TrendingUp, PiggyBank, BadgeDollarSign, AlertTriangle,
  Users, XCircle, Target, Calendar, Activity, BarChart2, CreditCard,
  RefreshCw, CheckCircle, Info, Plus, Download, UserPlus, Shield,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import KpiCard from '../components/ui/KpiCard'
import { formatCurrency, formatDate } from '../utils/financial'
import { executiveApi } from '../api/endpoints'
import type { ExecutiveDashboardData, ExecKpi, ExecRiskItem } from '../types'

// ─── Constants ───────────────────────────────────────────────────────────────

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const LOAN_TYPE_LABELS: Record<string, string> = {
  installment: 'แบ่งงวด',
  flexible: 'ผ่อนยืดหยุ่น',
  single: 'ครั้งเดียว',
  daily: 'รายวัน',
}
const LOAN_TYPE_COLORS: Record<string, string> = {
  installment: '#3b82f6',
  flexible: '#22c55e',
  single: '#f97316',
  daily: '#a855f7',
}
const PIE_COLOR_LIST = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#94a3b8']

// ─── Helper Components ────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  // Auto-format "YYYY-MM" month keys to Thai abbreviations
  const displayLabel = typeof label === 'string' && /^\d{4}-\d{2}$/.test(label)
    ? THAI_MONTHS[parseInt(label.split('-')[1]) - 1] ?? label
    : label
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      {displayLabel && <p className="font-semibold text-gray-600 mb-2">{displayLabel}</p>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const HealthGauge = ({ score }: { score: number }) => {
  const R = 80
  const totalArc = Math.PI * R
  const filled = (Math.min(Math.max(score, 0), 100) / 100) * totalArc
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#eab308' : '#ef4444'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Warning' : 'Critical'
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[220px]">
      <path d="M 20 100 A 80 80 0 0 0 180 100"
        fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
      <path d="M 20 100 A 80 80 0 0 0 180 100"
        fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${filled.toFixed(1)} ${totalArc.toFixed(1)}`} />
      <text x="100" y="75" textAnchor="middle" fill={color} fontSize="30" fontWeight="800"
        fontFamily="'Noto Sans Thai', sans-serif">{score}</text>
      <text x="100" y="93" textAnchor="middle" fill="#9ca3af" fontSize="12"
        fontFamily="'Noto Sans Thai', sans-serif">{label}</text>
      <text x="12" y="118" textAnchor="middle" fill="#d1d5db" fontSize="9">0</text>
      <text x="190" y="118" textAnchor="middle" fill="#d1d5db" fontSize="9">100</text>
    </svg>
  )
}

const ScoreBar = ({ label, score, max }: { label: string; score: number; max: number }) => {
  const pct = max > 0 ? (score / max) * 100 : 0
  const color = score === max ? '#22c55e' : score > 0 ? '#3b82f6' : '#ef4444'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{score}/{max}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Insight Generator ────────────────────────────────────────────────────────

type InsightType = 'good' | 'bad' | 'warn' | 'info'
interface Insight { text: string; type: InsightType }

function generateInsights(kpi: ExecKpi): Insight[] {
  const items: Insight[] = []

  const cashChange = kpi.cashOnHand - kpi.cashYesterday
  if (Math.abs(cashChange) >= 100) {
    items.push({
      text: cashChange >= 0
        ? `เงินสดเพิ่มขึ้น ${formatCurrency(cashChange)} จากเมื่อวาน`
        : `เงินสดลดลง ${formatCurrency(Math.abs(cashChange))} จากเมื่อวาน`,
      type: cashChange >= 0 ? 'info' : 'warn',
    })
  }

  if (kpi.profitLastMonth > 0) {
    const pct = (kpi.profitThisMonth - kpi.profitLastMonth) / kpi.profitLastMonth * 100
    if (Math.abs(pct) >= 1) {
      items.push({
        text: pct >= 0
          ? `กำไรเดือนนี้เพิ่มขึ้น ${pct.toFixed(1)}% เทียบเดือนก่อน`
          : `กำไรเดือนนี้ลดลง ${Math.abs(pct).toFixed(1)}% เทียบเดือนก่อน`,
        type: pct >= 0 ? 'good' : 'warn',
      })
    }
  }

  if (kpi.badDebtCount === 0 && kpi.nplRate === 0) {
    items.push({ text: 'ไม่มีหนี้เสีย พอร์ตยังแข็งแรง', type: 'good' })
  } else if (kpi.nplRate > 0.1) {
    items.push({ text: `NPL สูง ${(kpi.nplRate * 100).toFixed(1)}% ควรเร่งติดตามลูกหนี้`, type: 'bad' })
  }

  if (kpi.overdueCount === 0) {
    items.push({ text: 'ไม่มีลูกหนี้ค้างชำระในปัจจุบัน', type: 'good' })
  } else if (kpi.overdueCount > 5) {
    items.push({ text: `มีลูกหนี้ค้างชำระ ${kpi.overdueCount} ราย ยอด ${formatCurrency(kpi.overdueAmount)}`, type: 'bad' })
  } else {
    items.push({ text: `มีลูกหนี้ค้างชำระ ${kpi.overdueCount} ราย ควรติดตาม`, type: 'warn' })
  }

  if (kpi.repeatCustomerRate >= 50) {
    items.push({ text: `ลูกค้าเก่ากลับมากู้ซ้ำ ${kpi.repeatCustomerRate.toFixed(0)}% สะท้อนความไว้วางใจ`, type: 'good' })
  } else if (kpi.repeatCustomers > 0) {
    items.push({ text: `ลูกค้าเก่ากลับมา ${kpi.repeatCustomers} ราย (${kpi.repeatCustomerRate.toFixed(0)}%)`, type: 'info' })
  }

  if (kpi.cashUtilization > 90) {
    items.push({ text: `เงินสดต่ำมาก ส่วนใหญ่อยู่ในพอร์ต (${kpi.cashUtilization.toFixed(0)}%)`, type: 'warn' })
  } else if (kpi.cashUtilization < 30 && kpi.activeLoansCount > 0) {
    items.push({ text: `เงินสดสูง (${(100 - kpi.cashUtilization).toFixed(0)}%) อาจพิจารณาเพิ่มการปล่อยกู้`, type: 'info' })
  } else {
    items.push({ text: `พอร์ตยังแข็งแรง สัดส่วนสินเชื่อ ${kpi.cashUtilization.toFixed(0)}%`, type: 'good' })
  }

  if (kpi.forecast7Days > 0) {
    items.push({ text: `คาดรับชำระใน 7 วันข้างหน้า ${formatCurrency(kpi.forecast7Days)}`, type: 'info' })
  }

  return items.slice(0, 6)
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function getRiskBadge(item: ExecRiskItem) {
  if (item.daysOverdue > 30) return { label: `ค้าง ${item.daysOverdue} วัน`, cls: 'bg-red-100 text-red-700' }
  if (item.daysOverdue > 7) return { label: `ค้าง ${item.daysOverdue} วัน`, cls: 'bg-orange-100 text-orange-700' }
  if (item.daysOverdue > 0) return { label: `ค้าง ${item.daysOverdue} วัน`, cls: 'bg-yellow-100 text-yellow-700' }
  if (item.rolloverCount >= 3) return { label: `ต่อดอก ${item.rolloverCount}ครั้ง`, cls: 'bg-orange-100 text-orange-700' }
  if (item.rolloverCount >= 2) return { label: `ต่อดอก ${item.rolloverCount}ครั้ง`, cls: 'bg-yellow-100 text-yellow-700' }
  if (item.riskLevel === 'blacklist') return { label: 'Blacklist', cls: 'bg-red-100 text-red-700' }
  if (item.riskLevel === 'high') return { label: 'ความเสี่ยงสูง', cls: 'bg-orange-100 text-orange-700' }
  return { label: 'ใกล้ครบกำหนด', cls: 'bg-blue-100 text-blue-700' }
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(data: ExecutiveDashboardData) {
  const headers = ['ชื่อลูกค้า', 'จำนวนสัญญา', 'เงินต้นคงค้าง', 'ดอกเบี้ยสะสม', 'เป็นลูกค้าตั้งแต่', 'สถานะ']
  const rows = data.topCustomers.map((c) => [
    c.customerName,
    c.loanCount,
    c.outstandingPrincipal.toFixed(0),
    c.totalInterestPaid.toFixed(0),
    c.customerSince,
    c.status === 'overdue' ? 'ค้างชำระ' : 'Active',
  ])
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `executive-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    executiveApi.dashboard()
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { kpi, cashForecast, portfolioByType, revenueTrend, portfolioGrowth, topCustomers, riskMonitor } = data
  const insights = generateInsights(kpi)

  // cumulativeProfit from monthly_snapshots is always 0 (table unpopulated).
  // Recompute from revenueTrend which correctly reads from payments table.
  const revTrendMap = Object.fromEntries(revenueTrend.map((r) => [r.month, r.interest]))
  let cumProfit = 0
  const portfolioGrowthFixed = portfolioGrowth.map((g) => {
    cumProfit += revTrendMap[g.month] ?? 0
    return { ...g, cumulativeProfit: cumProfit }
  })
  const cashChange = kpi.cashOnHand - kpi.cashYesterday
  const profitChangePct = kpi.profitLastMonth > 0
    ? (kpi.profitThisMonth - kpi.profitLastMonth) / kpi.profitLastMonth * 100
    : 0

  const pieData = portfolioByType.map((item) => ({
    name: LOAN_TYPE_LABELS[item.loanType] ?? item.loanType,
    value: item.amount,
    count: item.count,
    color: LOAN_TYPE_COLORS[item.loanType] ?? '#94a3b8',
  }))

  const formatMonth = (key: string) => {
    const m = parseInt(key.split('-')[1])
    return THAI_MONTHS[m - 1] ?? key
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">ภาพรวมธุรกิจสำหรับผู้บริหาร</p>
        </div>
        <button onClick={load} className="btn-secondary text-xs gap-1.5">
          <RefreshCw size={13} />
          รีเฟรช
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — Executive Summary (10 KPI Cards)
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Executive Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: เงินสดคงเหลือ */}
          <KpiCard
            title="เงินสดคงเหลือ"
            value={formatCurrency(kpi.cashOnHand)}
            sub={cashChange >= 0
              ? `+${formatCurrency(cashChange)} จากเมื่อวาน`
              : `${formatCurrency(cashChange)} จากเมื่อวาน`}
            icon={<Wallet size={18} className={cashChange >= 0 ? 'text-blue-600' : 'text-red-500'} />}
            iconBg={cashChange >= 0 ? 'bg-blue-50' : 'bg-red-50'}
            trend={cashChange !== 0
              ? { value: cashChange >= 0 ? `+${formatCurrency(cashChange)}` : formatCurrency(cashChange), positive: cashChange >= 0 }
              : undefined}
          />

          {/* Card 2: เงินต้นคงค้าง */}
          <KpiCard
            title="เงินต้นคงค้าง"
            value={formatCurrency(kpi.outstandingPrincipal)}
            sub={`${kpi.activeLoansCount} สัญญา Active`}
            icon={<BadgeDollarSign size={18} className="text-purple-600" />}
            iconBg="bg-purple-50"
            onClick={() => navigate('/loans')}
          />

          {/* Card 3: กำไรเดือนนี้ (custom — expense + net profit) */}
          <div className="kpi-card">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">กำไรเดือนนี้</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(kpi.profitThisMonth)}</p>
                {kpi.netExpense !== 0 && (
                  <p className="mt-0.5 text-xs font-medium text-red-500">
                    −{formatCurrency(Math.abs(kpi.netExpense))} ค่าใช้จ่ายรวม
                  </p>
                )}
                <p className="mt-0.5 text-xs text-gray-600">
                  (กำไรสุทธิ {formatCurrency(kpi.profitThisMonth - kpi.netExpense + kpi.capitalInThisMonth)})
                </p>
              </div>
              <div className="flex-shrink-0 ml-4 w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
                <TrendingUp size={18} className="text-emerald-600" />
              </div>
            </div>
            {kpi.profitLastMonth > 0 && (
              <p className={`mt-1 text-xs font-medium flex items-center gap-0.5 ${profitChangePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {profitChangePct >= 0 ? '▲' : '▼'} {profitChangePct >= 0 ? '+' : ''}{profitChangePct.toFixed(1)}% vs เดือนก่อน
              </p>
            )}
          </div>

          {/* Card 4: ROI */}
          <KpiCard
            title="ROI เดือนนี้"
            value={`${kpi.roi.toFixed(2)}%`}
            sub="ดอกเบี้ย / เงินต้นที่ปล่อย"
            icon={<Target size={18} className="text-orange-600" />}
            iconBg="bg-orange-50"
          />

          {/* Card 5: NPL */}
          <KpiCard
            title="NPL"
            value={kpi.nplRate === 0 ? '0%' : `${(kpi.nplRate * 100).toFixed(2)}%`}
            sub={kpi.badDebtCount === 0 ? 'ไม่มีหนี้เสีย' : `หนี้เสีย ${formatCurrency(kpi.nplAmount)}`}
            icon={<Shield size={18} className={kpi.nplRate === 0 ? 'text-green-600' : 'text-red-500'} />}
            iconBg={kpi.nplRate === 0 ? 'bg-green-50' : 'bg-red-50'}
          />

          {/* Card 6: ลูกหนี้ค้างชำระ */}
          <KpiCard
            title="ลูกหนี้ค้างชำระ"
            value={`${kpi.overdueCount} ราย`}
            sub={formatCurrency(kpi.overdueAmount)}
            icon={<AlertTriangle size={18} className={
              kpi.overdueCount === 0 ? 'text-green-600'
              : kpi.overdueCount <= 5 ? 'text-yellow-600'
              : 'text-red-500'
            } />}
            iconBg={
              kpi.overdueCount === 0 ? 'bg-green-50'
              : kpi.overdueCount <= 5 ? 'bg-yellow-50'
              : 'bg-red-50'
            }
            onClick={() => navigate('/overdue')}
          />

          {/* Card 7: Average Loan */}
          <KpiCard
            title="Average Loan"
            value={formatCurrency(kpi.averageLoan)}
            sub={`เฉลี่ยต่อสัญญา`}
            icon={<PiggyBank size={18} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
          />

          {/* Card 8: Repeat Customer */}
          <KpiCard
            title="Repeat Customer"
            value={`${kpi.repeatCustomerRate.toFixed(0)}%`}
            sub={`กลับมากู้ซ้ำ ${kpi.repeatCustomers}/${kpi.totalCustomers} ราย`}
            icon={<Users size={18} className="text-teal-600" />}
            iconBg="bg-teal-50"
          />

          {/* Card 9: Forecast 7 วัน */}
          <KpiCard
            title="Forecast 7 วัน"
            value={formatCurrency(kpi.forecast7Days)}
            sub="ยอดที่จะรับภายใน 7 วัน"
            icon={<Calendar size={18} className="text-cyan-600" />}
            iconBg="bg-cyan-50"
          />

          {/* Card 10: Cash Utilization (custom — has progress bar) */}
          <div className="kpi-card">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cash Utilization</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{kpi.cashUtilization.toFixed(1)}%</p>
                <p className="mt-0.5 text-xs text-gray-500">เงินต้นคงค้าง / สินทรัพย์รวม</p>
              </div>
              <div className="flex-shrink-0 ml-4 w-10 h-10 rounded-lg flex items-center justify-center bg-violet-50">
                <Activity size={18} className="text-violet-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(kpi.cashUtilization, 100)}%`,
                    background: kpi.cashUtilization > 90 ? '#ef4444' : kpi.cashUtilization > 70 ? '#f97316' : '#3b82f6',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — Business Health
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Business Health</p>
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center">
              <p className="text-sm font-semibold text-gray-700 mb-2">Portfolio Health Score</p>
              <HealthGauge score={kpi.healthScore} />
              <p className="text-xs text-gray-400 mt-1">คะแนน {kpi.healthScore} / 100</p>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">รายละเอียดคะแนน</p>
              <ScoreBar label="NPL / หนี้เสีย" score={kpi.healthNplScore} max={30} />
              <ScoreBar label="ลูกหนี้ค้างชำระ" score={kpi.healthOverdueScore} max={30} />
              <ScoreBar label="สัญญา Active" score={kpi.healthActiveScore} max={20} />
              <ScoreBar label="หนี้เสียสะสม" score={kpi.healthBadDebtScore} max={20} />
            </div>

            {/* Interpretation */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-1">ความหมายของคะแนน</p>
              {[
                { range: '80–100', label: 'Excellent', cls: 'text-green-700 bg-green-50', desc: 'ธุรกิจแข็งแรงดีเยี่ยม' },
                { range: '60–79', label: 'Good', cls: 'text-blue-700 bg-blue-50', desc: 'ธุรกิจอยู่ในเกณฑ์ดี' },
                { range: '40–59', label: 'Warning', cls: 'text-yellow-700 bg-yellow-50', desc: 'ควรระวังและติดตาม' },
                { range: '0–39', label: 'Critical', cls: 'text-red-700 bg-red-50', desc: 'ต้องดูแลเร่งด่วน' },
              ].map((row) => (
                <div key={row.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${kpi.healthScore >= parseInt(row.range) ? row.cls : 'opacity-40 bg-gray-50'}`}>
                  <span className="text-xs font-mono font-bold">{row.range}</span>
                  <span className="text-xs font-semibold">{row.label}</span>
                  <span className="text-xs ml-auto">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 9 — Quick Insights (moved here, after Business Health)
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Insights</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((item, idx) => {
            const cfg = {
              good: { bg: 'bg-green-50 border-green-100', text: 'text-green-800', icon: <CheckCircle size={15} className="text-green-500 flex-shrink-0 mt-0.5" /> },
              bad:  { bg: 'bg-red-50 border-red-100',   text: 'text-red-800',   icon: <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" /> },
              warn: { bg: 'bg-yellow-50 border-yellow-100', text: 'text-yellow-800', icon: <AlertTriangle size={15} className="text-yellow-500 flex-shrink-0 mt-0.5" /> },
              info: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-800', icon: <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" /> },
            }[item.type]
            return (
              <div key={idx} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border ${cfg.bg}`}>
                {cfg.icon}
                <p className={`text-sm font-medium leading-snug ${cfg.text}`}>{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 + 4 — Cash Forecast & Loan Portfolio
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 3: Cash Forecast 7 วัน */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Cash Forecast</h2>
              <p className="text-xs text-gray-500 mt-0.5">ยอดที่คาดว่าจะรับใน 7 วันข้างหน้า</p>
            </div>
            <Calendar size={15} className="text-gray-400" />
          </div>
          {cashForecast.every((d) => d.amount === 0) ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">ไม่มีรายการครบกำหนดใน 7 วันข้างหน้า</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashForecast} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.slice(5).replace('-', '/')}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="amount" name="ยอดรับ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-xs text-gray-500">รวม 7 วัน</p>
            <p className="text-sm font-bold text-blue-600">{formatCurrency(kpi.forecast7Days)}</p>
          </div>
        </div>

        {/* SECTION 4: Loan Portfolio Pie */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Loan Portfolio</h2>
              <p className="text-xs text-gray-500 mt-0.5">สัดส่วนเงินต้นคงค้างตามประเภทสินเชื่อ</p>
            </div>
            <BarChart2 size={15} className="text-gray-400" />
          </div>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">ไม่มีสัญญา Active</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color ?? PIE_COLOR_LIST[i % PIE_COLOR_LIST.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value ?? 0)), 'ยอด']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {pieData.map((item, i) => {
                  const total = pieData.reduce((s, d) => s + d.value, 0)
                  const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0'
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.count} สัญญา</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-800">{pct}%</p>
                        <p className="text-xs text-gray-400">{formatCurrency(item.value)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — Top Customers
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Top Customers</h2>
            <p className="text-xs text-gray-500 mt-0.5">เรียงตามเงินต้นคงค้างสูงสุด</p>
          </div>
          <Users size={15} className="text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">ชื่อลูกค้า</th>
                <th className="table-header text-center">จำนวนสัญญา</th>
                <th className="table-header text-right">เงินต้นคงค้าง</th>
                <th className="table-header text-right">ดอกเบี้ยสะสม</th>
                <th className="table-header text-center">เป็นลูกค้าตั้งแต่</th>
                <th className="table-header text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-gray-400">ไม่มีข้อมูล</td>
                </tr>
              ) : (
                topCustomers.map((c, idx) => (
                  <tr
                    key={c.customerId}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/customers/${c.customerId}`)}
                  >
                    <td className="table-cell">
                      <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold
                        ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="table-cell font-medium text-gray-900">{c.customerName}</td>
                    <td className="table-cell text-center text-gray-600">{c.loanCount}</td>
                    <td className="table-cell text-right font-semibold text-gray-900">{formatCurrency(c.outstandingPrincipal)}</td>
                    <td className="table-cell text-right text-green-600 font-medium">{formatCurrency(c.totalInterestPaid)}</td>
                    <td className="table-cell text-center text-gray-500 text-xs">{formatDate(c.customerSince)}</td>
                    <td className="table-cell text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${c.status === 'overdue' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {c.status === 'overdue' ? 'ค้างชำระ' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 6 + 7 — Revenue Trend & Portfolio Growth
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 6: Revenue Trend */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Revenue Trend</h2>
              <p className="text-xs text-gray-500 mt-0.5">ดอกเบี้ยที่ได้รับ 12 เดือนย้อนหลัง</p>
            </div>
            <TrendingUp size={15} className="text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatMonth}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="interest"
                name="ดอกเบี้ย"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SECTION 7: Portfolio Growth */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Portfolio Growth</h2>
              <p className="text-xs text-gray-500 mt-0.5">เงินต้นคงค้าง vs กำไรสะสม 12 เดือน</p>
            </div>
            <Activity size={15} className="text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={portfolioGrowthFixed}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatMonth}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="outstanding"
                name="เงินต้นคงค้าง"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cumulativeProfit"
                name="กำไรสะสม"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 8 — Risk Monitor
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Risk Monitor</h2>
            <p className="text-xs text-gray-500 mt-0.5">ลูกค้าที่ควรติดตาม — ค้างชำระ, ต่อดอกบ่อย, ความเสี่ยงสูง, ใกล้ครบกำหนด</p>
          </div>
          <AlertTriangle size={15} className="text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เลขสัญญา</th>
                <th className="table-header text-right">ยอดคงค้าง</th>
                <th className="table-header text-center">ต่อดอก</th>
                <th className="table-header text-center">วันครบกำหนด</th>
                <th className="table-header text-center">ความเสี่ยง</th>
              </tr>
            </thead>
            <tbody>
              {riskMonitor.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-gray-400">ไม่มีรายการที่ต้องติดตาม</td>
                </tr>
              ) : (
                riskMonitor.map((item) => {
                  const badge = getRiskBadge(item)
                  return (
                    <tr
                      key={`${item.loanId}-${item.customerId}`}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/loans/${item.loanId}`)}
                    >
                      <td className="table-cell font-medium text-gray-900">{item.customerName}</td>
                      <td className="table-cell text-gray-500 text-xs">{item.loanNumber}</td>
                      <td className="table-cell text-right font-semibold text-gray-900">{formatCurrency(item.outstandingAmount)}</td>
                      <td className="table-cell text-center">
                        {item.rolloverCount > 0 ? (
                          <span className="text-xs font-medium text-orange-600">{item.rolloverCount}x</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="table-cell text-center text-xs text-gray-500">
                        {item.dueDate ? formatDate(item.dueDate) : '—'}
                      </td>
                      <td className="table-cell text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 10 — Quick Actions
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/loans/new')} className="btn-primary gap-2">
            <Plus size={15} />
            ปล่อยกู้ใหม่
          </button>
          <button onClick={() => navigate('/payments')} className="btn-primary gap-2">
            <CreditCard size={15} />
            รับชำระ
          </button>
          <button onClick={() => navigate('/customers')} className="btn-secondary gap-2">
            <UserPlus size={15} />
            เพิ่มลูกค้า
          </button>
          <button onClick={() => navigate('/cash-flow')} className="btn-secondary gap-2">
            <TrendingUp size={15} />
            Cash Flow
          </button>
          <button onClick={() => navigate('/reports')} className="btn-secondary gap-2">
            <BarChart2 size={15} />
            รายงาน
          </button>
          <button onClick={() => exportCSV(data)} className="btn-secondary gap-2">
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
