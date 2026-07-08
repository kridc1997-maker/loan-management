import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Wallet, PlusCircle, MinusCircle, Receipt, RefreshCw, X } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../utils/financial'
import { dashboardApi, cashApi } from '../api/endpoints'
import { useAppStore } from '../stores/appStore'
import type { CashFlowSummary } from '../types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
        <p className="font-semibold text-gray-600 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span className="text-gray-500">{p.name}</span>
            <span className="font-semibold" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const TXN_TYPES = [
  { value: 'capital_in',  label: 'เพิ่มทุน',      icon: PlusCircle,  color: '#2E7D32', bg: '#E8F5E9', dir: 'in'  },
  { value: 'capital_out', label: 'ถอนทุน',         icon: MinusCircle, color: '#C62828', bg: '#FFEBEE', dir: 'out' },
  { value: 'expense',     label: 'ค่าใช้จ่าย',    icon: Receipt,     color: '#E64A19', bg: '#FBE9E7', dir: 'out' },
] as const

type ModalMode = 'adjust' | 'set'

type TxnType = typeof TXN_TYPES[number]['value']
type Period = '7d' | '14d' | '30d'
type TablePeriod = '3d' | '5d' | '7d' | '14d' | '30d'

function txnLabel(type: string) {
  return TXN_TYPES.find((t) => t.value === type)?.label ?? type
}

const TXN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  principal_in:     { label: 'รับต้น',       color: '#1565C0', bg: '#E3F2FD' },
  interest_in:      { label: 'รับดอก',        color: '#2E7D32', bg: '#E8F5E9' },
  fine_in:          { label: 'รับค่าปรับ',    color: '#F57F17', bg: '#FFFDE7' },
  bad_debt_recover: { label: 'ได้คืนหนี้เสีย', color: '#4A148C', bg: '#F3E5F5' },
  loan_out:         { label: 'ปล่อยกู้',      color: '#C62828', bg: '#FFEBEE' },
  capital_in:       { label: 'เพิ่มทุน',      color: '#2E7D32', bg: '#E8F5E9' },
  capital_out:      { label: 'ถอนทุน',        color: '#C62828', bg: '#FFEBEE' },
  expense:          { label: 'ค่าใช้จ่าย',    color: '#E64A19', bg: '#FBE9E7' },
  balance_adjust:   { label: 'ปรับยอด',       color: '#546E7A', bg: '#ECEFF1' },
}

const DAILY_FILTERS: { value: string[]; label: string }[] = [
  { value: [], label: 'ทั้งหมด' },
  { value: ['capital_in'], label: 'เพิ่มทุน' },
  { value: ['capital_out', 'expense'], label: 'ถอนทุน/ค่าใช้จ่าย' },
]

function dailyTxnBadge(txnType: string) {
  const t = TXN_TYPE_LABELS[txnType] ?? { label: txnType, color: '#546E7A', bg: '#ECEFF1' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: t.color, background: t.bg }}>
      {t.label}
    </span>
  )
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}


function formatShortDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function CashFlow() {
  const { addToast } = useAppStore()
  const [period, setPeriod] = useState<Period>('14d')
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Cash balance state
  const [currentBalance, setCurrentBalance] = useState(0)
  const [recentTxns, setRecentTxns] = useState<any[]>([])
  const [balanceLoading, setBalanceLoading] = useState(true)

  // Net Flow table (independent period)
  const [tablePeriod, setTablePeriod] = useState<TablePeriod>('7d')
  const [tableCashFlow, setTableCashFlow] = useState<CashFlowSummary | null>(null)
  const [tableLoading, setTableLoading] = useState(true)

  // Daily transaction detail table (date range)
  const [rangeFrom, setRangeFrom] = useState(new Date().toISOString().split('T')[0])
  const [rangeTo,   setRangeTo]   = useState(new Date().toISOString().split('T')[0])
  const [dailyTxns, setDailyTxns] = useState<any[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyFilter, setDailyFilter] = useState<string[]>(DAILY_FILTERS[0].value)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('adjust')
  const [txnType, setTxnType] = useState<TxnType>('capital_in')
  const [amount, setAmount] = useState('')
  const [targetBalance, setTargetBalance] = useState('')
  const [desc, setDesc] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const loadBalance = useCallback(async () => {
    try {
      setBalanceLoading(true)
      const res = await cashApi.balance()
      setCurrentBalance(res.data.data.currentBalance)
      setRecentTxns(res.data.data.recent)
    } catch { /* silent */ }
    finally { setBalanceLoading(false) }
  }, [])

  const loadCashFlow = useCallback(() => {
    setLoading(true)
    const days = period === '7d' ? 7 : period === '14d' ? 14 : 30
    dashboardApi.cashFlow(days).then((res) => setCashFlow(res.data.data)).finally(() => setLoading(false))
  }, [period])

  const loadTableCashFlow = useCallback(() => {
    setTableLoading(true)
    const days = tablePeriod === '3d' ? 3 : tablePeriod === '5d' ? 5 : tablePeriod === '7d' ? 7 : tablePeriod === '14d' ? 14 : 30
    dashboardApi.cashFlow(days).then((res) => setTableCashFlow(res.data.data)).finally(() => setTableLoading(false))
  }, [tablePeriod])

  const loadDailyTxns = useCallback(() => {
    setDailyLoading(true)
    cashApi.daily(rangeFrom, rangeTo).then((res) => setDailyTxns(res.data.data)).finally(() => setDailyLoading(false))
  }, [rangeFrom, rangeTo])

  useEffect(() => { loadBalance() }, [loadBalance])
  useEffect(() => { loadCashFlow() }, [loadCashFlow])
  useEffect(() => { loadTableCashFlow() }, [loadTableCashFlow])
  useEffect(() => { loadDailyTxns() }, [loadDailyTxns])

  const closeModal = () => {
    setModalOpen(false); setAmount(''); setTargetBalance(''); setDesc(''); setErr('')
    setTxnDate(new Date().toISOString().split('T')[0])
    setTxnType('capital_in'); setModalMode('adjust')
  }

  const openModal = (mode: ModalMode) => { setModalMode(mode); setModalOpen(true) }

  const handleAdjust = async () => {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num <= 0) { setErr('กรุณากรอกจำนวนเงินที่ถูกต้อง'); return }
    try {
      setSaving(true); setErr('')
      await cashApi.adjust({ type: txnType, amount: num, description: desc, txnDate })
      addToast('success', `${txnLabel(txnType)} ${formatCurrency(num)} เรียบร้อย`)
      window.dispatchEvent(new Event('header-refresh'))
      closeModal(); loadBalance(); loadCashFlow()
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด')
    } finally { setSaving(false) }
  }

  const handleSetBalance = async () => {
    const num = parseFloat(targetBalance)
    if (targetBalance === '' || isNaN(num) || num < 0) { setErr('กรุณากรอกยอดเงินสดที่ต้องการ'); return }
    try {
      setSaving(true); setErr('')
      await cashApi.setBalance(num, desc || 'ตั้งยอดเงินสดเริ่มต้น')
      addToast('success', `ตั้งยอดเงินสดเป็น ${formatCurrency(num)} เรียบร้อย`)
      window.dispatchEvent(new Event('header-refresh'))
      closeModal(); loadBalance(); loadCashFlow()
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด')
    } finally { setSaving(false) }
  }

  const data = (cashFlow?.daily ?? []).map((d) => ({
    date: d.date.slice(5),
    รับเข้า: d.in,
    จ่ายออก: d.out,
    คงเหลือ: d.balance,
    net: d.net,
  }))

  const totalIn  = cashFlow?.totalIn ?? 0
  const totalOut = cashFlow?.totalOut ?? 0
  const netFlow  = totalIn - totalOut

  const selectedType = TXN_TYPES.find((t) => t.value === txnType)!

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">จัดการกระเป๋าตัง</h1>
        <p className="text-sm text-gray-500 mt-0.5">ติดตามกระแสเงินสดและจัดการเงินสดในมือ</p>
      </div>

      {/* ═══ CASH ON HAND CARD ═══ */}
      <div className="rounded-2xl overflow-hidden shadow-lg"
           style={{ background: 'linear-gradient(135deg,#0D47A1 0%,#1565C0 50%,#1976D2 100%)' }}>
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Wallet size={22} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>เงินสดในมือปัจจุบัน</p>
              {balanceLoading ? (
                <div className="h-8 w-40 rounded-lg mt-1 animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
              ) : (
                <p className="text-3xl font-black text-white mt-0.5 tabular-nums">
                  {formatCurrency(currentBalance)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadBalance}
              className="p-2 rounded-xl transition-colors hover:bg-white/10 text-white/60 hover:text-white">
              <RefreshCw size={16} />
            </button>
            <div className="flex gap-2">
            <button onClick={() => openModal('adjust')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}>
              <PlusCircle size={15} /> อัพเดตเงินสด
            </button>
          </div>
          </div>
        </div>

        {/* Recent manual adjustments */}
        {recentTxns.length > 0 && (
          <div className="px-6 pb-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>รายการล่าสุด</p>
            <div className="flex flex-wrap gap-2">
              {recentTxns.slice(0, 5).map((t: any) => (
                <div key={t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                  <span className={t.direction === 'in' ? 'text-green-300' : 'text-red-300'}>
                    {t.direction === 'in' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>{txnLabel(t.txn_type)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>· {formatShortDate(t.txn_date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ KPI Row ═══ */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border-l-4 border-blue-400">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-blue-500" />
            <p className="text-xs text-gray-500">รับเข้ารวม</p>
          </div>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalIn)}</p>
        </div>
        <div className="card border-l-4 border-red-400">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-500" />
            <p className="text-xs text-gray-500">จ่ายออกรวม</p>
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalOut)}</p>
        </div>
        <div className={`card border-l-4 ${netFlow >= 0 ? 'border-green-400' : 'border-orange-400'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Minus size={16} className={netFlow >= 0 ? 'text-green-500' : 'text-orange-500'} />
            <p className="text-xs text-gray-500">Net Flow</p>
          </div>
          <p className={`text-xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
          </p>
        </div>
      </div>

      {/* ═══ Bar Chart ═══ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">กระแสเงินสด</h2>
          <div className="flex gap-1.5">
            {(['7d', '14d', '30d'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p === '7d' ? '7 วัน' : p === '14d' ? '14 วัน' : '30 วัน'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="รับเข้า" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="จ่ายออก" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ═══ Area Chart ═══ */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">ยอดเงินสดคงเหลือ (Running Balance)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="คงเหลือ" stroke="#3b82f6" strokeWidth={2} fill="url(#balanceGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ Net Flow Table ═══ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Net Flow</h2>
          <div className="flex gap-1.5">
            {(['3d', '5d', '7d', '14d', '30d'] as TablePeriod[]).map((p) => (
              <button key={p} onClick={() => setTablePeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  tablePeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p === '3d' ? '3 วัน' : p === '5d' ? '5 วัน' : p === '7d' ? '7 วัน' : p === '14d' ? '14 วัน' : '30 วัน'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
            {tableLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="table-header">วันที่</th>
                    <th className="table-header text-right">รับเข้า</th>
                    <th className="table-header text-right">จ่ายออก</th>
                    <th className="table-header text-right">Net</th>
                    <th className="table-header text-right">ยอดคงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(tableCashFlow?.daily ?? [])].reverse().map((d) => {
                    const net = d.in - d.out
                    return (
                      <tr key={d.date} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-cell text-gray-600">{String(d.date).slice(5)}</td>
                        <td className="table-cell text-right text-blue-600 font-medium">{formatCurrency(d.in)}</td>
                        <td className="table-cell text-right text-red-500">{formatCurrency(d.out)}</td>
                        <td className={`table-cell text-right font-semibold ${net >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                          {net >= 0 ? '+' : ''}{formatCurrency(net)}
                        </td>
                        <td className="table-cell text-right font-semibold text-gray-900">{formatCurrency(d.balance)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Daily Transaction Table ═══ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 flex-shrink-0">รายการรับ-จ่ายรายวัน</h2>
          <div className="flex items-center gap-1.5">
            {DAILY_FILTERS.map((f) => (
              <button key={f.label} onClick={() => setDailyFilter(f.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  dailyFilter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">จาก</span>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={rangeFrom}
                max={rangeTo}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
              <span className="text-xs text-gray-400">ถึง</span>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={rangeTo}
                min={rangeFrom}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: 'วันนี้',    onClick: () => { const t = new Date().toISOString().split('T')[0]; setRangeFrom(t); setRangeTo(t) } },
                { label: '7 วัน',    onClick: () => { setRangeFrom(shiftDate(new Date().toISOString().split('T')[0], -6)); setRangeTo(new Date().toISOString().split('T')[0]) } },
                { label: 'เดือนนี้', onClick: () => { const t = new Date().toISOString().split('T')[0]; setRangeFrom(t.slice(0,7)+'-01'); setRangeTo(t) } },
              ].map((s) => (
                <button key={s.label} onClick={s.onClick}
                  className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                  {s.label}
                </button>
              ))}
            </div>
            <button onClick={loadDailyTxns} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {dailyLoading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          (() => {
            const filtered = dailyFilter.length === 0
              ? dailyTxns
              : dailyTxns.filter((t: any) => dailyFilter.includes(t.txn_type))
            return filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">ไม่มีรายการ{dailyFilter ? 'ประเภทนี้' : ''}ในวันนี้</p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex gap-6 text-xs">
                  <span className="text-gray-500">
                    รับเข้า <span className="font-bold text-blue-600">
                      {formatCurrency(filtered.filter((t: any) => t.direction === 'in').reduce((s: number, t: any) => s + Number(t.amount), 0))}
                    </span>
                  </span>
                  <span className="text-gray-500">
                    จ่ายออก <span className="font-bold text-red-500">
                      {formatCurrency(filtered.filter((t: any) => t.direction === 'out').reduce((s: number, t: any) => s + Number(t.amount), 0))}
                    </span>
                  </span>
                  <span className="text-gray-400">{filtered.length} รายการ</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="table-header">วันที่</th>
                        <th className="table-header">เลขที่</th>
                        <th className="table-header">ประเภท</th>
                        <th className="table-header">ลูกค้า / รายละเอียด</th>
                        <th className="table-header">เลขสัญญา</th>
                        <th className="table-header text-right">รับเข้า</th>
                        <th className="table-header text-right">จ่ายออก</th>
                        <th className="table-header text-right">คงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                  {filtered.map((t: any) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-cell text-xs text-gray-500 whitespace-nowrap">{t.txn_date ?? ''}</td>
                      <td className="table-cell text-xs text-gray-400 font-mono">{t.txn_number}</td>
                      <td className="table-cell">{dailyTxnBadge(t.txn_type)}</td>
                      <td className="table-cell">
                        {t.customer_name
                          ? <span className="text-sm font-medium text-gray-800">{t.customer_name}</span>
                          : <span className="text-sm text-gray-500">{t.description}</span>
                        }
                        {t.customer_name && t.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        {t.loan_number
                          ? <span className="text-xs font-mono text-blue-600">{t.loan_number}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="table-cell text-right">
                        {t.direction === 'in'
                          ? <span className="font-semibold text-blue-600">{formatCurrency(Number(t.amount))}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="table-cell text-right">
                        {t.direction === 'out'
                          ? <span className="font-semibold text-red-500">{formatCurrency(Number(t.amount))}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="table-cell text-right font-semibold text-gray-700 tabular-nums">
                        {formatCurrency(Number(t.balance_after))}
                      </td>
                    </tr>
                  ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          })()
        )}
      </div>

      {/* ═══════════════════════════════════
          MODAL: อัพเดตเงินสด
      ═══════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
             onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5"
                 style={{ background: modalMode === 'set' ? 'linear-gradient(135deg,#4A148C,#6A1B9A)' : 'linear-gradient(135deg,#0D47A1,#1565C0)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <Wallet size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">
                    {modalMode === 'set' ? 'ตั้งยอดเงินสดเริ่มต้น' : 'อัพเดตเงินสดในมือ'}
                  </h2>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    ยอดปัจจุบัน {formatCurrency(currentBalance)}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">

              {modalMode === 'set' ? (
                /* ─── Set Balance Mode ─── */
                <>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-sm text-purple-700">
                    ใช้สำหรับธุรกิจที่ดำเนินการมาแล้ว — ระบบจะปรับยอดให้ตรงกับเงินสดจริงในมือ โดยไม่เชื่อมโยงกับสัญญา
                  </div>
                  <div>
                    <label className="label">ยอดเงินสดที่ต้องการตั้ง (฿) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">฿</span>
                      <input type="number" className="input pl-8" placeholder="0.00" min="0" step="0.01"
                        value={targetBalance} onChange={(e) => setTargetBalance(e.target.value)} />
                    </div>
                    {targetBalance !== '' && !isNaN(parseFloat(targetBalance)) && (
                      <p className="text-xs mt-1.5 font-medium text-purple-700">
                        ปรับ{parseFloat(targetBalance) >= currentBalance ? 'เพิ่ม' : 'ลด'}
                        {' '}{formatCurrency(Math.abs(parseFloat(targetBalance) - currentBalance))}
                        {' '}จากยอดปัจจุบัน
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">หมายเหตุ</label>
                    <input className="input" placeholder="เช่น ยอดเงินสดเริ่มต้นจากการนำเข้าข้อมูล"
                      value={desc} onChange={(e) => setDesc(e.target.value)} />
                  </div>
                  {err && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />{err}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={closeModal} className="btn-secondary flex-1" disabled={saving}>ยกเลิก</button>
                    <button onClick={handleSetBalance} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#4A148C,#6A1B9A)', boxShadow: '0 4px 14px rgba(74,20,140,0.35)' }}>
                      {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังบันทึก...</> : 'ตั้งยอดเงินสด'}
                    </button>
                  </div>
                </>
              ) : (
                /* ─── Adjust Mode ─── */
                <>
                  {/* Transaction type selector */}
                  <div>
                    <label className="label">ประเภทรายการ</label>
                    <div className="grid grid-cols-3 gap-2">
                      {TXN_TYPES.map((t) => (
                        <label key={t.value}
                          className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 cursor-pointer transition-all ${
                            txnType === t.value ? 'border-current' : 'border-gray-100 hover:border-gray-200'
                          }`}
                          style={txnType === t.value ? { borderColor: t.color, background: t.bg } : {}}>
                          <input type="radio" className="sr-only" value={t.value} checked={txnType === t.value}
                            onChange={() => setTxnType(t.value)} />
                          <t.icon size={18} style={{ color: txnType === t.value ? t.color : '#9CA3AF' }} />
                          <span className="text-xs font-semibold" style={{ color: txnType === t.value ? t.color : '#9CA3AF' }}>
                            {t.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">จำนวนเงิน (บาท) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">฿</span>
                      <input type="number" className="input pl-8" placeholder="0.00" min="0" step="0.01"
                        value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    {amount && !isNaN(parseFloat(amount)) && (
                      <p className="text-xs mt-1.5 font-medium" style={{ color: selectedType.color }}>
                        ยอดหลังอัพเดต: {formatCurrency(
                          selectedType.dir === 'in' ? currentBalance + parseFloat(amount) : currentBalance - parseFloat(amount)
                        )}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">หมายเหตุ</label>
                    <input className="input" placeholder={
                      txnType === 'capital_in' ? 'เช่น เพิ่มทุนจากธนาคาร'
                      : txnType === 'capital_out' ? 'เช่น ถอนเงินส่วนตัว'
                      : 'เช่น ค่าเช่าที่ทำการ'}
                      value={desc} onChange={(e) => setDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">วันที่</label>
                    <input type="date" className="input" value={txnDate}
                      onChange={(e) => setTxnDate(e.target.value)} />
                  </div>
                  {err && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />{err}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={closeModal} className="btn-secondary flex-1" disabled={saving}>ยกเลิก</button>
                    <button onClick={handleAdjust} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                      style={{ background: `linear-gradient(135deg,${selectedType.color},${selectedType.color}CC)`, boxShadow: `0 4px 14px ${selectedType.color}40` }}>
                      {saving
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />กำลังบันทึก...</>
                        : <><selectedType.icon size={15} />{selectedType.label}</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
