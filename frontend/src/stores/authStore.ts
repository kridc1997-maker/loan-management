import { create } from 'zustand'
import { authApi } from '../api/endpoints'

interface User {
  id: number
  username: string
  fullName: string
  role: string
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  initFromStorage: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const res = await authApi.login(username, password)
      const { accessToken, refreshToken, user } = res.data.data
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      set({ user, isLoading: false })
    } catch {
      set({ isLoading: false })
      throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null })
  },

  initFromStorage: () => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    // Decode JWT payload without verification (client-side only for UI)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('accessToken')
        return
      }
      set({ user: { id: payload.userId, username: payload.username, fullName: payload.username, role: payload.role } })
    } catch {
      localStorage.removeItem('accessToken')
    }
  },
}))
