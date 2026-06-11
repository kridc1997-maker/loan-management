import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FilePlus, FileText, CreditCard,
  AlertTriangle, Skull, TrendingUp, BarChart2, Settings, ChevronRight, UserCog,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { divider: 'ลูกค้า' },
  { to: '/customers', label: 'รายชื่อลูกค้า', icon: Users },
  { divider: 'สินเชื่อ' },
  { to: '/loans/new', label: 'สร้างสัญญาใหม่', icon: FilePlus },
  { to: '/loans', label: 'สัญญาที่ Active', icon: FileText },
  { to: '/loans/installments', label: 'ตารางผ่อนชำระ', icon: CreditCard },
  { divider: 'การเงิน' },
  { to: '/payments', label: 'รับชำระเงิน', icon: CreditCard },
  { to: '/overdue', label: 'ค้างชำระ', icon: AlertTriangle },
  { to: '/bad-debt', label: 'หนี้เสีย', icon: Skull },
  { to: '/cash-flow', label: 'Cash Flow', icon: TrendingUp },
  { to: '/reports', label: 'รายงาน', icon: BarChart2 },
  { divider: 'ระบบ' },
  { to: '/users', label: 'จัดการผู้ใช้', icon: UserCog },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings },
] as const

type NavItem =
  | { divider: string }
  | { to: string; label: string; icon: React.ElementType; end?: boolean }

export default function Sidebar() {
  const { sidebarOpen } = useAppStore()

  return (
    <aside
      className="flex-shrink-0 flex flex-col transition-all duration-300"
      style={{
        width: sidebarOpen ? 240 : 64,
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

        {sidebarOpen && (
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
        {(navItems as unknown as NavItem[]).map((item, idx) => {
          if ('divider' in item) {
            return sidebarOpen ? (
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
                  {sidebarOpen && (
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
      {sidebarOpen && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            KFL v1.0 © 2567
          </p>
        </div>
      )}
    </aside>
  )
}
