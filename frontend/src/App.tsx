import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CustomerList from './pages/customers/CustomerList'
import CustomerDetail from './pages/customers/CustomerDetail'
import NewLoan from './pages/loans/NewLoan'
import ActiveLoans from './pages/loans/ActiveLoans'
import LoanDetail from './pages/loans/LoanDetail'
import InstallmentSchedule from './pages/loans/InstallmentSchedule'
import ReceivePayment from './pages/payments/ReceivePayment'
import OverdueLoans from './pages/OverdueLoans'
import BadDebt from './pages/BadDebt'
import CashFlow from './pages/CashFlow'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Users from './pages/Users'
import { useAuthStore } from './stores/authStore'

// Simple auth guard — shows Login if no token
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { initFromStorage } = useAuthStore()

  useEffect(() => {
    initFromStorage()
  }, [initFromStorage])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
        <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute><ActiveLoans /></ProtectedRoute>} />
        <Route path="/loans/new" element={<ProtectedRoute><NewLoan /></ProtectedRoute>} />
        <Route path="/loans/installments" element={<ProtectedRoute><InstallmentSchedule /></ProtectedRoute>} />
        <Route path="/loans/:id" element={<ProtectedRoute><LoanDetail /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><ReceivePayment /></ProtectedRoute>} />
        <Route path="/overdue" element={<ProtectedRoute><OverdueLoans /></ProtectedRoute>} />
        <Route path="/bad-debt" element={<ProtectedRoute><BadDebt /></ProtectedRoute>} />
        <Route path="/cash-flow" element={<ProtectedRoute><CashFlow /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
