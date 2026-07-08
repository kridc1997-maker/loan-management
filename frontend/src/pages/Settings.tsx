import { useState, useEffect } from 'react'
import { Save, Ban } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { settingsApi } from '../api/endpoints'

export default function Settings() {
  const { addToast } = useAppStore()
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get().then((res) => {
      const s = res.data.data ?? {}
      setPaused(s.loan_creation_paused === 'true')
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = () => {
    setSaving(true)
    settingsApi.update({ loan_creation_paused: paused ? 'true' : 'false' }).then(() => {
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50">
              <Ban size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">หยุดสร้างสัญญาใหม่ชั่วคราว</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                เมื่อเปิดใช้งาน ปุ่มสร้างสัญญา/ปล่อยกู้ใหม่ในทุกหน้าจะถูกซ่อน
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${paused ? 'bg-red-500' : 'bg-gray-300'}`}
              onClick={() => setPaused((v) => !v)}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${paused ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
        <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
      </button>
    </div>
  )
}
