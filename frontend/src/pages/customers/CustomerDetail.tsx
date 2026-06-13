import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Briefcase, FilePlus, RefreshCw, AlertTriangle, Pencil } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import LoanConfirmModal, { needsLoanConfirm } from '../../components/ui/LoanConfirmModal'
import { formatCurrency, formatDate, isInstallmentBased } from '../../utils/financial'
import { customerApi } from '../../api/endpoints'
import { useAppStore } from '../../stores/appStore'
import type { Customer, Loan, CustomerForm } from '../../types'

interface PaymentStats {
  totalDue: number
  totalPaid: number
  lateCount: number
  avgDaysLate: number
  collectionRate: number | null
  creditScore: number | null
  creditLabel: string | null
  latePayments: {
    id: number
    loanNumber: string
    loanType: string
    loanId: number
    installmentNo: number
    dueDate: string
    paidDate: string
    daysLate: number
    amountDue: number
    paidAmount: number
  }[]
}

const LOAN_TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  single:      { label: 'ครั้งเดียว', cls: 'bg-gray-100 text-gray-600' },
  installment: { label: 'รายงวด',    cls: 'bg-blue-100 text-blue-700' },
  flexible:    { label: 'ยืดหยุ่น',  cls: 'bg-purple-100 text-purple-700' },
  daily:       { label: 'รายวัน',    cls: 'bg-orange-100 text-orange-700' },
}

