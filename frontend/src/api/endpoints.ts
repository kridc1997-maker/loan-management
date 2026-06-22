// Typed API endpoint wrappers
import api from './client'
import type {
  CustomerForm, LoanForm, PaymentForm,
  DashboardSummary, CashFlowSummary, TopCustomer, DueTodayItem, ApiResponse,
} from '../types'
import type { AxiosResponse } from 'axios'

type R<T> = Promise<AxiosResponse<ApiResponse<T>>>

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string; user: any }>>('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: (): R<DashboardSummary> => api.get('/dashboard/summary'),
  cashFlow: (days = 30): R<CashFlowSummary> => api.get(`/dashboard/cash-flow?days=${days}`),
  dueToday: (): R<DueTodayItem[]> => api.get('/dashboard/due-today'),
  topCustomers: (limit = 10): R<TopCustomer[]> => api.get(`/dashboard/top-customers?limit=${limit}`),
  overdueSummary: () => api.get('/dashboard/overdue'),
}

// ─── Customers ────────────────────────────────────────────────────────────────
export const customerApi = {
  list: (params?: Record<string, any>) => api.get('/customers', { params }),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: CustomerForm) => api.post('/customers', data),
  update: (id: number, data: Partial<CustomerForm>) => api.put(`/customers/${id}`, data),
  loans: (id: number) => api.get(`/customers/${id}/loans`),
  paymentStats: (id: number) => api.get(`/customers/${id}/payment-stats`),
}

// ─── Loans ────────────────────────────────────────────────────────────────────
export const loanApi = {
  list: (params?: Record<string, any>) => api.get('/loans', { params }),
  get: (id: number) => api.get(`/loans/${id}`),
  create: (data: LoanForm) => api.post('/loans', data),
  installments: (id: number) => api.get(`/loans/${id}/installments`),
  payment: (id: number, data: PaymentForm) => api.post(`/loans/${id}/payment`, data),
  rollover: (id: number, data: { interestCollected: number; newDueDate: string; note?: string }) =>
    api.post(`/loans/${id}/rollover`, data),
  markBadDebt: (id: number, reason: string) => api.post(`/loans/${id}/mark-bad-debt`, { reason }),
  markComplete: (id: number) => api.post(`/loans/${id}/mark-complete`),
  convertToFlexible: (id: number) => api.post(`/loans/${id}/convert-to-flexible`),
  updateDueDate: (id: number, newDueDate: string) => api.put(`/loans/${id}/due-date`, { newDueDate }),
  adjust: (id: number, data: { principalAmount: number; totalAmount: number }) =>
    api.put(`/loans/${id}/adjust`, data),
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentApi = {
  list: (params?: Record<string, any>) => api.get('/payments', { params }),
  daily: (date: string) => api.get('/payments/daily', { params: { date } }),
}

// ─── Bad Debts ────────────────────────────────────────────────────────────────
export const badDebtApi = {
  list: () => api.get('/bad-debts'),
  recover: (id: number, recoveredAmount?: number) => api.put(`/bad-debts/${id}/recover`, { recoveredAmount }),
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportApi = {
  monthly: () => api.get('/reports/monthly'),
  profit: (from?: string, to?: string) => api.get('/reports/profit', { params: { from, to } }),
  monthlyStats: (year?: number) => api.get('/reports/monthly-stats', { params: { year } }),
}

// ─── Cash ─────────────────────────────────────────────────────────────────────
export const cashApi = {
  balance: () => api.get('/cash/balance'),
  daily: (date: string) => api.get('/cash/daily', { params: { date } }),
  adjust: (data: { type: 'capital_in' | 'capital_out' | 'expense'; amount: number; description?: string; txnDate?: string }) =>
    api.post('/cash/adjust', data),
  setBalance: (targetBalance: number, description?: string) =>
    api.post('/cash/set-balance', { targetBalance, description }),
}

// ─── Users ────────────────────────────────────────────────────────────────────
export const userApi = {
  list: () => api.get('/users'),
  create: (data: { username: string; password: string; fullName: string; role: 'admin' | 'staff' }) =>
    api.post('/users', data),
  update: (id: number, data: { fullName?: string; role?: 'admin' | 'staff'; isActive?: boolean }) =>
    api.put(`/users/${id}`, data),
  resetPassword: (id: number, newPassword: string) =>
    api.put(`/users/${id}/password`, { newPassword }),
  remove: (id: number) => api.delete(`/users/${id}`),
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: Record<string, string>) => api.put('/settings', data),
}
