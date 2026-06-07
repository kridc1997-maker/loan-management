import { useState, useEffect } from 'react'
import { Search, Skull, CheckCircle } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../utils/financial'
import { badDebtApi } from '../api/endpoints'
import { useAppStore } from '../stores/appStore'
import type { BadDebt as BadDebtType } from '../types'

export default function BadDebt() {
  const { addToast } = useAppStore()
  const [search, setSearch] = useState('')
  const [debts, setDebts] = useState<BadDebtType[]>([])
  const [loading, setLoading] = useState(true)

  const loadDebts = () => {
    setLoading(true)
    badDebtApi.list().then((res) => {
      setDebts(res.data.data ?? [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadDebts() }, [])

  const filtered = debts.filter((d) => {
    const q = search.toLowerCase()
    return !q || `${d.customerName} ${d.loanNumber}`.toLowerCase().includes(q)
  })

  const totalLost = filtered.filter(d => !d.isRecovered).reduce((s, d) => s + d.totalLost, 0)
  const totalRecovered = filtered.filter(d => d.isRecovered).reduce((s, d) => s + (d.recoveredAmount ?? 0), 0)

  const handleRecover = (id: number, loanNumber: string, totalLost: number) => {
    badDebtApi.recover(id, totalLost * 0.5).then(() => {
      addToast('success', `กู้คืนหนี้เสีย ${loanNumber} สำเร็จ`)
      loadDebts()
    }).catch(() => {
      addToast('error', 'เกิดข้อผิดพลาด')
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">หนี้เสีย (Bad Debt)</h1>
        <p className="text-sm text-gray-500 mt-0.5">{filtered.filter(d => !d.isRecovered).length} รายที่ยังค้างอยู่</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card border-l-4 border-red-400 py-4 text-center">
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalLost)}</p>
          <p className="text-xs text-gray-500 mt-0.5">สูญเสียทั้งหมด</p>
        </div>
        <div className="card border-l-4 border-green-400 py-4 text-center">
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalRecovered)}</p>
          <p className="text-xs text-gray-500 mt-0.5">กู้คืนได้</p>
        </div>
        <div className="card border-l-4 border-gray-400 py-4 text-center">
          <p className="text-xl font-bold text-gray-700">{filtered.filter(d => d.isRecovered).length}/{filtered.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">กู้คืนแล้ว</p>
        </div>
      </div>

      <div className="card flex items-center gap-3 py-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เลขสัญญา</th>
                <th className="table-header text-right">เงินต้นที่สูญ</th>
                <th className="table-header text-right">ดอกที่สูญ</th>
                <th className="table-header text-right">รวม</th>
                <th className="table-header text-center">วันที่ตัดหนี้</th>
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
                <tr><td colSpan={8}><EmptyState icon={<Skull size={24} />} title="ไม่มีหนี้เสีย" description="ยอดเยี่ยม!" /></td></tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell">
                      <div>
                        <p className="font-semibold text-gray-900">{d.customerName}</p>
                        <p className="text-xs text-gray-400">{d.reason}</p>
                      </div>
                    </td>
                    <td className="table-cell text-xs font-mono text-gray-500">{d.loanNumber}</td>
                    <td className="table-cell text-right text-red-600 font-semibold">{formatCurrency(d.principalLost)}</td>
                    <td className="table-cell text-right text-orange-600">{formatCurrency(d.interestLost)}</td>
                    <td className="table-cell text-right font-bold text-red-700">{formatCurrency(d.totalLost)}</td>
                    <td className="table-cell text-center text-xs text-gray-500">{formatDate(d.markedDate)}</td>
                    <td className="table-cell text-center">
                      {d.isRecovered ? (
                        <div>
                          <span className="badge-completed">กู้คืนแล้ว</span>
                          <p className="text-xs text-green-600 mt-0.5">{formatCurrency(d.recoveredAmount ?? 0)}</p>
                        </div>
                      ) : (
                        <span className="badge-bad-debt">ยังค้างอยู่</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {!d.isRecovered && (
                        <button
                          onClick={() => handleRecover(d.id, d.loanNumber, d.totalLost)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          <CheckCircle size={13} /> กู้คืน
                        </button>
                      )}
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
