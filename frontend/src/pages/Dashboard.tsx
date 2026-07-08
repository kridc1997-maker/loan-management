import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Receipt, Eye, Trash2 } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatDate, overdueBadgeClass, daysOverdue, isInstallmentBased } from '../utils/financial'
import { dashboardApi, paymentApi, loanApi } from '../api/endpoints'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import type { DueTodayItem, Loan } from '../types'

const LOAN_TYPE_LABEL: Record<string, string> = {
  single: 'ครั้งเดียว', installment: 'รายงวด', flexible: 'ยืดหยุ่น', daily: 'รายวัน',
}

const NON_DELETABLE_PAYMENT_TYPES = ['rollover', 'balance_reset', 'bad_debt_recover']

function DeletePaymentModal({ payment, onClose, onDeleted }: { payment: any; onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleConfirm = () => {
    if (!password) { setErr('กรุณากรอกรหัสผ่าน'); return }
    setSaving(true); setErr('')
    paymentApi.remove(payment.id, password).then(() => {
      onDeleted()
    }).catch((e) => {
      setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => setSaving(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">ยืนยันลบการรับชำระ</h3>
            <p className="text-xs text-gray-500">{payment.customer_name} · {formatCurrency(Number(payment.amount))}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">การลบนี้จะย้อนยอดที่ชำระไปแล้วกลับคืนสัญญา กรุณากรอกรหัสผ่านของคุณเพื่อยืนยัน</p>
        <div>
          <label className="label">รหัสผ่านของคุณ</label>
          <input type="password" className="input" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่าน" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }} />
        </div>
        {err && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {err}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'กำลังลบ...' : 'ยืนยันลบ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LoanQuickView({ loanId, onClose }: { loanId: number; onClose: () => void }) {
  const navigate = useNavigate()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loanApi.get(loanId).then((res) => setLoan(res.data.data)).finally(() => setLoading(false))
  }, [loanId])

  const paid = loan ? Number(loan.paidPrincipal) + Number(loan.paidInterest) : 0
  const remaining = loan ? Math.max(0, Number(loan.totalAmount) - paid) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        {loading || !loan ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-sm text-gray-500">{loan.loanNumber}</span>
                  <StatusBadge status={loan.status} />
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    {LOAN_TYPE_LABEL[loan.loanType] ?? loan.loanType}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900">{loan.customerName}</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} /> {loan.customerPhone}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg leading-none flex-shrink-0">×</button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 text-sm">
              <div>
                <p className="text-xs text-gray-400">เงินต้น</p>
                <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(loan.principalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">ดอกเบี้ยรวม</p>
                <p className="font-semibold text-green-600 mt-0.5">{formatCurrency(loan.interestAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">ยอดรวม</p>
                <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(loan.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">คงเหลือ</p>
                <p className="font-semibold text-orange-600 mt-0.5">{formatCurrency(remaining)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">วันปล่อยกู้</p>
                <p className="font-semibold text-gray-900 mt-0.5">{formatDate(loan.issuedDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">ครบกำหนด</p>
                <p className="font-semibold text-gray-900 mt-0.5">{formatDate(loan.dueDate)}</p>
              </div>
              {isInstallmentBased(loan.loanType) && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">งวด</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{loan.paidInstallments}/{loan.totalInstallments} งวด</p>
                </div>
              )}
              {loan.note && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">หมายเหตุ</p>
                  <p className="text-gray-700 mt-0.5">{loan.note}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">ปิด</button>
              <button onClick={() => navigate(`/loans/${loan.id}`)} className="btn-primary flex-1 justify-center">
                ดูรายละเอียดเต็ม
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const { user: me } = useAuthStore()
  const today = new Date().toISOString().split('T')[0]
  const [dueToday, setDueToday] = useState<DueTodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyPayments, setDailyPayments] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewLoanId, setViewLoanId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  const loadDueToday = () => {
    dashboardApi.dueToday().then((res) => {
      setDueToday(res.data.data ?? [])
    }).finally(() => setLoading(false))
  }

  const loadDailyPayments = () => {
    paymentApi.daily(selectedDate).then((res) => {
      setDailyPayments(res.data.data ?? [])
    }).catch(() => {})
  }

  useEffect(loadDueToday, [])
  useEffect(loadDailyPayments, [selectedDate])

  const handlePaymentDeleted = () => {
    setDeleteTarget(null)
    addToast('success', 'ลบรายการรับชำระเรียบร้อยแล้ว')
    loadDailyPayments()
    loadDueToday()
  }

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
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setViewLoanId(item.loanId)}
                            title="ดูข้อมูลสัญญา"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => navigate('/payments', { state: { loanId: item.loanId } })}
                            className="btn-primary text-xs py-1 px-2.5"
                          >
                            รับชำระ
                          </button>
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
                {me?.role === 'admin' && <th className="table-header" />}
              </tr>
            </thead>
            <tbody>
              {dailyPayments.length === 0 ? (
                <tr>
                  <td colSpan={me?.role === 'admin' ? 8 : 7} className="text-center py-8 text-sm text-gray-400">ไม่มีรายการรับชำระในวันนี้</td>
                </tr>
              ) : (
                dailyPayments.map((p) => {
                  const wrongDate = selectedDate !== today
                  const wrongType = NON_DELETABLE_PAYMENT_TYPES.includes(p.payment_type)
                  const deletable = !wrongDate && !wrongType
                  const blockedReason = wrongDate ? 'ลบได้เฉพาะรายการวันนี้เท่านั้น' : wrongType ? 'ลบไม่ได้: ต่อดอก/รียอด/หนี้เสีย' : ''
                  return (
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
                      {me?.role === 'admin' && (
                        <td className="table-cell">
                          <button
                            onClick={() => deletable && setDeleteTarget(p)}
                            disabled={!deletable}
                            title={deletable ? 'ลบรายการรับชำระ' : blockedReason}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewLoanId && <LoanQuickView loanId={viewLoanId} onClose={() => setViewLoanId(null)} />}
      {deleteTarget && (
        <DeletePaymentModal
          payment={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handlePaymentDeleted}
        />
      )}
    </div>
  )
}
