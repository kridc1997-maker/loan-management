import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, CreditCard,
  AlertTriangle, Skull, TrendingUp, BarChart2, Settings, ChevronRight, UserCog, Activity,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'

const navItems = [
  { to: '/', label: 'หน้าแรก', icon: LayoutDashboard, end: true },
  { divider: 'ผู้บริหาร' },
  { to: '/executive', label: 'Executive Dashboard', icon: Activity },
  { divider: 'ลูกค้า' },
  { to: '/customers', label: 'รายชื่อลูกค้า', icon: Users },
  { divider: 'สินเชื่อ' },
  { to: '/loans', label: 'สัญญาที่ Active', icon: FileText },
  { to: '/loans/installments', label: 'ตารางผ่อนชำระ', icon: CreditCard },
  { divider: 'การเงิน' },
  { to: '/payments', label: 'รับชำระเงิน', icon: CreditCard },
  { to: '/overdue', label: 'ค้างชำระ', icon: AlertTriangle },
  { to: '/bad-debt', label: 'หนี้เสีย', icon: Skull },
  { to: '/cash-flow', label: 'จัดการกระเป๋าตัง', icon: TrendingUp },
  { to: '/reports', label: 'รายงาน', icon: BarChart2 },
  { divider: 'ระบบ' },
  { to: '/users', label: 'จัดการผู้ใช้', icon: UserCog },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings },
] as const

type NavItem =
  | { divider: string }
  | { to: string; label: string; icon: React.ElementType; end?: boolean }

const STAFF_ALLOWED_PATHS = ['/', '/customers', '/loans', '/loans/installments', '/payments', '/overdue', '/bad-debt']

function getVisibleNavItems(role: string | undefined): NavItem[] {
  const items = navItems as unknown as NavItem[]
  if (role === 'admin') return items

  const visible: NavItem[] = []
  let pendingDivider: NavItem | null = null
  for (const item of items) {
    if ('divider' in item) {
      pendingDivider = item
      continue
    }
    if (STAFF_ALLOWED_PATHS.includes(item.to)) {
      if (pendingDivider) {
        visible.push(pendingDivider)
        pendingDivider = null
      }
      visible.push(item)
    }
  }
  return visible
}

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = (e: MediaQueryListEvent) => { setIsMobile(e.matches); setSidebarOpen(!e.matches) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setSidebarOpen])
  // on a phone the drawer always shows full labels; only its open/closed state changes
  const expanded = isMobile ? true : sidebarOpen
  const closeOnMobile = () => { if (isMobile) setSidebarOpen(false) }
  const { user } = useAuthStore()
  const visibleNavItems = getVisibleNavItems(user?.role)

  return (
    <>
    {isMobile && sidebarOpen && (
      <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)} />
    )}
    <aside
      className={`flex flex-col transition-all duration-300 ${
        isMobile ? `fixed inset-y-0 left-0 z-40 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}` : 'flex-shrink-0'
      }`}
      style={{
        width: expanded ? 240 : 64,
        background: 'linear-gradient(180deg, #0A1628 0%, #0D1F45 60%, #0C1A3A 100%)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 border-b px-3 py-4"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* KFL text logo */}
        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-white/10">
          <span
            className="text-xs font-black leading-none"
            style={{
              background: 'linear-gradient(135deg, #42A5F5, #66BB6A, #FF7043)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            KFL
          </span>
        </div>

        {expanded && (
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-bold text-white truncate tracking-wide">Krit Friend Loan</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
              ระบบจัดการสินเชื่อ
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleNavItems.map((item, idx) => {
          if ('divider' in item) {
            return expanded ? (
              <p
                key={idx}
                className="px-3 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {item.divider}
              </p>
            ) : (
              <div key={idx} className="my-2 mx-3 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            )
          }

          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeOnMobile}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all group ${
                  isActive ? 'kfl-nav-active' : 'kfl-nav-idle'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className="flex-shrink-0 transition-colors"
                    style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.45)' }}
                  />
                  {expanded && (
                    <>
                      <span
                        className="flex-1 truncate"
                        style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.65)' }}
                      >
                        {item.label}
                      </span>
                      {isActive && (
                        <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                      )}
                    </>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      {expanded && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            KFL v1.1 © 2569
          </p>
        </div>
      )}
    </aside>
    </>
  )
}
