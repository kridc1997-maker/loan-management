import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Calculator, Calendar, CheckCircle, History } from 'lucide-react'
import { customerApi, loanApi } from '../../api/endpoints'
import type { Customer, LoanType } from '../../types'
import { useAppStore } from '../../stores/appStore'
import {
  formatCurrency, todayInputDate, addDays, calcInstallmentAmount,
  generateInstallmentSchedule, formatDate,
} from '../../utils/financial'

export default function NewLoan() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useAppStore()

  const preCustomerId: number | undefined = location.state?.customerId
  const preCustomerName: string | undefined = location.state?.customerName

  const [customerSearch, setCustomerSearch] = useState(preCustomerName ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined)
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [principal, setPrincipal] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [loanType, setLoanType] = useState<LoanType>('single')
  const [installmentCount, setInstallmentCount] = useState(1)
  const [issuedDate, setIssuedDate] = useState(todayInputDate())
  const [durationDays, setDurationDays] = useState(7)
  const [dailyAmount, setDailyAmount] = useState('')
  const [note, setNote] = useState('')

  // Pre-paid installments (for importing old data)
  const [hasPrePaid, setHasPrePaid] = useState(false)
  const [prePaidCount, setPrePaidCount] = useState(0)

  useEffect(() => {
    if (preCustomerId) {
      customerApi.get(preCustomerId).then((res) => setSelectedCustomer(res.data.data))
    }
  }, [preCustomerId])

  useEffect(() => {
    if (!customerSearch || selectedCustomer) { setCustomerResults([]); return }
    const timer = setTimeout(() => {
      customerApi.list({ search: customerSearch, limit: 10 }).then((res) => {
        setCustomerResults(res.data.data ?? [])
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, selectedCustomer])

  // daily: count from dailyAmount, 1-day spacing
  const dailyCount = loanType === 'daily' && Number(dailyAmount) > 0 && Number(totalAmount) > 0
    ? Math.ceil(Number(totalAmount) / Number(dailyAmount))
    : installmentCount

  const dueDate = loanType === 'installment'
    ? addDays(issuedDate, durationDays * installmentCount)
    : loanType === 'daily'
      ? addDays(issuedDate, Math.max(0, dailyCount - 1))
      : addDays(issuedDate, durationDays)

  const interest = (Number(totalAmount) || 0) - (Number(principal) || 0)
  const interestRate = Number(principal) > 0 ? interest / Number(principal) : 0
  const installmentAmount = loanType === 'installment'
    ? calcInstallmentAmount(Number(totalAmount) || 0, installmentCount)
    : loanType === 'daily'
      ? Number(dailyAmount) || 0
      : Number(totalAmount) || 0

  const schedule = (loanType === 'installment' && Number(totalAmount) > 0)
    ? generateInstallmentSchedule(issuedDate, Number(totalAmount), installmentCount, durationDays)
    : (loanType === 'daily' && Number(totalAmount) > 0 && Number(dailyAmount) > 0)
      ? generateInstallmentSchedule(addDays(issuedDate, -1), Number(totalAmount), dailyCount, 1)
      : []

  const canProceed = selectedCustomer && Number(principal) > 0 && Number(totalAmount) >= Number(principal)
    && (loanType !== 'daily' || Number(dailyAmount) > 0)

  const handleSubmit = () => {
    if (!canProceed || submitting) return
    setSubmitting(true)
    loanApi.create({
      customerId: selectedCustomer!.id,
      principalAmount: Number(principal),
      totalAmount: Number(totalAmount),
      loanType,
      totalInstallments: loanType === 'installment' ? installmentCount : loanType === 'daily' ? dailyCount : loanType === 'flexible' ? 0 : 1,
      issuedDate,
      dueDate,
      note,
      ...((loanType === 'installment' || loanType === 'daily') && hasPrePaid && prePaidCount > 0 ? { paidInstallmentsCount: prePaidCount } : {}),
    } as any).then(() => {
      addToast('success', `สร้างสัญญาสำเร็จ! ปล่อยกู้ ${formatCurrency(Number(principal))} ให้ ${selectedCustomer!.firstName}`)
      navigate('/loans')
    }).catch((err) => {
      const msg = err?.response?.data?.error?.message ?? 'เกิดข้อผิดพลาด'
      addToast('error', msg)
    }).finally(() => setSubmitting(false))
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">สร้างสัญญาเงินกู้ใหม่</h1>
        <p className="text-sm text-gray-500 mt-0.5">กรอกข้อมูลสัญญาให้ครบถ้วน</p>
      </div>

      {/* Step 1: Customer */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
          <h2 className="text-sm font-semibold text-gray-900">เลือกลูกค้า</h2>
        </div>

        {selectedCustomer ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center font-bold text-blue-800">
              {selectedCustomer.firstName[0]}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
              <p className="text-xs text-gray-500">{selectedCustomer.phone} · {selectedCustomer.code}</p>
            </div>
            <button onClick={() => { setSelectedCustomer(undefined); setCustomerSearch('') }}
              className="text-xs text-blue-600 hover:text-blue-800">เปลี่ยน</button>
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="ค้นหาชื่อหรือเบอร์โทรลูกค้า..."
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)} />
            {searchOpen && customerResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                {customerResults.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer"
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(`${c.firstName} ${c.lastName}`); setSearchOpen(false) }}>
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                      {c.firstName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Loan Detail */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
          <h2 className="text-sm font-semibold text-gray-900">รายละเอียดสินเชื่อ</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">เงินต้น (฿) *</label>
            <input type="number" className="input" placeholder="0"
              value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
          <div>
            <label className="label">ยอดที่ต้องชำระ (฿) *</label>
            <input type="number" className="input" placeholder="0"
              value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
          </div>
        </div>

        {Number(principal) > 0 && Number(totalAmount) > Number(principal) && (
          <div className="flex gap-4 p-3 bg-green-50 rounded-xl text-sm">
            <div>
              <p className="text-xs text-gray-500">ดอกเบี้ย</p>
              <p className="font-bold text-green-700">{formatCurrency(interest)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">อัตราดอก</p>
              <p className="font-bold text-green-700">{(interestRate * 100).toFixed(1)}%</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">วันที่ปล่อยกู้</label>
            <input type="date" className="input" value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)} />
          </div>
          {loanType !== 'daily' && (
            <div>
              <label className="label">
                {loanType === 'installment' ? 'ระยะห่างระหว่างงวด (วัน)' : loanType === 'flexible' ? 'ครบกำหนดภายใน (วัน)' : 'ระยะเวลา (วัน)'}
              </label>
              <input type="number" className="input" value={durationDays} min={1}
                onChange={(e) => setDurationDays(Number(e.target.value))} />
            </div>
          )}
        </div>

        {loanType !== 'daily' && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar size={13} />
            <span>ครบกำหนด: <strong className="text-gray-900">{formatDate(dueDate)}</strong>
              {loanType === 'installment' && ` (งวดสุดท้ายวันที่ ${formatDate(dueDate)})`}
            </span>
          </div>
        )}

        <div>
          <label className="label">ประเภทการชำระ</label>
          <div className="flex gap-3 flex-wrap">
            {[
              { value: 'single',      label: 'ครั้งเดียว',    desc: 'จ่ายครบรวดเดียว' },
              { value: 'installment', label: 'แบ่งงวด',       desc: 'จ่ายตามตาราง' },
              { value: 'daily',       label: 'รายวัน',        desc: 'จ่ายวันละยอดที่กำหนด' },
              { value: 'flexible',    label: 'ผ่อนยืดหยุ่น', desc: 'จ่ายเมื่อไร ยอดเท่าไรก็ได้' },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${loanType === opt.value ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                <input type="radio" name="loanType" value={opt.value} checked={loanType === opt.value}
                  onChange={() => {
                    setLoanType(opt.value as LoanType)
                    setHasPrePaid(false)
                    setPrePaidCount(0)
                    if (opt.value === 'flexible') setDurationDays(365)
                    else if (opt.value !== 'flexible') setDurationDays(7)
                    if (opt.value === 'daily') setDailyAmount('')
                  }}
                  className="accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {loanType === 'flexible' && (
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-800 space-y-1">
            <p className="font-semibold">สัญญาผ่อนยืดหยุ่น</p>
            <p className="text-purple-600">ลูกค้าสามารถชำระได้ทุกเมื่อ ยอดเท่าไรก็ได้ ระบบจะหักดอกก่อนแล้วตามด้วยเงินต้น จนกว่าจะครบยอดรวมที่กำหนด</p>
          </div>
        )}

        {loanType === 'daily' && (
          <div className="space-y-3">
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-xs text-orange-800 space-y-1">
              <p className="font-semibold">สัญญารายวัน</p>
              <p className="text-orange-600">กำหนดยอดชำระต่อวัน ระบบจะสร้างตารางชำระรายวันโดยอัตโนมัติ จำนวนวันยืดหยุ่นตามยอดที่ตั้งไว้</p>
            </div>

            <div>
              <label className="label">ยอดชำระต่อวัน (฿) *</label>
              <input type="number" className="input w-40" placeholder="0" min={1}
                value={dailyAmount} onChange={(e) => {
                  setDailyAmount(e.target.value)
                  const newCount = Number(e.target.value) > 0 && Number(totalAmount) > 0
                    ? Math.ceil(Number(totalAmount) / Number(e.target.value)) : 0
                  if (prePaidCount >= newCount) setPrePaidCount(0)
                }} />
            </div>

            {Number(dailyAmount) > 0 && Number(totalAmount) > 0 && (
              <div className="flex gap-4 p-3 bg-orange-50 rounded-xl text-sm">
                <div>
                  <p className="text-xs text-gray-500">จำนวนวัน</p>
                  <p className="font-bold text-orange-700">{dailyCount} วัน</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">งวดสุดท้าย</p>
                  <p className="font-bold text-orange-700">{formatCurrency(Number(totalAmount) - Number(dailyAmount) * (dailyCount - 1))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">ครบกำหนด</p>
                  <p className="font-bold text-orange-700">{formatDate(dueDate)}</p>
                </div>
              </div>
            )}

            {schedule.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600">ตารางชำระรายวัน ({schedule.length} วัน)</p>
                </div>
                <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                  {schedule.map((s, i) => {
                    const isPaid = hasPrePaid && i < prePaidCount
                    return (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${isPaid ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${isPaid ? 'bg-green-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                            {isPaid ? '✓' : i + 1}
                          </span>
                          <span className={isPaid ? 'text-green-600' : 'text-gray-500'}>{formatDate(s.dueDate)}</span>
                          {isPaid && <span className="text-xs text-green-600 font-medium">ชำระแล้ว</span>}
                        </div>
                        <span className={`font-semibold ${isPaid ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(s.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pre-paid days for importing old data */}
            {dailyCount > 0 && (
              <div className={`rounded-xl border transition-all ${hasPrePaid ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input type="checkbox" className="accent-amber-500 w-4 h-4"
                    checked={hasPrePaid}
                    onChange={(e) => { setHasPrePaid(e.target.checked); if (!e.target.checked) setPrePaidCount(0) }} />
                  <div className="flex items-center gap-2">
                    <History size={14} className={hasPrePaid ? 'text-amber-600' : 'text-gray-400'} />
                    <span className={`text-sm font-medium ${hasPrePaid ? 'text-amber-800' : 'text-gray-600'}`}>
                      นำเข้าข้อมูลเก่า — มีวันที่ชำระไปแล้ว
                    </span>
                  </div>
                </label>

                {hasPrePaid && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-amber-700">ระบุจำนวนวันที่ลูกค้าชำระไปแล้วก่อนเริ่มใช้ระบบ</p>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-amber-800 font-medium whitespace-nowrap">วันที่ชำระแล้ว:</label>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 font-bold flex items-center justify-center hover:bg-amber-300 transition-colors"
                          onClick={() => setPrePaidCount(Math.max(0, prePaidCount - 1))}>−</button>
                        <span className="w-10 text-center font-bold text-amber-900 text-lg">{prePaidCount}</span>
                        <button type="button"
                          className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 font-bold flex items-center justify-center hover:bg-amber-300 transition-colors"
                          onClick={() => setPrePaidCount(Math.min(dailyCount - 1, prePaidCount + 1))}>+</button>
                        <span className="text-xs text-amber-600">จาก {dailyCount} วัน</span>
                      </div>
                    </div>
                    {prePaidCount > 0 && Number(totalAmount) > 0 && (
                      <div className="flex gap-4 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                        <span>ชำระไปแล้ว: <strong>{formatCurrency(Number(dailyAmount) * prePaidCount)}</strong></span>
                        <span>คงเหลือ: <strong>{formatCurrency(Number(totalAmount) - Number(dailyAmount) * prePaidCount)}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loanType === 'installment' && (
          <div className="space-y-3">
            <div>
              <label className="label">จำนวนงวด</label>
              <select className="input w-32" value={installmentCount}
                onChange={(e) => { setInstallmentCount(Number(e.target.value)); setPrePaidCount(0) }}>
                {[2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n} งวด</option>
                ))}
              </select>
            </div>

            {Number(totalAmount) > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Calculator size={13} className="text-gray-400" />
                <span className="text-gray-600">งวดละ <strong className="text-blue-700">{formatCurrency(installmentAmount)}</strong>
                  <span className="text-gray-400 text-xs ml-2">· ทุก {durationDays} วัน</span>
                </span>
              </div>
            )}

            {schedule.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600">ตารางผ่อนชำระ</p>
                </div>
                <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                  {schedule.map((s, i) => {
                    const isPaid = hasPrePaid && i < prePaidCount
                    return (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${isPaid ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${isPaid ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                            {isPaid ? '✓' : i + 1}
                          </span>
                          <span className={`${isPaid ? 'text-green-600' : 'text-gray-500'}`}>{formatDate(s.dueDate)}</span>
                          {isPaid && <span className="text-xs text-green-600 font-medium">ชำระแล้ว</span>}
                        </div>
                        <span className={`font-semibold ${isPaid ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(s.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pre-paid installments for importing old data */}
            <div className={`rounded-xl border transition-all ${hasPrePaid ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                <input type="checkbox" className="accent-amber-500 w-4 h-4"
                  checked={hasPrePaid}
                  onChange={(e) => { setHasPrePaid(e.target.checked); if (!e.target.checked) setPrePaidCount(0) }} />
                <div className="flex items-center gap-2">
                  <History size={14} className={hasPrePaid ? 'text-amber-600' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${hasPrePaid ? 'text-amber-800' : 'text-gray-600'}`}>
                    นำเข้าข้อมูลเก่า — มีงวดที่ชำระไปแล้ว
                  </span>
                </div>
              </label>

              {hasPrePaid && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-amber-700">ระบุจำนวนงวดที่ลูกค้าชำระไปแล้วก่อนเริ่มใช้ระบบ</p>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-amber-800 font-medium whitespace-nowrap">งวดที่ชำระแล้ว:</label>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 font-bold flex items-center justify-center hover:bg-amber-300 transition-colors"
                        onClick={() => setPrePaidCount(Math.max(0, prePaidCount - 1))}>−</button>
                      <span className="w-10 text-center font-bold text-amber-900 text-lg">{prePaidCount}</span>
                      <button type="button"
                        className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 font-bold flex items-center justify-center hover:bg-amber-300 transition-colors"
                        onClick={() => setPrePaidCount(Math.min(installmentCount - 1, prePaidCount + 1))}>+</button>
                      <span className="text-xs text-amber-600">จาก {installmentCount} งวด</span>
                    </div>
                  </div>
                  {prePaidCount > 0 && Number(totalAmount) > 0 && (
                    <div className="flex gap-4 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                      <span>ชำระไปแล้ว: <strong>{formatCurrency(installmentAmount * prePaidCount)}</strong></span>
                      <span>คงเหลือ: <strong>{formatCurrency(Number(totalAmount) - installmentAmount * prePaidCount)}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="label">หมายเหตุ</label>
          <textarea className="input resize-none" rows={2} placeholder="หมายเหตุ (ไม่บังคับ)"
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
        <button onClick={handleSubmit} disabled={!canProceed || submitting}
          className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
          <CheckCircle size={16} /> {submitting ? 'กำลังบันทึก...' : 'สร้างสัญญา'}
        </button>
      </div>
    </div>
  )
}
