import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, User, Calendar, LogOut, ChevronDown, Wallet, FileText, Moon, Sun } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { formatCurrency, formatDate } from '../../utils/financial'
import { dashboardApi } from '../../api/endpoints'

export default function Header() {
  const { toggleSidebar, darkMode, toggleDarkMode } = useAppStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const today = formatDate(new Date().toISOString())
  const [cashOnHand, setCashOnHand] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchSummary = () => {
      dashboardApi.summary().then((res) => {
        const d = res.data.data
        setCashOnHand(d.cashOnHand)
        setActiveCount(d.activeLoansCount)
      }).catch(() => {})
    }
    fetchSummary()
    window.addEventListener('header-refresh', fetchSummary)
    return () => window.removeEventListener('header-refresh', fetchSummary)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex-shrink-0 h-14 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 flex items-center px-4 gap-4 shadow-sm z-10 w-full">
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-1.5 text-sm text-gray-400">
        <Calendar size={13} />
        <span>{today}</span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-6 select-none">
        {cashOnHand !== null && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-100">
            <Wallet size={13} className="text-blue-500" />
            <span className="text-xs text-blue-400">เงินสด</span>
            <span className="text-xs font-bold text-blue-700">{formatCurrency(cashOnHand)}</span>
          </div>
        )}
        {activeCount !== null && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 border border-green-100">
            <FileText size={13} className="text-green-500" />
            <span className="text-xs text-green-400">กำลังชำระ</span>
            <span className="text-xs font-bold text-green-700">{activeCount} สัญญา</span>
          </div>
        )}
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        aria-label="Toggle dark mode"
        title={darkMode ? 'โหมดกลางวัน' : 'โหมดกลางคืน'}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Notification */}
      <button className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700 transition-colors">
        <Bell size={18} />
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-600"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1565C0, #1976D2)' }}
          >
            <User size={14} className="text-white" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-gray-800 leading-none">{user?.fullName ?? 'ผู้ใช้งาน'}</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">
              {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
            </p>
          </div>
          <ChevronDown size={13} className={`text-gray-400 transition-transform ml-0.5 ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl dark:shadow-slate-900/60 py-1.5 z-50 overflow-hidden">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1565C0, #1976D2)' }}
                >
                  <User size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user?.fullName}</p>
                  <p className="text-xs text-gray-400">@{user?.username}</p>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors mt-1"
            >
              <LogOut size={15} />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
