// Mock data for frontend development (ใช้ก่อนมี Backend จริง)

import type {
  Customer, Loan, Installment, Payment, BadDebt,
  DashboardSummary, CashFlowSummary, TopCustomer, DueTodayItem
} from '../types'

export const mockCustomers: Customer[] = [
  {
    id: 1, code: 'CUS-0001', firstName: 'สมชาย', lastName: 'ใจดี',
    phone: '081-234-5678', idCard: '1234567890123', address: 'บ้านเลขที่ 123 แขวงบางรัก กทม.',
    occupation: 'รับจ้าง', lineId: '@somchai', riskLevel: 'normal', note: '',
    isActive: true, activeLoansCount: 2, totalOutstanding: 9000, collectionRate: 0.92,
    createdAt: '2024-01-15T09:00:00Z', updatedAt: '2024-06-01T10:00:00Z',
  },
  {
    id: 2, code: 'CUS-0002', firstName: 'มาลี', lastName: 'สวยงาม',
    phone: '082-345-6789', idCard: '2345678901234', address: '456 ถนนสุขุมวิท กทม.',
    occupation: 'แม่บ้าน', riskLevel: 'low', note: 'ชำระตรงเวลาทุกครั้ง',
    isActive: true, activeLoansCount: 0, totalOutstanding: 0, collectionRate: 1.0,
    createdAt: '2024-02-10T09:00:00Z', updatedAt: '2024-05-20T10:00:00Z',
  },
  {
    id: 3, code: 'CUS-0003', firstName: 'วิชัย', lastName: 'มาดี',
    phone: '083-456-7890', idCard: '3456789012345', address: '789 ถ.รัชดา กทม.',
    occupation: 'ค้าขาย', riskLevel: 'high', note: 'เคยค้างชำระ 15 วัน',
    isActive: true, activeLoansCount: 1, totalOutstanding: 4000, collectionRate: 0.72,
    createdAt: '2024-03-05T09:00:00Z', updatedAt: '2024-06-05T10:00:00Z',
  },
  {
    id: 4, code: 'CUS-0004', firstName: 'สมศรี', lastName: 'ดีงาม',
    phone: '084-567-8901', riskLevel: 'normal',
    isActive: true, activeLoansCount: 1, totalOutstanding: 5000, collectionRate: 0.85,
    createdAt: '2024-03-20T09:00:00Z', updatedAt: '2024-06-03T10:00:00Z',
  },
  {
    id: 5, code: 'CUS-0005', firstName: 'ประหยัด', lastName: 'น้อยใจ',
    phone: '085-678-9012', riskLevel: 'high', note: 'ค้างชำระ 15 วัน',
    isActive: true, activeLoansCount: 1, totalOutstanding: 8000, collectionRate: 0.55,
    createdAt: '2024-01-25T09:00:00Z', updatedAt: '2024-05-15T10:00:00Z',
  },
]

export const mockInstallments: Installment[] = [
  { id: 1, loanId: 1, installmentNo: 1, dueDate: '2024-06-08', amountDue: 1250, principalPortion: 1000, interestPortion: 250, paidAmount: 1250, paidDate: '2024-06-08', status: 'paid' },
  { id: 2, loanId: 1, installmentNo: 2, dueDate: '2024-06-09', amountDue: 1250, principalPortion: 1000, interestPortion: 250, paidAmount: 1250, paidDate: '2024-06-09', status: 'paid' },
  { id: 3, loanId: 1, installmentNo: 3, dueDate: '2024-06-10', amountDue: 1250, principalPortion: 1000, interestPortion: 250, paidAmount: 0, status: 'pending' },
  { id: 4, loanId: 1, installmentNo: 4, dueDate: '2024-06-11', amountDue: 1250, principalPortion: 1000, interestPortion: 250, paidAmount: 0, status: 'pending' },
]

