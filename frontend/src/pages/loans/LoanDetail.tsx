import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, RefreshCw, Pencil, Skull, AlertTriangle, Wallet } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatCurrency, formatDate, isInstallmentBased, daysOverdue } from '../../utils/financial'
import { loanApi, paymentApi } from '../../api/endpoints'
import { useAppStore } from '../../stores/appStore'
import type { Loan } from '../../types'

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  normal: 'ชำระปกติ',
  partial: 'ชำระบางส่วน',
  full: 'ชำระทั้งหมด',
  rollover: 'ต่อดอก',
  bad_debt_recover: 'ชำระหนี้เสีย',
  balance_reset: 'รียอด',
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
  const { addToast } = useAppStore()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Adjust loan amounts (single type only)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustPrincipal, setAdjustPrincipal] = useState('')
  const [adjustTotal, setAdjustTotal] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const [closingLoan, setClosingLoan] = useState(false)
  const [showBadDebtConfirm, setShowBadDebtConfirm] = useState(false)
  const [markingBadDebt, setMarkingBadDebt] = useState(false)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [deductFirstInstallment, setDeductFirstInstallment] = useState(true)
  const [resetting, setResetting] = useState(false)

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

  const handleMarkBadDebt = () => {
    if (!loan || markingBadDebt) return
    setMarkingBadDebt(true)
    loanApi.markBadDebt(loan.id, 'ติดต่อไม่ได้').then(() => {
      addToast('success', `บันทึกหนี้เสีย ${loan.loanNumber} เรียบร้อยแล้ว`)
      navigate('/bad-debt')
    }).catch((err) => {
      addToast('error', err?.response?.data?.error?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => {
      setMarkingBadDebt(false)
      setShowBadDebtConfirm(false)
    })
  }

  const handleResetBalance = () => {
    if (!loan || resetting || !id) return
    setResetting(true)
    loanApi.resetBalance(loan.id, { deductFirstInstallment }).then((res) => {
      setLoan(res.data.data)
      return paymentApi.list({ loanId: id, limit: 200 })
    }).then((pRes) => {
      setPayments(pRes.data.data ?? [])
      addToast('success', `รียอด ${loan.loanNumber} เรียบร้อยแล้ว`)
      setShowResetConfirm(false)
    }).catch((err) => {
      addToast('error', err?.response?.data?.error?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => setResetting(false))
  }

  const handleMarkComplete = () => {
    if (!loan || closingLoan) return
    setClosingLoan(true)
    loanApi.markComplete(loan.id).then((res) => {
      setLoan(res.data.data)
      addToast('success', `ปิดสัญญา ${loan.loanNumber} เรียบร้อยแล้ว`)
    }).catch((err) => {
      addToast('error', err?.response?.data?.error?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => setClosingLoan(false))
  }

  const handleAdjust = () => {
    if (!loan || adjusting) return
    const p = Number(adjustPrincipal)
    const t = Number(adjustTotal)
    if (!p || !t || p <= 0 || t <= 0) {
      addToast('error', 'กรุณากรอกยอดให้ถูกต้อง')
      return
    }
    setAdjusting(true)
    loanApi.adjust(loan.id, { principalAmount: p, totalAmount: t }).then((res) => {
      setLoan(res.data.data)
      setShowAdjustModal(false)
      addToast('success', 'แก้ไขยอดสัญญาสำเร็จ')
    }).catch((err) => {
      addToast('error', err?.response?.data?.error?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => setAdjusting(false))
  }

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

  // "รียอด" (balance reset) — daily loans only, once at least half the installments are paid
  const canReset = loan.loanType === 'daily'
    && ['active', 'overdue'].includes(loan.status)
    && loan.paidInstallments >= loan.totalInstallments / 2
  const resetRemaining = Math.max(0, Number(loan.totalAmount) - (loan.installmentAmount ?? 0) * loan.paidInstallments)
  const resetCashBackRaw = Number(loan.principalAmount) - resetRemaining
  const resetCashBack = deductFirstInstallment ? resetCashBackRaw - (loan.installmentAmount ?? 0) : resetCashBackRaw

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-secondary w-fit">
          <ArrowLeft size={15} /> กลับ
        </button>
        <div className="flex items-center gap-2">
          {loan.loanType === 'single' && ['active', 'overdue'].includes(loan.status) && (
            <button
              onClick={() => {
                setAdjustPrincipal(String(loan.principalAmount))
                setAdjustTotal(String(loan.totalAmount))
                setShowAdjustModal(true)
              }}
              className="btn-secondary w-fit"
            >
              <Pencil size={14} /> แก้ไขยอด
            </button>
          )}
          {['active', 'overdue'].includes(loan.status) && isInstallmentBased(loan.loanType) && loan.paidInstallments >= loan.totalInstallments && (
            <button
              onClick={handleMarkComplete}
              disabled={closingLoan}
              className="btn-secondary w-fit text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={closingLoan ? 'animate-spin' : ''} /> ปิดสัญญา
            </button>
          )}
          {canReset && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="btn-secondary w-fit text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <Wallet size={14} /> รียอด
            </button>
          )}
          {['active', 'overdue'].includes(loan.status) && (
            <button
              onClick={() => setShowBadDebtConfirm(true)}
              className="btn-secondary w-fit text-red-600 border-red-300 hover:bg-red-50"
            >
              <Skull size={14} /> ตีเป็นหนี้เสีย
            </button>
          )}
          {['active', 'overdue'].includes(loan.status) && (
            <button
              onClick={() => navigate('/payments', { state: { loanId: loan.id } })}
              className="btn-primary"
            >
              <CreditCard size={15} /> บันทึกการชำระ
            </button>
          )}
        </div>
      </div>

      {/* Adjust amounts modal (single type only) */}
      {showAdjustModal && loan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Pencil size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">แก้ไขยอดสัญญา</h3>
                <p className="text-xs text-gray-500">{loan.loanNumber} · เฉพาะครั้งเดียวเท่านั้น</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1 text-gray-500">
              <div className="flex justify-between">
                <span>เงินต้นปัจจุบัน</span>
                <span className="font-semibold text-gray-700">{formatCurrency(loan.principalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>ดอกเบี้ยปัจจุบัน</span>
                <span className="font-semibold text-green-600">{formatCurrency(loan.interestAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>ยอดรวมปัจจุบัน</span>
                <span className="font-semibold text-gray-700">{formatCurrency(loan.totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">เงินต้นใหม่ (฿)</label>
                <input
                  type="number"
                  className="input"
                  value={adjustPrincipal}
                  onChange={(e) => setAdjustPrincipal(e.target.value)}
                  min={loan.paidPrincipal}
                />
              </div>
              <div>
                <label className="label">ยอดรวมใหม่ (ต้น+ดอก) (฿)</label>
                <input
                  type="number"
                  className="input"
                  value={adjustTotal}
                  onChange={(e) => setAdjustTotal(e.target.value)}
                  min={Number(adjustPrincipal) || 0}
                />
                {Number(adjustTotal) > 0 && Number(adjustPrincipal) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    ดอกเบี้ยใหม่ = {formatCurrency(Number(adjustTotal) - Number(adjustPrincipal))}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAdjustModal(false)} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
              <button
                onClick={handleAdjust}
                disabled={adjusting || !adjustPrincipal || !adjustTotal}
                className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {adjusting ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bad Debt confirm modal */}
      {showBadDebtConfirm && loan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">ยืนยันตีเป็นหนี้เสีย</h3>
                <p className="text-xs text-gray-500">{loan.loanNumber} · {loan.customerName}</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">เงินต้นคงค้าง</span>
                <span className="font-semibold text-gray-900">{formatCurrency(Number(loan.principalAmount) - Number(loan.paidPrincipal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ดอกเบี้ยคงค้าง</span>
                <span className="font-semibold text-gray-900">{formatCurrency(Number(loan.interestAmount) - Number(loan.paidInterest))}</span>
              </div>
              <div className="flex justify-between border-t border-red-100 pt-1 mt-1">
                <span className="text-gray-700 font-medium">เหตุผล</span>
                <span className="font-semibold text-red-600">ติดต่อไม่ได้</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">การดำเนินการนี้ไม่สามารถย้อนกลับได้ สัญญาจะถูกย้ายไปอยู่ในหมวดหนี้เสีย</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBadDebtConfirm(false)}
                disabled={markingBadDebt}
                className="btn-secondary flex-1 justify-center"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleMarkBadDebt}
                disabled={markingBadDebt}
                className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                <Skull size={14} />
                {markingBadDebt ? 'กำลังบันทึก...' : 'ยืนยันตีหนี้เสีย'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset balance ("รียอด") confirm modal */}
      {showResetConfirm && loan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Wallet size={18} className="text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">ยืนยันการรียอด</h3>
                <p className="text-xs text-gray-500">{loan.loanNumber} · {loan.customerName}</p>
              </div>
            </div>

            <div className="bg-orange-50 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">เงินต้น</span>
                <span className="font-semibold text-gray-900">{formatCurrency(loan.principalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ยอดคงเหลือ</span>
                <span className="font-semibold text-gray-900">{formatCurrency(resetRemaining)}</span>
              </div>
              <div className="flex justify-between border-t border-orange-100 pt-1 mt-1">
                <span className="text-gray-700 font-medium">ยอดที่ลูกค้าจะได้รับ</span>
                <span className="font-bold text-orange-600">{formatCurrency(Math.max(0, resetCashBack))}</span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={deductFirstInstallment}
                onChange={(e) => setDeductFirstInstallment(e.target.checked)}
                className="rounded"
              />
              หักงวดแรก ({formatCurrency(loan.installmentAmount ?? 0)}) ก่อนโอนให้ลูกค้า
            </label>

            <p className="text-xs text-gray-400 text-center">
              สัญญาจะเริ่มนับรอบใหม่ทั้งหมดตั้งแต่วันนี้ ({loan.totalInstallments} งวด)
              {deductFirstInstallment ? ' โดยถือว่างวดที่ 1 ชำระแล้ว' : ''}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="btn-secondary flex-1 justify-center"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetBalance}
                disabled={resetting || resetCashBack <= 0}
                className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                <Wallet size={14} />
                {resetting ? 'กำลังบันทึก...' : 'ยืนยันรียอด'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {loan.loanType === 'single' && (loan.termDays != null || true) && (
            <div>
              <p className="text-xs text-gray-400">จำนวนวันที่กู้</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {loan.termDays ?? Math.round((new Date(loan.dueDate).getTime() - new Date(loan.issuedDate).getTime()) / 86400000)} วัน
              </p>
            </div>
          )}
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
              const isReset = p.payment_type === 'balance_reset'
              return (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isReset ? 'bg-orange-100' : isRollover ? 'bg-indigo-100' : 'bg-green-100'}`}>
                      {isReset
                        ? <Wallet size={13} className="text-orange-600" />
                        : isRollover
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
                    <p className={`text-sm font-bold ${isReset ? 'text-orange-600' : 'text-gray-900'}`}>
                      {isReset ? '-' : ''}{formatCurrency(Number(p.amount))}
                    </p>
                    {!isReset && (
                      <p className="text-xs text-gray-400">
                        ต้น {formatCurrency(Number(p.principal_paid))} · ดอก {formatCurrency(Number(p.interest_paid))}
                        {Number(p.fine_paid) > 0 && (
                          <span className="text-amber-600"> · ค่าปรับ {formatCurrency(Number(p.fine_paid))}</span>
                        )}
                      </p>
                    )}
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
