import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { settingsApi } from '../api/endpoints'

export default function Settings() {
  const { addToast } = useAppStore()
  const [form, setForm] = useState({
    business_name: '',
    default_interest_rate: '',
    overdue_threshold_days: '',
    bad_debt_threshold_days: '',
    currency: 'THB',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get().then((res) => {
      const s = res.data.data ?? {}
      setForm({
        business_name: s.business_name ?? 'My Loan Business',
        default_interest_rate: s.default_interest_rate ?? '25',
        overdue_threshold_days: s.overdue_threshold_days ?? '1',
        bad_debt_threshold_days: s.bad_debt_threshold_days ?? '90',
        currency: s.currency ?? 'THB',
      })
    }).finally(() => setLoading(false))
  }, [])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    setSaving(true)
    settingsApi.update(form).then(() => {
      addToast('success', 'บันทึกการตั้งค่าสำเร็จ')
    }).catch(() => {
      addToast('error', 'เกิดข้อผิดพลาด ไม่สามารถบันทึกได้')
    }).finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่าระบบ</h1>
        <p className="text-sm text-gray-500 mt-0.5">กำหนดค่าเริ่มต้นของระบบ</p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">ข้อมูลธุรกิจ</h2>
        <div>
          <label className="label">ชื่อธุรกิจ</label>
          <input className="input" value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">ค่าเริ่มต้นการปล่อยกู้</h2>
        <div>
          <label className="label">อัตราดอกเบี้ยเริ่มต้น (%)</label>
          <input type="number" className="input" value={form.default_interest_rate} onChange={(e) => set('default_interest_rate', e.target.value)} />
        </div>
        <div>
          <label className="label">จำนวนวันก่อนถือว่าค้างชำระ</label>
          <input type="number" className="input" value={form.overdue_threshold_days} onChange={(e) => set('overdue_threshold_days', e.target.value)} />
        </div>
        <div>
          <label className="label">จำนวนวันค้างก่อนตัดหนี้สูญ</label>
          <input type="number" className="input" value={form.bad_debt_threshold_days} onChange={(e) => set('bad_debt_threshold_days', e.target.value)} />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
        <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
      </button>
    </div>
  )
}
