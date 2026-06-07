import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatCurrency, formatDate, isInstallmentBased, daysOverdue } from '../../utils/financial'
import { loanApi, paymentApi } from '../../api/endpoints'
import type { Loan } from '../../types'

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  normal: 'ชำระปกติ',
  partial: 'ชำระบางส่วน',
  full: 'ชำระทั้งหมด',
  rollover: 'ต่อดอก',
  bad_debt_recover: 'ชำระหนี้เสีย',
}

const LOAN_TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  single:      { label: 'ครั้งเดียว', cls: 'bg-gray-100 text-gray-600' },
  installment: { label: 'รายงวด',    cls: 'bg-blue-100 text-blue-700' },
  flexible:    { label: 'ยืดหยุ่น',  cls: 'bg-purple-100 text-purple-700' },
  daily:       { label: 'รายวัน',    cls: 'bg-orange-100 text-orange-700' },
}

export default function LoanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      loanApi.get(Number(id)),
      paymentApi.list({ loanId: id, limit: 200 }),
    ]).then(([lRes, pRes]) => {
      setLoan(lRes.data.data)
      setPayments(pRes.data.data ?? [])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500">ไม่พบสัญญา</p>
        <button onClick={() => navigate('/loans')} className="btn-secondary mt-4">กลับ</button>
      </div>
    )
  }

  const overdue = daysOverdue(loan.dueDate)
  const typeInfo = LOAN_TYPE_LABEL[loan.loanType]
  const totalPaidInterest = payments.reduce((s: number, p: any) => s + Number(p.interest_paid ?? 0), 0)
  const totalPaidPrincipal = payments.reduce((s: number, p: any) => s + Number(p.principal_paid ?? 0), 0)

  // Per-type progress figures
  const progressCols: { label: string; value: string; cls: string }[] = (() => {
    const lt = loan.loanType
    if (lt === 'daily' || lt === 'installment') {
      const paid = (loan.installmentAmount ?? 0) * loan.paidInstallments
      const rem = Math.max(0, Number(loan.totalAmount) - paid)
      return [
        { label: 'ชำระแล้ว', value: formatCurrency(paid), cls: 'text-blue-600' },
        { label: 'คงเหลือ', value: formatCurrency(rem), cls: 'text-orange-600' },
      ]
    }
    if (lt === 'flexible') {
      const paid = totalPaidPrincipal + totalPaidInterest
      const rem = Math.max(0, Number(loan.principalAmount) - totalPaidPrincipal)
      return [
        { label: 'ชำระแล้ว', value: formatCurrency(paid), cls: 'text-blue-600' },
        { label: 'คงเหลือ', value: formatCurrency(rem), cls: 'text-orange-600' },
      ]
    }
    // single: rollover resets paid_interest → 0 on the loan record, so remaining snaps back to totalAmount
    // คงเหลือ = totalAmount − paidPrincipal − paidInterest (both from loan record, not payments history)
    const paidPrincipal = Number(loan.paidPrincipal)
    const paidInterest  = Number(loan.paidInterest)
    const rem = Math.max(0, Number(loan.totalAmount) - paidPrincipal - paidInterest)
    return [
      { label: 'ชำระต้นแล้ว', value: formatCurrency(paidPrincipal), cls: 'text-blue-600' },
      { label: 'ชำระดอกแล้ว', value: formatCurrency(paidInterest), cls: 'text-indigo-600' },
      { label: 'คงเหลือ', value: formatCurrency(rem), cls: 'text-orange-600' },
    ]
  })()

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-secondary w-fit">
          <ArrowLeft size={15} /> กลับ
        </button>
        {['active', 'overdue'].includes(loan.status) && (
          <button
            onClick={() => navigate('/payments', { state: { loanId: loan.id } })}
            className="btn-primary"
          >
            <CreditCard size={15} /> บันทึกการชำระ
          </button>
        )}
      </div>

      {/* Loan summary card */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-sm text-gray-500">{loan.loanNumber}</span>
              <StatusBadge status={loan.status} />
              {typeInfo && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeInfo.cls}`}>
                  {typeInfo.label}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{loan.customerName}</h2>
            <p className="text-sm text-gray-400">{loan.customerPhone}</p>
          </div>
          {overdue > 0 && loan.status !== 'completed' && (
            <span className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg whitespace-nowrap">
              ค้าง {overdue} วัน
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">เงินต้น</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatCurrency(loan.principalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">ดอกเบี้ยรวม</p>
            <p className="text-sm font-semibold text-green-600 mt-0.5">{formatCurrency(loan.interestAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">ยอดรวม</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatCurrency(loan.totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">วันปล่อยกู้</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatDate(loan.issuedDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">ครบกำหนด</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatDate(loan.dueDate)}</p>
          </div>
          {isInstallmentBased(loan.loanType) && (
            <div>
              <p className="text-xs text-gray-400">งวด</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{loan.paidInstallments}/{loan.totalInstallments} งวด</p>
            </div>
          )}
        </div>

        {loan.status !== 'completed' && (
          <div className={`grid gap-4 pt-4 border-t border-gray-100 ${progressCols.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {progressCols.map((col) => (
              <div key={col.label}>
                <p className="text-xs text-gray-400">{col.label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${col.cls}`}>{col.value}</p>
              </div>
            ))}
          </div>
        )}

        {loan.note && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">หมายเหตุ</p>
            <p className="text-sm text-gray-700 mt-0.5">{loan.note}</p>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">ประวัติการชำระ ({payments.length} รายการ)</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีการชำระ</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map((p: any) => {
              const isRollover = p.payment_type === 'rollover'
              return (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isRollover ? 'bg-indigo-100' : 'bg-green-100'}`}>
                      {isRollover
                        ? <RefreshCw size={13} className="text-indigo-600" />
                        : <CreditCard size={13} className="text-green-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {PAYMENT_TYPE_LABEL[p.payment_type] ?? p.payment_type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(String(p.payment_date).slice(0, 10))}
                        {' · '}
                        {p.payment_method === 'cash' ? 'เงินสด' : p.payment_method === 'transfer' ? 'โอน' : 'อื่นๆ'}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-xs text-gray-400">
                      ต้น {formatCurrency(Number(p.principal_paid))} · ดอก {formatCurrency(Number(p.interest_paid))}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
