import { useState, useEffect } from 'react'
import { UserPlus, Edit2, KeyRound, Trash2, Shield, User, CheckCircle, XCircle, Clock } from 'lucide-react'
import { userApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'

interface UserItem {
  id: number
  username: string
  fullName: string
  role: 'admin' | 'staff'
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const EMPTY_CREATE = { username: '', password: '', fullName: '', role: 'staff' as 'admin' | 'staff' }

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Users() {
  const { user: me } = useAuthStore()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserItem | null>(null)
  const [pwTarget, setPwTarget]     = useState<UserItem | null>(null)
  const [delTarget, setDelTarget]   = useState<UserItem | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [editForm, setEditForm]     = useState<{ fullName: string; role: 'admin' | 'staff'; isActive: boolean }>({ fullName: '', role: 'staff', isActive: true })
  const [newPw, setNewPw]           = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const res = await userApi.list()
      setUsers(res.data.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const closeAll = () => {
    setCreateOpen(false); setEditTarget(null); setPwTarget(null); setDelTarget(null)
    setCreateForm(EMPTY_CREATE); setEditForm({ fullName: '', role: 'staff', isActive: true })
    setNewPw(''); setShowPw(false); setErr(''); setSaving(false)
  }

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password || !createForm.fullName) { setErr('กรุณากรอกข้อมูลให้ครบ'); return }
    try {
      setSaving(true); setErr('')
      await userApi.create(createForm)
      closeAll(); load()
    } catch (e: any) { setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!editTarget) return
    try {
      setSaving(true); setErr('')
      await userApi.update(editTarget.id, editForm)
      closeAll(); load()
    } catch (e: any) { setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  const handlePw = async () => {
    if (!pwTarget || !newPw) { setErr('กรุณากรอกรหัสผ่านใหม่'); return }
    if (newPw.length < 6) { setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    try {
      setSaving(true); setErr('')
      await userApi.resetPassword(pwTarget.id, newPw)
      closeAll(); load()
    } catch (e: any) { setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!delTarget) return
    try {
      setSaving(true); setErr('')
      await userApi.remove(delTarget.id)
      closeAll(); load()
    } catch (e: any) { setErr(e.response?.data?.message ?? 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  const openEdit = (u: UserItem) => {
    setEditTarget(u)
    setEditForm({ fullName: u.fullName, role: u.role, isActive: u.isActive })
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-gray-400 mt-0.5">เพิ่ม แก้ไข และจัดการสิทธิ์ผู้ใช้ระบบ</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <UserPlus size={16} /> เพิ่มผู้ใช้งาน
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead style={{ background: '#F8FAFC' }}>
            <tr>
              <th className="table-header">ชื่อ-นามสกุล / Username</th>
              <th className="table-header">Role</th>
              <th className="table-header text-center">สถานะ</th>
              <th className="table-header">เข้าสู่ระบบล่าสุด</th>
              <th className="table-header text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                         style={{ background: u.role === 'admin' ? 'linear-gradient(135deg,#1565C0,#1976D2)' : 'linear-gradient(135deg,#2E7D32,#388E3C)' }}>
                      {u.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{u.fullName}</p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                    {me?.id === u.id && (
                      <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background:'#EFF6FF', color:'#1565C0' }}>คุณ</span>
                    )}
                  </div>
                </td>
                <td className="table-cell">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                    {u.role === 'admin' ? <Shield size={11}/> : <User size={11}/>}
                    {u.role === 'admin' ? 'Admin' : 'พนักงาน'}
                  </span>
                </td>
                <td className="table-cell text-center">
                  {u.isActive
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle size={13}/>ใช้งาน</span>
                    : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"><XCircle size={13}/>ปิดใช้งาน</span>
                  }
                </td>
                <td className="table-cell">
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock size={12}/>{formatDate(u.lastLoginAt)}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEdit(u)} title="แก้ไขข้อมูล"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit2 size={15}/>
                    </button>
                    <button onClick={() => setPwTarget(u)} title="เปลี่ยนรหัสผ่าน"
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
                      <KeyRound size={15}/>
                    </button>
                    {me?.id !== u.id && (
                      <button onClick={() => setDelTarget(u)} title="ลบผู้ใช้งาน"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Modal: Create ─────────────────────────────────────── */}
      {createOpen && (
        <ModalWrapper title="เพิ่มผู้ใช้งานใหม่" onClose={closeAll}>
          <div className="space-y-4">
            <Field label="ชื่อ-นามสกุล *">
              <input className="input" placeholder="เช่น สมชาย ใจดี"
                value={createForm.fullName} onChange={(e) => setCreateForm(f => ({ ...f, fullName: e.target.value }))} />
            </Field>
            <Field label="Username *">
              <input className="input" placeholder="เช่น somchai"
                value={createForm.username} onChange={(e) => setCreateForm(f => ({ ...f, username: e.target.value }))} />
            </Field>
            <Field label="Password *">
              <PasswordInput value={createForm.password} onChange={(v) => setCreateForm(f => ({ ...f, password: v }))} />
            </Field>
            <Field label="Role">
              <RoleSelect value={createForm.role} onChange={(v) => setCreateForm(f => ({ ...f, role: v }))} />
            </Field>
            {err && <ErrBox msg={err}/>}
            <ModalFooter onCancel={closeAll} onConfirm={handleCreate} saving={saving} confirmLabel="สร้างผู้ใช้งาน" />
          </div>
        </ModalWrapper>
      )}

      {/* ─── Modal: Edit ───────────────────────────────────────── */}
      {editTarget && (
        <ModalWrapper title={`แก้ไข: ${editTarget.username}`} onClose={closeAll}>
          <div className="space-y-4">
            <Field label="ชื่อ-นามสกุล">
              <input className="input" value={editForm.fullName}
                onChange={(e) => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
            </Field>
            <Field label="Role">
              <RoleSelect value={editForm.role} onChange={(v) => setEditForm(f => ({ ...f, role: v }))} />
            </Field>
            <Field label="สถานะการใช้งาน">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                     onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.isActive ? 'translate-x-5' : 'translate-x-0'}`}/>
                </div>
                <span className="text-sm text-gray-700">{editForm.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
              </label>
            </Field>
            {editTarget.id === me?.id && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">ไม่สามารถปิดใช้งานบัญชีของตัวเองได้</p>
            )}
            {err && <ErrBox msg={err}/>}
            <ModalFooter onCancel={closeAll} onConfirm={handleEdit} saving={saving} confirmLabel="บันทึก" />
          </div>
        </ModalWrapper>
      )}

      {/* ─── Modal: Reset Password ─────────────────────────────── */}
      {pwTarget && (
        <ModalWrapper title={`เปลี่ยนรหัสผ่าน: ${pwTarget.username}`} onClose={closeAll}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">กรอกรหัสผ่านใหม่ให้กับผู้ใช้งาน <strong>{pwTarget.fullName}</strong></p>
            <Field label="รหัสผ่านใหม่ *">
              <PasswordInput value={newPw} onChange={setNewPw} show={showPw} onToggle={() => setShowPw(v => !v)} />
            </Field>
            {err && <ErrBox msg={err}/>}
            <ModalFooter onCancel={closeAll} onConfirm={handlePw} saving={saving} confirmLabel="เปลี่ยนรหัสผ่าน"
              confirmStyle={{ background:'linear-gradient(135deg,#F57C00,#FF9800)', boxShadow:'0 4px 14px rgba(245,124,0,0.35)' }} />
          </div>
        </ModalWrapper>
      )}

      {/* ─── Modal: Delete ─────────────────────────────────────── */}
      {delTarget && (
        <ModalWrapper title="ยืนยันการลบผู้ใช้งาน" onClose={closeAll}>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-2xl flex gap-3 items-start">
              <Trash2 size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-semibold text-red-700">ลบผู้ใช้งาน</p>
                <p className="text-sm text-red-600 mt-0.5">
                  คุณต้องการลบ <strong>{delTarget.fullName}</strong> (@{delTarget.username}) ออกจากระบบใช่หรือไม่?<br/>
                  <span className="text-xs opacity-75">การกระทำนี้ไม่สามารถยกเลิกได้</span>
                </p>
              </div>
            </div>
            {err && <ErrBox msg={err}/>}
            <ModalFooter onCancel={closeAll} onConfirm={handleDelete} saving={saving} confirmLabel="ลบผู้ใช้งาน"
              confirmStyle={{ background:'linear-gradient(135deg,#C62828,#E53935)', boxShadow:'0 4px 14px rgba(198,40,40,0.35)' }} />
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}

// ─── Shared small components ─────────────────────────────────────────────────

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors text-lg leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function PasswordInput({ value, onChange, show, onToggle }: { value: string; onChange: (v: string) => void; show?: boolean; onToggle?: () => void }) {
  const [local, setLocal] = useState(show ?? false)
  const toggle = onToggle ?? (() => setLocal(v => !v))
  const visible = onToggle ? show : local
  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} className="input pr-10" placeholder="อย่างน้อย 6 ตัวอักษร"
        value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={toggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  )
}

function RoleSelect({ value, onChange }: { value: 'admin' | 'staff'; onChange: (v: 'admin' | 'staff') => void }) {
  return (
    <div className="flex gap-3">
      {(['staff', 'admin'] as const).map((r) => (
        <label key={r} className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${value === r ? (r === 'admin' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50') : 'border-gray-200 hover:border-gray-300'}`}>
          <input type="radio" className="sr-only" checked={value === r} onChange={() => onChange(r)} />
          {r === 'admin' ? <Shield size={15} className={value === r ? 'text-blue-600' : 'text-gray-400'}/> : <User size={15} className={value === r ? 'text-green-600' : 'text-gray-400'}/>}
          <div>
            <p className={`text-sm font-semibold ${value === r ? (r === 'admin' ? 'text-blue-700' : 'text-green-700') : 'text-gray-600'}`}>
              {r === 'admin' ? 'Admin' : 'พนักงาน'}
            </p>
            <p className="text-xs text-gray-400">{r === 'admin' ? 'สิทธิ์เต็ม' : 'ทั่วไป'}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"/>
      {msg}
    </div>
  )
}

function ModalFooter({ onCancel, onConfirm, saving, confirmLabel, confirmStyle }: {
  onCancel: () => void; onConfirm: () => void; saving: boolean; confirmLabel: string
  confirmStyle?: React.CSSProperties
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="btn-secondary flex-1" disabled={saving}>ยกเลิก</button>
      <button onClick={onConfirm} disabled={saving}
        className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        style={confirmStyle ?? { background:'linear-gradient(135deg,#0D47A1,#1565C0)', boxShadow:'0 4px 14px rgba(21,101,192,0.35)' }}>
        {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>กำลังบันทึก...</> : confirmLabel}
      </button>
    </div>
  )
}
