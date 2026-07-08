import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Phone, ChevronRight } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency, formatDate, daysOverdue, todayInputDate, isInstallmentBased } from '../../utils/financial'
import { loanApi } from '../../api/endpoints'
import { useLoanCreationPaused } from '../../hooks/useLoanCreationPaused'
import type { Loan } from '../../types'

export default function ActiveLoans() {
  const navigate = useNavigate()
  const loanCreationPaused = useLoanCreationPaused()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loanApi.list({ limit: 500 }).then((res) => {
      setLoans(res.data.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const activeCount = loans.filter((l) => ['active', 'overdue'].includes(l.status)).length

  // flexible → installment/daily → single
  const loanTypePriority = (type: string) =>
    type === 'flexible' ? 0 : type === 'installment' || type === 'daily' ? 1 : 2

  const filtered = loans
    .filter((l) => {
      const q = search.toLowerCase()
      const matchSearch = !q || `${l.customerName} ${l.loanNumber} ${l.customerPhone}`.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || l.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      const aActive = a.status !== 'completed'
      const bActive = b.status !== 'completed'
      if (aActive !== bActive) return aActive ? -1 : 1
      const typeDiff = loanTypePriority(a.loanType) - loanTypePriority(b.loanType)
      if (typeDiff !== 0) return typeDiff
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">สัญญาสินเชื่อ</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            กำลังชำระ <span className="font-semibold text-blue-600">{activeCount}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            ทั้งหมด {loans.length} สัญญา
          </p>
        </div>
        {!loanCreationPaused && (
          <button onClick={() => navigate('/loans/new')} className="btn-primary">
            <Plus size={16} /> สร้างสัญญาใหม่
          </button>
        )}
      </div>

      <div className="card flex items-center gap-3 py-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="ค้นหาชื่อ, เลขสัญญา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'active', label: 'Active' },
            { value: 'overdue', label: 'ค้างชำระ' },
            { value: 'completed', label: 'ปิดแล้ว' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} รายการ</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เลขสัญญา</th>
                <th className="table-header text-right">เงินต้น</th>
                <th className="table-header text-right">ดอกเบี้ย</th>
                <th className="table-header text-center">งวด</th>
                <th className="table-header text-center">ครบกำหนด</th>
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
                <tr><td colSpan={8}><EmptyState title="ไม่พบสัญญา" description="ลองเปลี่ยนตัวกรอง" /></td></tr>
              ) : (
                filtered.map((loan) => {
                  const overdue = daysOverdue(loan.dueDate)
                  const progress = loan.totalInstallments > 0
                    ? (loan.paidInstallments / loan.totalInstallments) * 100 : 0
                  return (
                    <tr key={loan.id}
                      className={`border-b cursor-pointer transition-colors ${
                        loan.status !== 'completed' && (overdue > 0 || loan.status === 'overdue')
                          ? 'bg-red-50 hover:bg-red-100'
                          : loan.status !== 'completed' && loan.dueDate === todayInputDate()
                            ? 'bg-yellow-50 hover:bg-yellow-100'
                            : 'hover:bg-gray-50'
                      }`}
                      onClick={() => navigate(`/loans/${loan.id}`)}>
                      <td className="table-cell">
                        <div>
                          <p className="font-semibold text-gray-900">{loan.customerName}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone size={10} /> {loan.customerPhone}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs font-mono text-gray-500">{loan.loanNumber}</span>
                      </td>
                      <td className="table-cell text-right font-semibold text-gray-900">
                        {formatCurrency(loan.principalAmount)}
                      </td>
                      <td className="table-cell text-right text-green-600 font-semibold">
                        {formatCurrency(loan.interestAmount)}
                      </td>
                      <td className="table-cell text-center">
                        {isInstallmentBased(loan.loanType) ? (
                          <div>
                            <p className="text-xs text-gray-700 font-medium">{loan.paidInstallments}/{loan.totalInstallments}</p>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mt-1">
                              <div className={`h-full rounded-full ${loan.loanType === 'daily' ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                            </div>
                            {loan.loanType === 'daily' && <p className="text-xs text-orange-500 mt-0.5">รายวัน</p>}
                          </div>
                        ) : loan.loanType === 'flexible' ? (
                          <span className="text-xs text-purple-600 font-medium">ผ่อนยืดหยุ่น</span>
                        ) : (
                          <span className="text-xs text-gray-400">ครั้งเดียว</span>
                        )}
                      </td>
                      <td className="table-cell text-center">
                        <div>
                          <p className="text-xs text-gray-700">{formatDate(loan.dueDate)}</p>
                          {overdue > 0 && loan.status !== 'completed' && (
                            <p className="text-xs text-red-500 font-medium">ค้าง {overdue} วัน</p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <StatusBadge status={loan.status} />
                      </td>
                      <td className="table-cell">
                        <ChevronRight size={15} className="text-gray-400" />
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
