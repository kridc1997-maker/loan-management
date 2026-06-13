import { useState } from 'react'
import { AlertTriangle, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import Modal from './Modal'
import { authApi } from '../../api/endpoints'
import { useAuthStore } from '../../stores/authStore'
import type { Customer } from '../../types'

interface Props {
  customer: Customer | null
  onClose: () => void
  onConfirmed: () => void
}

export function needsLoanConfirm(c: Customer): boolean {
  return (
    c.riskLevel === 'high' ||
    c.riskLevel === 'blacklist' ||
    (c.creditScore !== null && c.creditScore < 50)
  )
}

export default function LoanConfirmModal({ customer, onClose, onConfirmed }: Props) {
  const { user } = useAuthStore()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !user) return
    setLoading(true)
    setError('')
    try {
      await authApi.login(user.username, password)
      setPassword('')
      onConfirmed()
    } catch {
      setError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (!customer) return null

  const riskLabel =
    customer.riskLevel === 'blacklist' ? 'Blacklist' :
    customer.riskLevel === 'high' ? 'ความเสี่ยงสูง' : null

  const creditBad = customer.creditScore !== null && customer.creditScore < 50

  const reasons: string[] = []
  if (riskLabel) reasons.push(`ระดับความเสี่ยง: ${riskLabel}`)
  if (creditBad) reasons.push(`เครดิต: ${customer.creditScore} คะแนน (${customer.creditLabel})`)

  return (
    <Modal open={!!customer} onClose={handleClose} title="ยืนยันการปล่อยกู้" size="sm">
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
          <ShieldAlert size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {customer.firstName} {customer.lastName}
            </p>
            {reasons.map((r) => (
              <p key={r} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={11} /> {r}
              </p>
            ))}
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 pt-2 border-t border-amber-200 dark:border-amber-700">
              ลูกค้ากลุ่มนี้มีความเสี่ยงสูง กรุณายืนยันตัวตนด้วยรหัสผ่านของคุณก่อนดำเนินการ
            </p>
          </div>
        </div>

        <div>
          <label className="label">รหัสผ่านของคุณ ({user?.username})</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              className="input pr-10"
              placeholder="กรอกรหัสผ่าน"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={handleClose} className="btn-secondary flex-1 justify-center">
            ยกเลิก
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 justify-center"
            disabled={loading || !password}
          >
            {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
