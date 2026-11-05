import { create } from 'zustand'
import type { Toast } from '../types'

const getInitialDark = () => {
  try {
    const isDark = localStorage.getItem('kfl-dark') === '1'
    if (isDark) document.documentElement.classList.add('dark')
    return isDark
  } catch { return false }
}

interface AppStore {
  sidebarOpen: boolean
  darkMode: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleDarkMode: () => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  // phones/tablets get an off-canvas drawer that starts closed; desktop keeps the full sidebar
  sidebarOpen: typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  darkMode: getInitialDark(),
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    try { localStorage.setItem('kfl-dark', next ? '1' : '0') } catch {}
    document.documentElement.classList.toggle('dark', next)
    return { darkMode: next }
  }),

  addToast: (type, message) => {
    const id = Date.now().toString()
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