export const mockLoans: Loan[] = [
  {
    id: 1, loanNumber: 'LN-20240607-001', customerId: 1, customerName: 'สมชาย ใจดี', customerPhone: '081-234-5678',
    principalAmount: 4000, totalAmount: 5000, interestAmount: 1000, interestRate: 0.25,
    loanType: 'installment', totalInstallments: 4, installmentAmount: 1250,
    paidInstallments: 2, paidPrincipal: 2000, paidInterest: 500,
    issuedDate: '2024-06-07', dueDate: '2024-06-11', status: 'active',
    installments: mockInstallments,
    createdAt: '2024-06-07T09:00:00Z',
  },
  {
    id: 2, loanNumber: 'LN-20240601-002', customerId: 1, customerName: 'สมชาย ใจดี', customerPhone: '081-234-5678',
    principalAmount: 3000, totalAmount: 3600, interestAmount: 600, interestRate: 0.20,
    loanType: 'single', totalInstallments: 1,
    paidInstallments: 1, paidPrincipal: 3000, paidInterest: 600,
    issuedDate: '2024-05-25', dueDate: '2024-05-30', closedDate: '2024-05-30', status: 'completed',
    createdAt: '2024-05-25T09:00:00Z',
  },
  {
    id: 3, loanNumber: 'LN-20240603-003', customerId: 4, customerName: 'สมศรี ดีงาม', customerPhone: '084-567-8901',
    principalAmount: 5000, totalAmount: 6250, interestAmount: 1250, interestRate: 0.25,
    loanType: 'single', totalInstallments: 1,
    paidInstallments: 0, paidPrincipal: 0, paidInterest: 0,
    issuedDate: '2024-05-31', dueDate: '2024-06-07', status: 'overdue',
    createdAt: '2024-05-31T09:00:00Z',
  },
  {
    id: 4, loanNumber: 'LN-20240520-004', customerId: 5, customerName: 'ประหยัด น้อยใจ', customerPhone: '085-678-9012',
    principalAmount: 8000, totalAmount: 10000, interestAmount: 2000, interestRate: 0.25,
    loanType: 'single', totalInstallments: 1,
    paidInstallments: 0, paidPrincipal: 0, paidInterest: 0,
    issuedDate: '2024-05-20', dueDate: '2024-05-27', status: 'overdue',
    createdAt: '2024-05-20T09:00:00Z',
  },
  {
    id: 5, loanNumber: 'LN-20240605-005', customerId: 3, customerName: 'วิชัย มาดี', customerPhone: '083-456-7890',
    principalAmount: 4000, totalAmount: 5000, interestAmount: 1000, interestRate: 0.25,
    loanType: 'installment', totalInstallments: 4, installmentAmount: 1250,
    paidInstallments: 1, paidPrincipal: 1000, paidInterest: 250,
    issuedDate: '2024-06-05', dueDate: '2024-06-09', status: 'active',
    createdAt: '2024-06-05T09:00:00Z',
  },
]

export const mockPayments: Payment[] = [
  { id: 1, paymentNumber: 'PAY-20240608-001', loanId: 1, loanNumber: 'LN-20240607-001', customerName: 'สมชาย ใจดี', installmentId: 1, amount: 1250, principalPaid: 1000, interestPaid: 250, overPayment: 0, paymentDate: '2024-06-08', paymentType: 'normal', paymentMethod: 'cash', createdAt: '2024-06-08T10:00:00Z' },
  { id: 2, paymentNumber: 'PAY-20240609-002', loanId: 1, loanNumber: 'LN-20240607-001', customerName: 'สมชาย ใจดี', installmentId: 2, amount: 1250, principalPaid: 1000, interestPaid: 250, overPayment: 0, paymentDate: '2024-06-09', paymentType: 'normal', paymentMethod: 'cash', createdAt: '2024-06-09T10:00:00Z' },
  { id: 3, paymentNumber: 'PAY-20240607-003', loanId: 5, loanNumber: 'LN-20240605-005', customerName: 'วิชัย มาดี', installmentId: undefined, amount: 1250, principalPaid: 1000, interestPaid: 250, overPayment: 0, paymentDate: '2024-06-07', paymentType: 'normal', paymentMethod: 'cash', createdAt: '2024-06-07T14:00:00Z' },
]

