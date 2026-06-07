import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, ChevronRight, Phone } from 'lucide-react'
import { formatCurrency, formatDate, daysOverdue, todayInputDate } from '../../utils/financial'
import api from '../../api/client'

interface InstallmentRow {
  id: number
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  customerPhone: string
  totalInstallments: number
  installmentNo: number
  dueDate: string
  amountDue: number
  paidAmount: number
  paidDate: string | null
  status: string
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'รอชำระ',   cls: 'bg-blue-50 text-blue-700' },
  paid:     { label: 'ชำระแล้ว', cls: 'bg-green-50 text-green-700' },
  partial:  { label: 'ชำระบางส่วน', cls: 'bg-yellow-50 text-yellow-700' },
  overdue:  { label: 'ค้างชำระ', cls: 'bg-red-50 text-red-700' },
}

export default function InstallmentSchedule() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<InstallmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    api.get(`/installments?${params}`).then((res) => {
      setRows(res.data.data ?? [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [statusFilter, dateFrom, dateTo])

  const filtered = rows.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.customerName.toLowerCase().includes(q) || r.loanNumber.toLowerCase().includes(q) || r.customerPhone.includes(q)
  })

  const today = todayInputDate()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ตารางผ่อนชำระ</h1>
          <p className="text-sm text-gray-500 mt-0.5">งวดชำระของสัญญาประเภทงวด (รายเดือน) และรายวัน</p>
        </div>
        <button onClick={() => navigate(-1)} className="btn-secondary w-fit">
          <ArrowLeft size={15} /> กลับ
        </button>
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="ค้นหาชื่อ, เลขสัญญา..." value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '', label: 'ทั้งหมด' },
              { value: 'pending', label: 'รอชำระ' },
              { value: 'overdue', label: 'ค้างชำระ' },
              { value: 'paid', label: 'ชำระแล้ว' },
            ].map((opt) => (
              <button key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-gray-500 whitespace-nowrap">ช่วงวันที่:</span>
          <input type="date" className="input text-sm w-36" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-gray-400">ถึง</span>
          <input type="date" className="input text-sm w-36" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button className="text-xs text-gray-500 hover:text-gray-700 underline"
              onClick={() => { setDateFrom(''); setDateTo('') }}>ล้าง</button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} งวด</span>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เลขสัญญา</th>
                <th className="table-header text-center">งวดที่</th>
                <th className="table-header text-center">วันครบกำหนด</th>
                <th className="table-header text-right">ยอด</th>
                <th className="table-header text-right">ชำระแล้ว</th>
                <th className="table-header text-center">สถานะ</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-gray-400">ไม่พบข้อมูล</td></tr>
              ) : filtered.map((row) => {
                const overdue = row.status !== 'paid' ? daysOverdue(row.dueDate) : 0
                const isToday = row.dueDate === today
                return (
                  <tr key={row.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${isToday ? 'bg-blue-50/40' : ''}`}
                    onClick={() => navigate('/payments', { state: { loanId: row.loanId } })}>
                    <td className="table-cell">
                      <p className="font-semibold text-gray-900 text-sm">{row.customerName}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone size={10} />{row.customerPhone}
                      </p>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono text-gray-500">{row.loanNumber}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className="text-sm font-medium text-gray-700">
                        {row.installmentNo}/{row.totalInstallments}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <p className="text-sm text-gray-700">{formatDate(row.dueDate)}</p>
                      {overdue > 0 && <p className="text-xs text-red-500 font-medium">ค้าง {overdue} วัน</p>}
                      {isToday && <p className="text-xs text-blue-600 font-medium">ครบวันนี้</p>}
                    </td>
                    <td className="table-cell text-right font-semibold text-gray-900">
                      {formatCurrency(row.amountDue)}
                    </td>
                    <td className="table-cell text-right">
                      {row.paidAmount > 0
                        ? <span className="text-green-600 font-semibold">{formatCurrency(row.paidAmount)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[row.status]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[row.status]?.label ?? row.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <ChevronRight size={14} className="text-gray-400" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
