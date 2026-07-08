import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Receipt } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, overdueBadgeClass, daysOverdue, isInstallmentBased } from '../utils/financial'
import { dashboardApi, paymentApi } from '../api/endpoints'
import type { DueTodayItem } from '../types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [dueToday, setDueToday] = useState<DueTodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyPayments, setDailyPayments] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    dashboardApi.dueToday().then((res) => {
      setDueToday(res.data.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    paymentApi.daily(selectedDate).then((res) => {
      setDailyPayments(res.data.data ?? [])
    }).catch(() => {})
  }, [selectedDate])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">หน้าแรก</h1>
        <p className="text-sm text-gray-500 mt-0.5">ภาพรวมธุรกิจวันนี้</p>
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
