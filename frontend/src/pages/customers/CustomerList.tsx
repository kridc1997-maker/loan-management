import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Phone, ChevronRight, FilePlus, Pencil } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency } from '../../utils/financial'
import { customerApi } from '../../api/endpoints'
import type { Customer, CustomerForm } from '../../types'
import { useAppStore } from '../../stores/appStore'

function CustomerForm({ onClose, onSubmit, initialData }: {
  onClose: () => void
  onSubmit: (data: CustomerForm) => void
  initialData?: Customer | null
}) {
  const [form, setForm] = useState<CustomerForm>({
    firstName: initialData?.firstName ?? '',
    lastName: initialData?.lastName ?? '',
    phone: initialData?.phone ?? '',
    idCard: initialData?.idCard ?? '',
    address: initialData?.address ?? '',
    occupation: initialData?.occupation ?? '',
    lineId: initialData?.lineId ?? '',
    note: initialData?.note ?? '',
    riskLevel: initialData?.riskLevel ?? 'normal',
  })

  const set = (k: keyof CustomerForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName || !form.phone) return
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">ชื่อ *</label>
          <input className="input" placeholder="ชื่อ" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
        </div>
        <div>
          <label className="label">นามสกุล *</label>
          <input className="input" placeholder="นามสกุล" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">เบอร์โทรศัพท์ *</label>
        <input className="input" placeholder="08x-xxx-xxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
      </div>
      <div>
        <label className="label">เลขบัตรประชาชน</label>
        <input className="input" placeholder="13 หลัก" value={form.idCard} onChange={(e) => set('idCard', e.target.value)} />
      </div>
      <div>
        <label className="label">ที่อยู่</label>
        <textarea className="input resize-none" rows={2} placeholder="ที่อยู่" value={form.address} onChange={(e) => set('address', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">อาชีพ</label>
          <input className="input" placeholder="อาชีพ" value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
        </div>
        <div>
          <label className="label">LINE ID</label>
          <input className="input" placeholder="@line_id" value={form.lineId} onChange={(e) => set('lineId', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">ระดับความเสี่ยง</label>
        <select className="input" value={form.riskLevel ?? 'normal'} onChange={(e) => set('riskLevel', e.target.value)}>
          <option value="low">ความเสี่ยงต่ำ</option>
          <option value="normal">ปกติ</option>
          <option value="high">ความเสี่ยงสูง</option>
          <option value="blacklist">Blacklist</option>
        </select>
      </div>
      <div>
        <label className="label">หมายเหตุ</label>
        <textarea className="input resize-none" rows={2} placeholder="หมายเหตุ" value={form.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">ยกเลิก</button>
        <button type="submit" className="btn-primary flex-1 justify-center">บันทึก</button>
      </div>
    </form>
  )
}

export default function CustomerList() {
  const navigate = useNavigate()
  const { addToast } = useAppStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const loadCustomers = () => {
    setLoading(true)
    customerApi.list({ limit: 500 }).then((res) => {
      setCustomers(res.data.data ?? [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadCustomers() }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q)
    const matchStatus =
      statusFilter === 'all' ? true
      : statusFilter === 'active' ? c.activeLoansCount > 0
      : statusFilter === 'clear' ? c.activeLoansCount === 0
      : c.riskLevel === statusFilter
    return matchSearch && matchStatus
  })

  const handleAdd = (form: CustomerForm) => {
    customerApi.create(form).then((res) => {
      const created = res.data.data
      setCustomers((prev) => [created, ...prev])
      setShowAdd(false)
      addToast('success', `เพิ่มลูกค้า ${form.firstName} ${form.lastName} สำเร็จ`)
    }).catch(() => {
      addToast('error', 'เกิดข้อผิดพลาด ไม่สามารถเพิ่มลูกค้าได้')
    })
  }

  const handleEditSave = (form: CustomerForm) => {
    if (!editCustomer) return
    customerApi.update(editCustomer.id, form).then((res) => {
      const updated = res.data.data
      setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c))
      setEditCustomer(null)
      addToast('success', `แก้ไขข้อมูล ${form.firstName} ${form.lastName} สำเร็จ`)
    }).catch(() => {
      addToast('error', 'เกิดข้อผิดพลาด ไม่สามารถแก้ไขข้อมูลได้')
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายชื่อลูกค้า</h1>
          <p className="text-sm text-gray-500 mt-0.5">ทั้งหมด {customers.length} ราย</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> เพิ่มลูกค้าใหม่
        </button>
      </div>

      <div className="card flex items-center gap-3 py-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="ค้นหาชื่อหรือเบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">ทั้งหมด</option>
          <option value="active">มีสัญญา Active</option>
          <option value="clear">ปลอดหนี้</option>
          <option value="high">ความเสี่ยงสูง</option>
          <option value="blacklist">Blacklist</option>
        </select>
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} รายการ</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">ลูกค้า</th>
                <th className="table-header">เบอร์โทร</th>
                <th className="table-header">อาชีพ</th>
                <th className="table-header text-right">ยอดค้าง</th>
                <th className="table-header text-center">เครดิต</th>
                <th className="table-header text-center">ความเสี่ยง</th>
                <th className="table-header text-center">สัญญา Active</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="ไม่พบลูกค้า" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" /></td></tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-700">{c.firstName[0]}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-400">{c.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {c.phone}
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{c.occupation ?? '-'}</td>
                    <td className="table-cell text-right">
                      <span className={c.totalOutstanding > 0 ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                        {formatCurrency(c.totalOutstanding)}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      {c.creditScore !== null ? (
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-sm font-bold leading-tight ${
                            c.creditScore >= 85 ? 'text-green-600'
                            : c.creditScore >= 70 ? 'text-blue-600'
                            : c.creditScore >= 50 ? 'text-yellow-600'
                            : 'text-red-600'
                          }`}>{c.creditScore}</span>
                          <span className={`text-xs leading-tight ${
                            c.creditScore >= 85 ? 'text-green-500'
                            : c.creditScore >= 70 ? 'text-blue-500'
                            : c.creditScore >= 50 ? 'text-yellow-500'
                            : 'text-red-500'
                          }`}>{c.creditLabel}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <StatusBadge status={c.riskLevel} />
                    </td>
                    <td className="table-cell text-center">
                      {c.activeLoansCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {c.activeLoansCount} สัญญา
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditCustomer(c)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors"
                          title="แก้ไขข้อมูล"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/loans/new`, { state: { customerId: c.id, customerName: `${c.firstName} ${c.lastName}` } })}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                          title="ปล่อยกู้"
                        >
                          <FilePlus size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="เพิ่มลูกค้าใหม่" size="lg">
        <CustomerForm onClose={() => setShowAdd(false)} onSubmit={handleAdd} />
      </Modal>

      <Modal open={!!editCustomer} onClose={() => setEditCustomer(null)} title="แก้ไขข้อมูลลูกค้า" size="lg">
        <CustomerForm onClose={() => setEditCustomer(null)} onSubmit={handleEditSave} initialData={editCustomer} />
      </Modal>
    </div>
  )
}
