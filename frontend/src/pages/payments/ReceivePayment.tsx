import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, CheckCircle, AlertCircle, RefreshCw, GitBranch, CalendarClock } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatCurrency, formatDate, todayInputDate, daysOverdue, isInstallmentBased } from '../../utils/financial'
import { loanApi } from '../../api/endpoints'
import type { Loan, Installment, PaymentType } from '../../types'
import { useAppStore } from '../../stores/appStore'

const paymentTypeOptions: { value: PaymentType; label: string; desc: string }[] = [
  { value: 'normal', label: 'ชำระปกติ', desc: 'ชำระตามยอดที่กำหนด' },
  { value: 'partial', label: 'ชำระบางส่วน', desc: 'ชำระน้อยกว่ายอดที่กำหนด' },
  { value: 'full', label: 'ชำระทั้งหมด', desc: 'ปิดสัญญา ชำระยอดคงเหลือทั้งหมด' },
  { value: 'rollover', label: 'ต่อดอก (Rollover)', desc: 'รับดอก แล้วยืดเงินต้นออกไป' },
]

const flexiblePaymentTypeOptions: { value: PaymentType; label: string; desc: string }[] = [
  { value: 'partial', label: 'ชำระบางส่วน', desc: 'จ่ายยอดใดก็ได้' },
  { value: 'full', label: 'ชำระทั้งหมด', desc: 'ปิดสัญญา ชำระยอดคงเหลือทั้งหมด' },
]

