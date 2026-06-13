import { create } from 'zustand'
import type { Toast } from '../types'

const getInitialDark = () => {
  try { return localStorage.getItem('kfl-dark') === '1' } catch { return false }
}

interface AppStore {
  sidebarOpen: boolean
  darkMode: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  toggleDarkMode: () => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  darkMode: getInitialDark(),
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    try { localStorage.setItem('kfl-dark', next ? '1' : '0') } catch {}
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
