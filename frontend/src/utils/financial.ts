// Financial calculation utilities
import type { LoanType } from '../types'

export const INSTALLMENT_BASED_TYPES: LoanType[] = ['installment', 'daily']
export const isInstallmentBased = (loanType: LoanType): boolean =>
  INSTALLMENT_BASED_TYPES.includes(loanType)

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('th-TH').format(num)
}

export const formatPercent = (value: number, decimals = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`
}

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-'
  const parts = dateStr.slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || isNaN(parts[0])) return '-'
  const [y, m, d] = parts
  return `${String(d).padStart(2, '0')} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`
}

export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '-'
  const parts = dateStr.slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || isNaN(parts[0])) return '-'
  const [y, m, d] = parts
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String((y + 543) % 100).padStart(2, '0')}`
}

export const toInputDate = (dateStr: string): string => {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

export const todayInputDate = (): string => {
  return new Date().toISOString().split('T')[0]
}

export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const daysDiff = (from: string, to: string): number => {
  const a = new Date(from + 'T00:00:00Z').getTime()
  const b = new Date(to + 'T00:00:00Z').getTime()
  return Math.floor((b - a) / 86400000)
}

export const daysOverdue = (dueDate: string): number => {
  const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
  const dueMs = new Date(dueDate.slice(0, 10) + 'T00:00:00Z').getTime()
  return Math.max(0, Math.floor((todayMs - dueMs) / 86400000))
}

// Calculate interest rate from principal, total and days
export const calcInterestRate = (principal: number, total: number): number => {
  if (principal <= 0) return 0
  return (total - principal) / principal
}

// Calculate installment amount
export const calcInstallmentAmount = (total: number, count: number): number => {
  if (count <= 0) return total
  return Math.ceil(total / count)
}

// Calculate interest amount
export const calcInterest = (principal: number, total: number): number => {
  return total - principal
}

// Generate installment schedule
export const generateInstallmentSchedule = (
  startDate: string,
  totalAmount: number,
  count: number,
  frequencyDays = 1,
): { dueDate: string; amount: number }[] => {
  const installmentAmount = calcInstallmentAmount(totalAmount, count)
  const schedule = []

  for (let i = 0; i < count; i++) {
    const dueDate = addDays(startDate, (i + 1) * frequencyDays)
    const isLast = i === count - 1
    // Last installment absorbs rounding difference
    const amount = isLast ? totalAmount - installmentAmount * (count - 1) : installmentAmount
    schedule.push({ dueDate, amount })
  }

  return schedule
}

// Outstanding balance on a loan
export const calcOutstanding = (principalAmount: number, paidPrincipal: number): number => {
  return Math.max(0, principalAmount - paidPrincipal)
}

// Collection rate color
export const collectionRateColor = (rate: number): string => {
  if (rate >= 0.9) return 'text-green-600'
  if (rate >= 0.7) return 'text-yellow-600'
  return 'text-red-600'
}

// Overdue severity
export const overdueSeverity = (days: number): 'low' | 'medium' | 'high' => {
  if (days <= 7) return 'low'
  if (days <= 30) return 'medium'
  return 'high'
}

export const overdueBadgeClass = (days: number): string => {
  const severity = overdueSeverity(days)
  if (severity === 'low') return 'bg-yellow-100 text-yellow-800'
  if (severity === 'medium') return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}