export default function ReceivePayment() {
  const location = useLocation()
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const preloadLoanId: number | undefined = location.state?.loanId

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Loan[]>([])
  const [selectedLoan, setSelectedLoan] = useState<Loan | undefined>(undefined)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [paymentType, setPaymentType] = useState<PaymentType>('normal')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayInputDate())
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [note, setNote] = useState('')
  const [fineAmount, setFineAmount] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Convert single → flexible
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)

  // Update due date
  const [showDueDateModal, setShowDueDateModal] = useState(false)
  const [extendDueDate, setExtendDueDate] = useState('')
  const [updatingDueDate, setUpdatingDueDate] = useState(false)

  // Pre-load loan if navigated with loanId
  useEffect(() => {
    if (preloadLoanId) {
      loanApi.get(preloadLoanId).then((res) => {
        const loan = res.data.data
        setSelectedLoan(loan)
        if (loan.loanType === 'flexible') setPaymentType('partial')
      })
    }
  }, [preloadLoanId])

  // Load installments when loan selected
  useEffect(() => {
    if (!selectedLoan) { setInstallments([]); return }
    loanApi.installments(selectedLoan.id).then((res) => {
      setInstallments(res.data.data ?? [])
    })
  }, [selectedLoan])

  // Search loans as user types
  useEffect(() => {
    if (!search) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      loanApi.list({ search, limit: 10 }).then((res) => {
        setSearchResults((res.data.data ?? []).filter((l: Loan) => ['active', 'overdue'].includes(l.status)))
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const overdueCount = selectedLoan ? daysOverdue(selectedLoan.dueDate) : 0
  const pendingInstallments = installments.filter((i) => i.status !== 'paid')
  const isFlexible = selectedLoan?.loanType === 'flexible'

  const currentInstallment = (!isFlexible) ? pendingInstallments[0] : undefined
  const activePaymentOptions = isFlexible ? flexiblePaymentTypeOptions : paymentTypeOptions

  const remainingBalance = selectedLoan
    ? selectedLoan.totalAmount - selectedLoan.paidPrincipal - selectedLoan.paidInterest
    : 0

  const suggestedAmount =
    paymentType === 'normal' && currentInstallment ? currentInstallment.amountDue
    : paymentType === 'full' && selectedLoan ? remainingBalance
    : paymentType === 'rollover' && selectedLoan ? selectedLoan.interestAmount - selectedLoan.paidInterest
    : 0

  const handleUpdateDueDate = () => {
    if (!selectedLoan || !extendDueDate || updatingDueDate) return
    setUpdatingDueDate(true)
    loanApi.updateDueDate(selectedLoan.id, extendDueDate).then((res) => {
      setSelectedLoan(res.data.data)
      loanApi.installments(res.data.data.id).then((r) => setInstallments(r.data.data ?? []))
      addToast('success', `เลื่อนวันครบกำหนดเป็น ${extendDueDate} สำเร็จ!`)
      setShowDueDateModal(false)
    }).catch((err) => {
      addToast('error', err?.response?.data?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => setUpdatingDueDate(false))
  }

  const handleConvert = () => {
    if (!selectedLoan || converting) return
    setConverting(true)
    loanApi.convertToFlexible(selectedLoan.id).then((res) => {
      const updated = res.data.data
      setSelectedLoan(updated)
      setInstallments([])
      setPaymentType('partial')
      addToast('success', `เปลี่ยนสัญญา ${selectedLoan.loanNumber} เป็นผ่อนยืดหยุ่นสำเร็จ!`)
      setShowConvertModal(false)
    }).catch((err) => {
      addToast('error', err?.response?.data?.message ?? 'เกิดข้อผิดพลาด')
    }).finally(() => setConverting(false))
  }

  const fine = Number(fineAmount) || 0
  const totalReceived = (Number(amount) || 0) + fine

  const handleSubmit = () => {
    if (!selectedLoan || submitting) return
    if (totalReceived <= 0) return
    setSubmitting(true)

    const payload = {
      amount: totalReceived,
      ...(fine > 0 ? { finePaid: fine } : {}),
      paymentType,
      paymentMethod,
      paymentDate,
      note,
      ...(paymentType === 'rollover' && newDueDate ? { newDueDate } : {}),
      ...(currentInstallment ? { installmentId: currentInstallment.id } : {}),
    }

    loanApi.payment(selectedLoan.id, payload as any).then(() => {
      const fineStr = fine > 0 ? ` (ค่าปรับ ${formatCurrency(fine)})` : ''
      let msg = ''
      if (paymentType === 'rollover') {
        msg = `ต่อดอก ${formatCurrency(Number(amount))} จากสัญญา ${selectedLoan.loanNumber} สำเร็จ!${fineStr}`
      } else if (paymentType === 'full') {
        msg = `ปิดสัญญา ${selectedLoan.loanNumber} เรียบร้อย! รับ ${formatCurrency(totalReceived)}${fineStr}`
      } else {
        msg = `รับชำระ ${formatCurrency(totalReceived)} จาก ${selectedLoan.customerName} สำเร็จ!${fineStr}`
      }
      addToast('success', msg)
      window.dispatchEvent(new Event('header-refresh'))
      setSubmitted(true)
    }).catch((err) => {
      const msg = err?.response?.data?.error?.message ?? 'เกิดข้อผิดพลาด'
      addToast('error', msg)
    }).finally(() => setSubmitting(false))
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">บันทึกสำเร็จ!</h2>
        <p className="text-sm text-gray-500 mb-6">รายการชำระถูกบันทึกเรียบร้อยแล้ว</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false)
              setSelectedLoan(undefined)
              setInstallments([])
              setAmount('')
              setFineAmount('')
              setSearch('')
              setSearchResults([])
            }}
            className="btn-secondary"
          >
            รับชำระรายการใหม่
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รับชำระเงิน</h1>
          <p className="text-sm text-gray-500 mt-0.5">ค้นหาสัญญาและบันทึกการรับชำระ</p>
        </div>
        <button onClick={() => navigate(-1)} className="btn-secondary w-fit">
          <ArrowLeft size={15} /> กลับ
        </button>
      </div>

      {/* Search Loan */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">ค้นหาสัญญา</h2>
        {selectedLoan ? (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{selectedLoan.customerName}</p>
                  <StatusBadge status={selectedLoan.status} />
                  {overdueCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      ค้าง {overdueCount} วัน
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{selectedLoan.loanNumber} · {selectedLoan.customerPhone}</p>
              </div>
              <div className="flex gap-2 items-center flex-wrap justify-end">
                <button
                  onClick={() => { setExtendDueDate(selectedLoan.dueDate); setShowDueDateModal(true) }}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                >
                  <CalendarClock size={11} /> เลื่อนวันครบกำหนด
                </button>
                {selectedLoan.loanType === 'single' && (
                  <button
                    onClick={() => setShowConvertModal(true)}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    <GitBranch size={11} /> เปลี่ยนเป็นผ่อนยืดหยุ่น
                  </button>
                )}
                <button onClick={() => { setSelectedLoan(undefined); setInstallments([]) }} className="text-xs text-blue-600 hover:text-blue-800">เปลี่ยน</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">เงินต้น</p>
                <p className="font-semibold text-gray-900">{formatCurrency(selectedLoan.principalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ดอกเบี้ย</p>
                <p className="font-semibold text-green-700">{formatCurrency(selectedLoan.interestAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ครบกำหนด</p>
                <p className="font-semibold text-gray-900">{formatDate(selectedLoan.dueDate)}</p>
              </div>
            </div>

            {isInstallmentBased(selectedLoan.loanType) && currentInstallment && (
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${selectedLoan.loanType === 'daily' ? 'bg-orange-50 border-orange-100' : 'bg-white border-blue-100'}`}>
                <AlertCircle size={14} className={selectedLoan.loanType === 'daily' ? 'text-orange-500 flex-shrink-0' : 'text-blue-500 flex-shrink-0'} />
                <span className="text-gray-700">
                  {selectedLoan.loanType === 'daily' ? 'วันถัดไป' : 'งวดถัดไป'}: <strong>งวด {currentInstallment.installmentNo}/{selectedLoan.totalInstallments}</strong>
                  {' '}ยอด <strong>{formatCurrency(currentInstallment.amountDue)}</strong>
                  {' '}ครบ {formatDate(currentInstallment.dueDate)}
                </span>
              </div>
            )}
            {selectedLoan.loanType === 'flexible' && (
              <div className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-sm">
                <AlertCircle size={14} className="text-purple-500 flex-shrink-0" />
                <span className="text-gray-700">
                  คงค้าง: <strong className="text-purple-700">{formatCurrency(remainingBalance)}</strong>
                  {' '}· ชำระได้ยอดใดก็ได้
                </span>
              </div>
            )}
            {selectedLoan.loanType === 'daily' && !currentInstallment && (
              <div className="flex items-center gap-2 p-2.5 bg-orange-50 rounded-lg border border-orange-100 text-sm">
                <AlertCircle size={14} className="text-orange-500 flex-shrink-0" />
                <span className="text-gray-700">
                  คงค้าง: <strong className="text-orange-700">{formatCurrency(remainingBalance)}</strong>
                  {' '}· รายวัน {selectedLoan.installmentAmount ? `วันละ ${formatCurrency(selectedLoan.installmentAmount)}` : ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="ค้นหาชื่อลูกค้า, เลขสัญญา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                {searchResults.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer"
                    onClick={() => { setSelectedLoan(l); setSearch(''); setSearchResults([]) }}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{l.customerName}</p>
                      <p className="text-xs text-gray-400">{l.loanNumber} · {formatCurrency(l.totalAmount - l.paidPrincipal - l.paidInterest)} คงค้าง</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extend due date modal */}
      {showDueDateModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <CalendarClock size={18} className="text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">เลื่อนวันครบกำหนดชำระ</h3>
                <p className="text-xs text-gray-500">{selectedLoan.loanNumber} · {selectedLoan.customerName}</p>
              </div>
            </div>

            <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-sm flex justify-between">
              <span className="text-gray-500">วันครบกำหนดเดิม</span>
              <span className="font-semibold text-gray-800">{formatDate(selectedLoan.dueDate)}</span>
            </div>

            <div>
              <label className="label">วันครบกำหนดใหม่</label>
              <input
                type="date"
                className="input"
                value={extendDueDate}
                min={selectedLoan.dueDate}
                onChange={(e) => setExtendDueDate(e.target.value)}
              />
              {isInstallmentBased(selectedLoan.loanType) && (
                <p className="text-xs text-gray-400 mt-1">งวดที่ยังค้างอยู่จะถูกเลื่อนตามจำนวนวันที่เพิ่ม</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDueDateModal(false)} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
              <button
                onClick={handleUpdateDueDate}
                disabled={updatingDueDate || !extendDueDate || extendDueDate === selectedLoan.dueDate}
                className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {updatingDueDate ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert single → flexible modal */}
      {showConvertModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <GitBranch size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">เปลี่ยนเป็นผ่อนยืดหยุ่น</h3>
                <p className="text-xs text-gray-500">{selectedLoan.loanNumber} · {selectedLoan.customerName}</p>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">ยอดคงค้าง</span>
                <span className="font-bold text-purple-700">{formatCurrency(remainingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันครบกำหนดเดิม</span>
                <span className="text-gray-700">{formatDate(selectedLoan.dueDate)}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              หลังเปลี่ยน ลูกค้าจะชำระได้ทุกเมื่อ ยอดเท่าไรก็ได้ ภายในวันครบกำหนดเดิม ระบบจะหักดอกก่อนแล้วตัดเงินต้น
            </p>

            <div className="flex gap-3">
              <button onClick={() => setShowConvertModal(false)} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {converting ? 'กำลังเปลี่ยน...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form */}
      {selectedLoan && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">รายละเอียดการชำระ</h2>

          <div>
            <label className="label">ประเภทการชำระ</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {activePaymentOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentType === opt.value
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentType"
                    value={opt.value}
                    checked={paymentType === opt.value}
                    onChange={() => {
                      setPaymentType(opt.value)
                      if (suggestedAmount > 0) setAmount(String(suggestedAmount))
                    }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {paymentType === 'rollover' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-purple-600" />
                <p className="text-xs font-semibold text-purple-800">ต่อดอก — ยืดเงินต้น {formatCurrency(selectedLoan.principalAmount)} ออกไป</p>
              </div>
              <div>
                <label className="label">วันครบกำหนดใหม่</label>
                <input type="date" className="input" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ยอดชำระสัญญา (ต้น+ดอก) (฿) *</label>
              <input
                type="number"
                className="input"
                placeholder={suggestedAmount > 0 ? String(suggestedAmount) : '0'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {suggestedAmount > 0 && (
                <button
                  type="button"
                  className="mt-1 text-xs text-blue-600 hover:underline"
                  onClick={() => setAmount(String(suggestedAmount))}
                >
                  ใส่ยอดแนะนำ {formatCurrency(suggestedAmount)}
                </button>
              )}
            </div>
            <div>
              <label className="label">วันที่รับ</label>
              <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          {/* Fine / Penalty field */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label mb-0">ค่าปรับ (฿)</label>
              {fine > 0 && (
                <span className="text-xs text-amber-700 font-medium">
                  รวมรับ {formatCurrency(totalReceived)}
                </span>
              )}
            </div>
            <input
              type="number"
              className="input bg-white"
              placeholder="0 (ไม่มีค่าปรับ)"
              value={fineAmount}
              onChange={(e) => setFineAmount(e.target.value)}
              min="0"
            />
            {fine > 0 && (
              <p className="text-xs text-amber-600">
                ค่าปรับนับเป็นกำไร · ยอดชำระสัญญา {formatCurrency(Number(amount) || 0)} + ค่าปรับ {formatCurrency(fine)}
              </p>
            )}
          </div>

          <div>
            <label className="label">ช่องทางการรับ</label>
            <div className="flex gap-3">
              {[{ value: 'cash', label: 'เงินสด' }, { value: 'transfer', label: 'โอนเงิน' }].map((m) => (
                <label key={m.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="paymentMethod" value={m.value} checked={paymentMethod === m.value}
                    onChange={() => setPaymentMethod(m.value as 'cash' | 'transfer')} className="accent-blue-600" />
                  <span className="text-sm text-gray-700">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">หมายเหตุ</label>
            <input className="input" placeholder="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <button
            onClick={handleSubmit}
            disabled={totalReceived <= 0 || submitting}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={16} /> {submitting ? 'กำลังบันทึก...' : `บันทึกการรับชำระ ${totalReceived > 0 ? formatCurrency(totalReceived) : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
