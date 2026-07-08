import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp, Shield, BarChart2, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

const features = [
  { icon: TrendingUp, text: 'ติดตามสัญญาและยอดดอกเบี้ยแบบ Real-time' },
  { icon: BarChart2,  text: 'รายงาน Cash Flow และกำไรรายเดือน' },
  { icon: Shield,     text: 'จัดการหนี้เสียและกู้คืนหนี้ได้ครบถ้วน' },
]

export default function Login() {
  const navigate = useNavigate()
  const { login, user, isLoading } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { if (user) navigate('/') }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message ?? 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">

      {/* ═══════════════════════════════════════
          LEFT PANEL — 50%
      ═══════════════════════════════════════ */}
      <div
        className="hidden lg:flex w-1/2 h-full flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(155deg,#07101F 0%,#0D2B6E 50%,#091428 100%)' }}
      >
        {/* Blob decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
               style={{ background: 'radial-gradient(circle,#1565C0,transparent 70%)' }} />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-15"
               style={{ background: 'radial-gradient(circle,#2E7D32,transparent 70%)' }} />
          <div className="absolute top-1/2 right-10 w-64 h-64 rounded-full opacity-10"
               style={{ background: 'radial-gradient(circle,#E64A19,transparent 70%)' }} />
          {/* Rings */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 600 700" fill="none">
            <ellipse cx="300" cy="350" rx="260" ry="310" stroke="white" strokeWidth="1"/>
            <ellipse cx="300" cy="350" rx="180" ry="220" stroke="white" strokeWidth="0.5"/>
            <ellipse cx="300" cy="350" rx="100" ry="130" stroke="white" strokeWidth="0.5"/>
          </svg>
        </div>

        {/* Top: brand */}
        <div className="relative flex items-center gap-3 px-10 pt-10">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center"
               style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)' }}>
            <img src="/kfl-logo.png" alt="KFL" className="w-10 h-10 object-contain"
              onError={(e) => { e.currentTarget.style.display='none' }} />
          </div>
          <div>
            <p className="font-black text-white tracking-[0.2em] text-lg leading-none">KFL</p>
            <p className="text-xs tracking-[0.15em] uppercase leading-none mt-1"
               style={{ color:'rgba(255,255,255,0.35)' }}>Krit Frind Loan</p>
          </div>
        </div>

        {/* Center: logo + features */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-12 gap-10">
          {/* Logo showcase */}
          <div
            className="w-56 h-56 rounded-[2rem] flex items-center justify-center"
            style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(16px)' }}
          >
            <img src="/kfl-logo.png" alt="KFL" className="w-44 h-44 object-contain drop-shadow-2xl"
              onError={(e) => {
                e.currentTarget.style.display='none'
                const fb = e.currentTarget.nextElementSibling as HTMLElement|null
                if (fb) fb.style.display='block'
              }}
            />
            <span className="hidden text-6xl font-black"
              style={{ background:'linear-gradient(135deg,#42A5F5 0%,#66BB6A 50%,#FF7043 100%)',
                       WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              KFL
            </span>
          </div>

          {/* Feature rows */}
          <div className="w-full space-y-3">
            {features.map((f) => (
              <div key={f.text}
                className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl"
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background:'rgba(255,255,255,0.1)' }}>
                  <f.icon size={15} style={{ color:'#90CAF9' }} />
                </div>
                <span className="text-sm leading-snug" style={{ color:'rgba(255,255,255,0.65)' }}>
                  {f.text}
                </span>
                <CheckCircle size={14} className="ml-auto flex-shrink-0" style={{ color:'#66BB6A' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative px-10 pb-8 text-xs" style={{ color:'rgba(255,255,255,0.2)' }}>
          © 2569 KFL · Krit Frind Loan · ระบบจัดการสินเชื่อรายย่อย
        </p>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT PANEL — 50%
      ═══════════════════════════════════════ */}
      <div
        className="w-full lg:w-1/2 h-full flex flex-col relative overflow-hidden"
        style={{ background:'#F0F4F8' }}
      >
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage:'radial-gradient(circle,#C7D4E3 1px,transparent 1px)',
                      backgroundSize:'28px 28px', opacity:0.5 }} />

        {/* Top accent bar */}
        <div className="relative h-1.5 w-full"
             style={{ background:'linear-gradient(90deg,#1565C0 0%,#2E7D32 50%,#E64A19 100%)' }} />

        {/* Main: centered form */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-8 py-10">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow">
              <img src="/kfl-logo.png" alt="KFL" className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display='none' }} />
            </div>
            <div>
              <p className="font-black text-gray-900 tracking-widest">KFL</p>
              <p className="text-xs text-gray-400">Krit Frind Loan</p>
            </div>
          </div>

          {/* Form card */}
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-blue-100/60 overflow-hidden">

            {/* Card header bar */}
            <div className="px-8 pt-8 pb-6 border-b border-gray-50">
              <div className="flex items-center gap-3 mb-1">
                {/* Inline small logo */}
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
                     style={{ background:'linear-gradient(135deg,#0D47A1,#1976D2)' }}>
                  <img src="/kfl-logo.png" alt="KFL" className="w-full h-full object-contain p-1"
                    onError={(e) => { e.currentTarget.style.display='none' }} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">เข้าสู่ระบบ</h1>
              </div>
              <p className="text-sm text-gray-400 pl-12">ยินดีต้อนรับสู่ระบบ KFL</p>
            </div>

            <form className="px-8 py-7 space-y-5" onSubmit={handleSubmit}>

              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">ชื่อผู้ใช้</label>
                <input
                  className="input h-12 rounded-xl px-4"
                  placeholder="กรอกชื่อผู้ใช้"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input h-12 rounded-xl px-4 pr-12"
                    placeholder="กรอกรหัสผ่าน"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPw ? <EyeOff size={17}/> : <Eye size={17}/>}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"/>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-13 py-3.5 rounded-xl text-white text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background:'linear-gradient(135deg,#0D47A1 0%,#1565C0 60%,#1976D2 100%)', boxShadow:'0 5px 18px rgba(21,101,192,0.4)' }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow='0 8px 24px rgba(21,101,192,0.55)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow='0 5px 18px rgba(21,101,192,0.4)' }}
              >
                {isLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>กำลังเข้าสู่ระบบ...</>
                ) : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>

          {/* Tagline under card */}
          <p className="mt-6 text-xs text-center text-gray-400">
            ระบบบริหารสินเชื่อรายย่อย · ปลอดภัย · เชื่อถือได้
          </p>
        </div>

        {/* Bottom: tri-color bar */}
        <div className="relative h-1 w-full"
             style={{ background:'linear-gradient(90deg,#1565C0 0%,#2E7D32 50%,#E64A19 100%)' }} />
      </div>
    </div>
  )
}
