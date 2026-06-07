import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, AlertTriangle, Search } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency, formatDate, daysOverdue, overdueBadgeClass } from '../utils/financial'
import { loanApi } from '../api/endpoints'
import { useAppStore } from '../stores/appStore'
import type { Loan } from '../types'

export default function OverdueLoans() {
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const [search, setSearch] = useState('')
  const [overdueLoans, setOverdueLoans] = useState<(Loan & { overdueDays: number })[]>([])
  const [loading, setLoading] = useState(true)

  const loadOverdue = () => {
    setLoading(true)
    loanApi.list({ status: 'overdue', limit: 100 }).then((res) => {
      const rows = (res.data.data ?? []).map((l: Loan) => ({ ...l, overdueDays: daysOverdue(l.dueDate) }))
      rows.sort((a: any, b: any) => b.overdueDays - a.overdueDays)
      setOverdueLoans(rows)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadOverdue() }, [])

  const filtered = overdueLoans.filter((l) => {
    const q = search.toLowerCase()
    return !q || `${l.customerName} ${l.loanNumber} ${l.customerPhone}`.toLowerCase().includes(q)
  })

  const totalOverdue = filtered.reduce((s, l) => s + (l.totalAmount - l.paidPrincipal - l.paidInterest), 0)

  const handleMarkBadDebt = (loan: Loan) => {
    loanApi.markBadDebt(loan.id, 'ค้างชำระเกิน 30 วัน').then(() => {
      addToast('warning', `โอนสัญญา ${loan.loanNumber} เป็นหนี้เสียแล้ว`)
      loadOverdue()
    }).catch(() => {
      addToast('error', 'เกิดข้อผิดพลาด')
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ลูกหนี้ค้างชำระ</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} ราย · ยอดรวม {formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '1–7 วัน', count: filtered.filter(l => l.overdueDays <= 7).length, color: 'yellow' },
          { label: '8–30 วัน', count: filtered.filter(l => l.overdueDays > 7 && l.overdueDays <= 30).length, color: 'orange' },
          { label: '30+ วัน', count: filtered.filter(l => l.overdueDays > 30).length, color: 'red' },
        ].map((s) => (
          <div key={s.label} className={`card text-center py-4 border-l-4 ${
            s.color === 'yellow' ? 'border-yellow-400' : s.color === 'orange' ? 'border-orange-400' : 'border-red-400'
          }`}>
            <p className="text-2xl font-bold text-gray-900">{s.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card flex items-center gap-3 py-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="ค้นหาชื่อลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เลขสัญญา</th>
                <th className="table-header text-right">ยอดค้าง</th>
                <th className="table-header text-center">ค้างมา</th>
                <th className="table-header text-center">ครบกำหนด</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <EmptyState icon={<AlertTriangle size={24} />} title="ไม่มีลูกหนี้ค้างชำระ" description="ยอดเยี่ยม! ทุกสัญญาชำระตรงเวลา" />
                </td></tr>
              ) : (
                filtered.map((loan) => {
                  const outstanding = loan.totalAmount - loan.paidPrincipal - loan.paidInterest
                  return (
                    <tr key={loan.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-cell">
                        <div>
                          <p className="font-semibold text-gray-900">{loan.customerName}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} /> {loan.customerPhone}</p>
                        </div>
                      </td>
                      <td className="table-cell text-xs font-mono text-gray-500">{loan.loanNumber}</td>
                      <td className="table-cell text-right font-bold text-red-600">{formatCurrency(outstanding)}</td>
                      <td className="table-cell text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${overdueBadgeClass(loan.overdueDays)}`}>
                          {loan.overdueDays} วัน
                        </span>
                      </td>
                      <td className="table-cell text-center text-xs text-gray-500">{formatDate(loan.dueDate)}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigate('/payments', { state: { loanId: loan.id } })}
                            className="btn-primary text-xs py-1 px-2.5"
                          >
                            รับชำระ
                          </button>
                          {loan.overdueDays > 30 && (
                            <button
                              onClick={() => handleMarkBadDebt(loan)}
                              className="btn-danger text-xs py-1 px-2.5"
                            >
                              หนี้เสีย
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
