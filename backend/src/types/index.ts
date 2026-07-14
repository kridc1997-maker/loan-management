import type { Request } from 'express'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: number
  username: string
  role: string
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'normal' | 'high' | 'blacklist'
export type LoanType = 'single' | 'installment' | 'flexible' | 'daily'
export type LoanStatus = 'active' | 'completed' | 'overdue' | 'bad_debt' | 'written_off'
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'skipped'
export type PaymentType = 'normal' | 'partial' | 'rollover' | 'full' | 'bad_debt_recover'
export type PaymentMethod = 'cash' | 'transfer' | 'other'
export type CashTxnType = 'loan_out' | 'interest_in' | 'principal_in' | 'expense' | 'capital_in' | 'capital_out'
export type CashDirection = 'in' | 'out'

// ─── DB Row Types ─────────────────────────────────────────────────────────────

export interface CustomerRow {
  id: number
  code: string
  first_name: string
  last_name: string
  phone: string
  id_card?: string
  address?: string
  occupation?: string
  line_id?: string
  risk_level: RiskLevel
  note?: string
  is_active: boolean
  portal_token?: string | null
  created_by?: number
  created_at: Date
  updated_at: Date
}

export interface LoanRow {
  id: number
  loan_number: string
  customer_id: number
  parent_loan_id?: number
  principal_amount: number
  total_amount: number
  interest_amount: number
  interest_rate: number
  loan_type: LoanType
  total_installments: number
  installment_amount?: number
  issued_date: string
  due_date: string
  closed_date?: string
  paid_principal: number
  paid_interest: number
  paid_installments: number
  status: LoanStatus
  note?: string
  created_by?: number
  created_at: Date
  updated_at: Date
}

export interface InstallmentRow {
  id: number
  loan_id: number
  installment_no: number
  due_date: string
  amount_due: number
  principal_portion: number
  interest_portion: number
  paid_amount: number
  paid_date?: string
  status: InstallmentStatus
  created_at: Date
  updated_at: Date
}

export interface PaymentRow {
  id: number
  payment_number: string
  loan_id: number
  installment_id?: number
  amount: number
  principal_paid: number
  interest_paid: number
  over_payment: number
  payment_date: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  note?: string
  created_by?: number
  created_at: Date
}

export interface CashTransactionRow {
  id: number
  txn_number: string
  txn_type: CashTxnType
  direction: CashDirection
  amount: number
  balance_after: number
  loan_id?: number
  payment_id?: number
  description?: string
  txn_date: string
  created_by?: number
  created_at: Date
}

export interface BadDebtRow {
  id: number
  loan_id: number
  customer_id: number
  principal_lost: number
  interest_lost: number
  total_lost: number
  marked_date: string
  reason?: string
  is_recovered: boolean
  recovered_amount?: number
  recovered_date?: string
  created_by?: number
  created_at: Date
  updated_at: Date
}

export interface UserRow {
  id: number
  role_id: number
  username: string
  password_hash: string
  full_name: string
  is_active: boolean
  last_login_at?: Date
  created_at: Date
  updated_at: Date
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: true
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  success: false
  message: string
  code?: string
  errors?: Record<string, string[]>
}

export interface PaginationQuery {
  page?: number
  limit?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface LoanFilter extends PaginationQuery {
  status?: LoanStatus
  customerId?: number
  search?: string
  dueDateFrom?: string
  dueDateTo?: string
}

export interface CustomerFilter extends PaginationQuery {
  search?: string
  riskLevel?: RiskLevel
  hasActiveLoans?: boolean
}