const RISK_OPTIONS = [
  { value: 'low', label: 'ความเสี่ยงต่ำ' },
  { value: 'normal', label: 'ปกติ' },
  { value: 'high', label: 'ความเสี่ยงสูง' },
  { value: 'blacklist', label: 'Blacklist' },
]

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showLoanConfirm, setShowLoanConfirm] = useState(false)
  const [editForm, setEditForm] = useState<CustomerForm & { riskLevel: string }>({
    firstName: '', lastName: '', phone: '', idCard: '', address: '', occupation: '', lineId: '', note: '', riskLevel: 'normal',
  })
  const [editSaving, setEditSaving] = useState(false)

  const openEdit = () => {
    if (!customer) return
    setEditForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      idCard: customer.idCard ?? '',
      address: customer.address ?? '',
      occupation: customer.occupation ?? '',
      lineId: customer.lineId ?? '',
      note: customer.note ?? '',
      riskLevel: customer.riskLevel,
    })
    setShowEdit(true)
  }

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer || !editForm.firstName || !editForm.phone) return
    setEditSaving(true)
    customerApi.update(customer.id, editForm).then((res) => {
      setCustomer(res.data.data)
      setShowEdit(false)
      addToast('success', 'แก้ไขข้อมูลลูกค้าสำเร็จ')
    }).catch(() => {
      addToast('error', 'เกิดข้อผิดพลาด ไม่สามารถแก้ไขข้อมูลได้')
    }).finally(() => setEditSaving(false))
  }

  const setField = (k: keyof typeof editForm, v: string) =>
    setEditForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!id) return
    Promise.all([
      customerApi.get(Number(id)),
      customerApi.loans(Number(id)),
      customerApi.paymentStats(Number(id)),
    ]).then(([cRes, lRes, sRes]) => {
      setCustomer(cRes.data.data)
      setLoans(lRes.data.data ?? [])
      setPaymentStats(sRes.data.data)
    }).catch(() => {
      setNotFound(true)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500">ไม่พบข้อมูลลูกค้า</p>
        <button onClick={() => navigate('/customers')} className="btn-secondary mt-4">กลับ</button>
      </div>
    )
  }

  const totalBorrowed = loans.reduce((s, l) => s + l.principalAmount, 0)
  // Daily loans: count interest only after completed; other types: count paid interest as-is
  const totalInterest = loans.reduce((s, l) => {
    if (l.loanType === 'daily' && l.status !== 'completed') return s
    return s + (l.totalPaidInterest ?? l.paidInterest)
  }, 0)

  return (
    <div className="max-w-4xl space-y-5">
      <button onClick={() => navigate('/customers')} className="btn-secondary w-fit">
        <ArrowLeft size={15} /> กลับ
      </button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-700">{customer.firstName[0]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{customer.firstName} {customer.lastName}</h1>
                <StatusBadge status={customer.riskLevel} />
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{customer.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openEdit} className="btn-secondary">
              <Pencil size={15} /> แก้ไข
            </button>
            <button
              onClick={() => {
                if (needsLoanConfirm(customer)) {
                  setShowLoanConfirm(true)
                } else {
                  navigate('/loans/new', { state: { customerId: customer.id, customerName: `${customer.firstName} ${customer.lastName}` } })
                }
              }}
              className="btn-primary"
            >
              <FilePlus size={15} /> ปล่อยกู้
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            <Phone size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-700">{customer.phone}</span>
          </div>
          {customer.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{customer.address}</span>
            </div>
          )}
          {customer.occupation && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-700">{customer.occupation}</span>
            </div>
          )}
        </div>
        {customer.note && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700">หมายเหตุ: {customer.note}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'สัญญาทั้งหมด', value: String(loans.length), sub: 'ครั้ง' },
          { label: 'ยอดกู้สะสม', value: formatCurrency(totalBorrowed), sub: '' },
          { label: 'ดอกที่จ่ายแล้ว', value: formatCurrency(totalInterest), sub: '' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            {s.sub && <p className="text-xs text-gray-400">{s.sub}</p>}
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}

        {/* Credit score card */}
        {(() => {
          const score = paymentStats?.creditScore ?? null
          const label = paymentStats?.creditLabel ?? null
          const colorCls = score === null ? 'text-gray-400'
            : score >= 85 ? 'text-green-600'
            : score >= 70 ? 'text-blue-600'
            : score >= 50 ? 'text-yellow-600'
            : 'text-red-600'
          return (
            <div className="card text-center py-4">
              <p className={`text-2xl font-bold ${colorCls}`}>
                {score !== null ? score : '-'}
              </p>
              {label && <p className={`text-xs font-semibold mt-0.5 ${colorCls}`}>{label}</p>}
              {(paymentStats?.lateCount ?? 0) > 0 && (
                <p className="text-xs text-amber-500 mt-0.5">ช้า {paymentStats!.lateCount} งวด</p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">เครดิต (0–100)</p>
            </div>
          )
        })()}
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">ประวัติสัญญา ({loans.length})</h2>
        {loans.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีสัญญา</p>
        ) : (
          <div className="space-y-2">
            {loans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/loans/${loan.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono text-gray-500">{loan.loanNumber}</span>
                    <StatusBadge status={loan.status} />
                    {(loan.isRolledOver || loan.parentLoanId) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        <RefreshCw size={10} /> ต่อดอก
                      </span>
                    )}
                    {LOAN_TYPE_LABEL[loan.loanType] && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LOAN_TYPE_LABEL[loan.loanType].cls}`}>
                        {LOAN_TYPE_LABEL[loan.loanType].label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    เงินต้น {formatCurrency(loan.principalAmount)} → รวม {formatCurrency(loan.totalAmount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(loan.issuedDate)} → {formatDate(loan.dueDate)}
                    {isInstallmentBased(loan.loanType) && ` · ${loan.paidInstallments}/${loan.totalInstallments} งวด`}
                    {loan.loanType !== 'daily' && (loan.rolloverCount ?? 0) > 0 && (
                      <span className="ml-1.5 text-indigo-500 font-medium">· ต่อดอก {loan.rolloverCount} ครั้ง</span>
                    )}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">
                    {loan.loanType === 'daily' && loan.status !== 'completed' ? 'ดอกสัญญา' : 'ดอกสัญญา / จ่ายแล้ว'}
                  </p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(loan.interestAmount)}</p>
                  {(loan.loanType !== 'daily' || loan.status === 'completed') && (loan.totalPaidInterest ?? 0) > 0 && (
                    <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                      จ่าย {formatCurrency(loan.totalPaidInterest ?? 0)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LoanConfirmModal
        customer={showLoanConfirm ? customer : null}
        onClose={() => setShowLoanConfirm(false)}
        onConfirmed={() => {
          setShowLoanConfirm(false)
          navigate('/loans/new', { state: { customerId: customer.id, customerName: `${customer.firstName} ${customer.lastName}` } })
        }}
      />

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="แก้ไขข้อมูลลูกค้า" size="lg">
        <form onSubmit={handleEditSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ชื่อ *</label>
              <input className="input" value={editForm.firstName} onChange={(e) => setField('firstName', e.target.value)} required />
            </div>
            <div>
              <label className="label">นามสกุล</label>
              <input className="input" value={editForm.lastName} onChange={(e) => setField('lastName', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">เบอร์โทรศัพท์ *</label>
              <input className="input" value={editForm.phone} onChange={(e) => setField('phone', e.target.value)} required />
            </div>
            <div>
              <label className="label">เลขบัตรประชาชน</label>
              <input className="input" value={editForm.idCard} onChange={(e) => setField('idCard', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">ที่อยู่</label>
            <textarea className="input resize-none" rows={2} value={editForm.address} onChange={(e) => setField('address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">อาชีพ</label>
              <input className="input" value={editForm.occupation} onChange={(e) => setField('occupation', e.target.value)} />
            </div>
            <div>
              <label className="label">LINE ID</label>
              <input className="input" value={editForm.lineId} onChange={(e) => setField('lineId', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">ระดับความเสี่ยง</label>
            <select className="input" value={editForm.riskLevel} onChange={(e) => setField('riskLevel', e.target.value)}>
              {RISK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <textarea className="input resize-none" rows={2} value={editForm.note} onChange={(e) => setField('note', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={editSaving}>
              {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </Modal>

      {paymentStats && paymentStats.lateCount > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">ประวัติการค้างชำระ</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            จ่ายช้า {paymentStats.lateCount} งวด · เฉลี่ย {paymentStats.avgDaysLate} วัน/งวด
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400">
                  <th className="text-left pb-2 font-medium">สัญญา</th>
                  <th className="text-left pb-2 font-medium">งวดที่</th>
                  <th className="text-left pb-2 font-medium">ครบกำหนด</th>
                  <th className="text-left pb-2 font-medium">จ่ายจริง</th>
                  <th className="text-right pb-2 font-medium">ล่าช้า (วัน)</th>
                  <th className="text-right pb-2 font-medium">ยอดชำระ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paymentStats.latePayments.map((lp) => (
                  <tr
                    key={lp.id}
                    className="hover:bg-amber-50/40 cursor-pointer"
                    onClick={() => navigate(`/loans/${lp.loanId}`)}
                  >
                    <td className="py-2 font-mono text-gray-500">{lp.loanNumber}</td>
                    <td className="py-2 text-gray-700">{lp.installmentNo}</td>
                    <td className="py-2 text-gray-600">{formatDate(lp.dueDate)}</td>
                    <td className="py-2 text-gray-600">{formatDate(lp.paidDate)}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${lp.daysLate > 7 ? 'text-red-600' : 'text-amber-600'}`}>
                        {lp.daysLate}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-700">{formatCurrency(lp.paidAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
