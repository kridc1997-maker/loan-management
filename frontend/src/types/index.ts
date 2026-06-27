// ─── Enums ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'normal' | 'high' | 'blacklist'
export type LoanType = 'single' | 'installment' | 'flexible' | 'daily'
export type LoanStatus = 'active' | 'completed' | 'overdue' | 'bad_debt' | 'written_off'
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'skipped'
export type PaymentType = 'normal' | 'partial' | 'rollover' | 'full' | 'bad_debt_recover'
export type PaymentMethod = 'cash' | 'transfer' | 'other'
export type CashTxnType = 'loan_out' | 'interest_in' | 'principal_in' | 'expense' | 'capital_in' | 'capital_out'

// ─── Customer ────────────────────────────────────────────────────────────────

export interface Customer {
  id: number
  code: string
  firstName: string
  lastName: string
  phone: string
  idCard?: string
  address?: string
  occupation?: string
  lineId?: string
  riskLevel: RiskLevel
  note?: string
  isActive: boolean
  activeLoansCount: number
  totalOutstanding: number
  creditScore: number | null
  creditLabel: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerForm {
  firstName: string
  lastName: string
  phone: string
  idCard?: string
  address?: string
  occupation?: string
  lineId?: string
  note?: string
  riskLevel?: string
}

// ─── Loan ────────────────────────────────────────────────────────────────────

export interface Loan {
  id: number
  loanNumber: string
  customerId: number
  customerName: string
  customerPhone: string
  parentLoanId?: number
  isRolledOver?: boolean
  totalPaidInterest?: number
  rolloverCount?: number
  principalAmount: number
  totalAmount: number
  interestAmount: number
  interestRate: number
  loanType: LoanType
  totalInstallments: number
  installmentAmount?: number
  paidInstallments: number
  paidPrincipal: number
  paidInterest: number
  termDays?: number | null
  issuedDate: string
  dueDate: string
  closedDate?: string
  status: LoanStatus
  note?: string
  installments?: Installment[]
  createdAt: string
}

export interface LoanForm {
  customerId: number
  principalAmount: number
  totalAmount: number
  loanType: LoanType
  totalInstallments: number
  issuedDate: string
  dueDate: string
  note?: string
}

// ─── Installment ─────────────────────────────────────────────────────────────

export interface Installment {
  id: number
  loanId: number
  installmentNo: number
  dueDate: string
  amountDue: number
  principalPortion: number
  interestPortion: number
  paidAmount: number
  paidDate?: string
  status: InstallmentStatus
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface Payment {
  id: number
  paymentNumber: string
  loanId: number
  loanNumber: string
  customerName: string
  installmentId?: number
  amount: number
  principalPaid: number
  interestPaid: number
  finePaid: number
  overPayment: number
  paymentDate: string
  paymentType: PaymentType
  paymentMethod: PaymentMethod
  note?: string
  createdAt: string
}

export interface PaymentForm {
  loanId: number
  installmentId?: number
  amount: number
  finePaid?: number
  paymentType: PaymentType
  paymentMethod: PaymentMethod
  paymentDate: string
  note?: string
}

// ─── Cash Transaction ────────────────────────────────────────────────────────

export interface CashTransaction {
  id: number
  txnNumber: string
  txnType: CashTxnType
  direction: 'in' | 'out'
  amount: number
  balanceAfter: number
  loanId?: number
  paymentId?: number
  description?: string
  txnDate: string
  createdAt: string
}

// ─── Bad Debt ────────────────────────────────────────────────────────────────

export interface BadDebt {
  id: number
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  customerPhone: string
  principalLost: number
  interestLost: number
  totalLost: number
  markedDate: string
  reason?: string
  isRecovered: boolean
  recoveredAmount?: number
  recoveredDate?: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  cashOnHand: number
  outstandingPrincipal: number
  totalAsset: number
  profitToday: number
  profitThisMonth: number
  expectedProfit: number
  overdueCount: number
  overdueAmount: number
  badDebtCount: number
  badDebtAmount: number
  collectionRate: number
  activeLoansCount: number
  newLoansToday: number
  receivedToday: number
  expenseThisMonth: number
  capitalOutThisMonth: number
  capitalInThisMonth: number
}

export interface CashFlowDay {
  date: string
  in: number
  out: number
  net: number
  balance: number
}

export interface CashFlowSummary {
  totalIn: number
  totalOut: number
  netFlow: number
  daily: CashFlowDay[]
}

export interface TopCustomer {
  customerId: number
  customerName: string
  loanCount: number
  closedLoansCount: number
  totalBorrowed: number
  totalInterestPaid: number
  creditScore: number | null
  creditLabel: string | null
}

export interface DueTodayItem {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  customerPhone: string
  installmentNo?: number
  totalInstallments?: number
  amountDue: number
  dueDate: string
  loanType: LoanType
  status: LoanStatus
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}

// ─── UI State ────────────────────────────────────────────────────────────────

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export interface FilterState {
  search: string
  status?: string
  page: number
  limit: number
}

// ─── Executive Dashboard ─────────────────────────────────────────────────────

export interface ExecKpi {
  cashOnHand: number
  cashYesterday: number
  outstandingPrincipal: number
  activeLoansCount: number
  profitThisMonth: number
  profitLastMonth: number
  roi: number
  nplRate: number
  nplAmount: number
  overdueCount: number
  overdueAmount: number
  badDebtCount: number
  badDebtAmount: number
  totalCustomers: number
  repeatCustomers: number
  repeatCustomerRate: number
  forecast7Days: number
  cashUtilization: number
  totalAsset: number
  averageLoan: number
  healthScore: number
  healthNplScore: number
  healthOverdueScore: number
  healthActiveScore: number
  healthBadDebtScore: number
}

export interface ExecForecastDay {
  date: string
  amount: number
}

export interface ExecPortfolioItem {
  loanType: string
  amount: number
  count: number
}

export interface ExecRevenueTrend {
  month: string
  interest: number
}

export interface ExecPortfolioGrowth {
  month: string
  outstanding: number
  cumulativeProfit: number
}

export interface ExecTopCustomer {
  customerId: number
  customerName: string
  loanCount: number
  outstandingPrincipal: number
  totalInterestPaid: number
  customerSince: string
  status: string
}

export interface ExecRiskItem {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  outstandingAmount: number
  daysOverdue: number
  rolloverCount: number
  status: string
  riskLevel: string
  dueDate: string
}

export interface ExecutiveDashboardData {
  kpi: ExecKpi
  cashForecast: ExecForecastDay[]
  portfolioByType: ExecPortfolioItem[]
  revenueTrend: ExecRevenueTrend[]
  portfolioGrowth: ExecPortfolioGrowth[]
  topCustomers: ExecTopCustomer[]
  riskMonitor: ExecRiskItem[]
}