export const mockBadDebts: BadDebt[] = [
  { id: 1, loanId: 10, loanNumber: 'LN-20240101-010', customerId: 6, customerName: 'นายหนี้ หนีหาย', customerPhone: '089-000-0001', principalLost: 5000, interestLost: 1250, totalLost: 6250, markedDate: '2024-04-15', reason: 'ติดต่อไม่ได้ 90 วัน', isRecovered: false },
  { id: 2, loanId: 11, loanNumber: 'LN-20240110-011', customerId: 7, customerName: 'สาวหนี้ หลบหน้า', customerPhone: '089-000-0002', principalLost: 3000, interestLost: 750, totalLost: 3750, markedDate: '2024-05-01', reason: 'ย้ายที่อยู่ไม่แจ้ง', isRecovered: false },
  { id: 3, loanId: 12, loanNumber: 'LN-20231201-012', customerId: 8, customerName: 'เก่า เกษียณหนี้', customerPhone: '089-000-0003', principalLost: 2000, interestLost: 500, totalLost: 2500, markedDate: '2024-01-10', reason: 'เสียชีวิต', isRecovered: true, recoveredAmount: 1500, recoveredDate: '2024-03-20' },
]

export const mockDashboard: DashboardSummary = {
  cashOnHand: 45200,
  outstandingPrincipal: 128000,
  totalAsset: 173200,
  profitToday: 2400,
  profitThisMonth: 18500,
  expectedProfit: 31500,
  overdueCount: 8,
  overdueAmount: 24000,
  badDebtCount: 3,
  badDebtAmount: 9500,
  collectionRate: 0.875,
  activeLoansCount: 23,
  newLoansToday: 2,
}

export const mockCashFlow: CashFlowSummary = {
  totalIn: 85000,
  totalOut: 62000,
  netFlow: 23000,
  daily: Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    const inAmount = Math.floor(Math.random() * 8000) + 2000
    const outAmount = Math.floor(Math.random() * 6000) + 1000
    return {
      date: date.toISOString().split('T')[0],
      in: inAmount,
      out: outAmount,
      net: inAmount - outAmount,
      balance: 40000 + i * 500,
    }
  }),
}

export const mockTopCustomers: TopCustomer[] = [
  { customerId: 1, customerName: 'สมชาย ใจดี', loanCount: 5, closedLoansCount: 3, totalBorrowed: 18000, totalInterestPaid: 3800, collectionRate: 0.92 },
  { customerId: 4, customerName: 'สมศรี ดีงาม', loanCount: 3, closedLoansCount: 2, totalBorrowed: 12000, totalInterestPaid: 2800, collectionRate: 0.85 },
  { customerId: 3, customerName: 'วิชัย มาดี', loanCount: 4, closedLoansCount: 1, totalBorrowed: 10000, totalInterestPaid: 1800, collectionRate: 0.72 },
  { customerId: 2, customerName: 'มาลี สวยงาม', loanCount: 2, closedLoansCount: 2, totalBorrowed: 5000, totalInterestPaid: 1100, collectionRate: 1.0 },
]

export const mockDueToday: DueTodayItem[] = [
  { loanId: 1, loanNumber: 'LN-20240607-001', customerId: 1, customerName: 'สมชาย ใจดี', customerPhone: '081-234-5678', installmentNo: 3, totalInstallments: 4, amountDue: 1250, dueDate: new Date().toISOString().split('T')[0], loanType: 'installment', status: 'active' },
  { loanId: 3, loanNumber: 'LN-20240603-003', customerId: 4, customerName: 'สมศรี ดีงาม', customerPhone: '084-567-8901', amountDue: 6250, dueDate: new Date().toISOString().split('T')[0], loanType: 'single', status: 'overdue' },
]
