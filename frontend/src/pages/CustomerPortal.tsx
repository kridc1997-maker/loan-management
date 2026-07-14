import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Sun, Moon } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatDate, isInstallmentBased, toInputDate, todayInputDate } from '../utils/financial'
import { portalApi } from '../api/endpoints'
import { useAppStore } from '../stores/appStore'
import type { PortalData } from '../types'

const LOAN_TYPE_LABEL: Record<string, string> = {
  single: 'ครั้งเดียว', installment: 'รายงวด', flexible: 'ยืดหยุ่น', daily: 'รายวัน',
}

export default function CustomerPortal() {
  const { token } = useParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { darkMode, toggleDarkMode } = useAppStore()

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return }
    portalApi.get(token)
      .then((res) => setData(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-screen bg-[#F0F4F8] dark:bg-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#0D47A1,#1976D2)' }}>
              <span className="text-xs font-black text-white">KFL</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-slate-100">ข้อมูลสินเชื่อของคุณ</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Krit Friend Loan</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors flex-shrink-0"
            aria-label="Toggle dark mode"
            title={darkMode ? 'โหมดกลางวัน' : 'โหมดกลางคืน'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error || !data ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-8 text-center">
            <AlertCircle size={32} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-slate-400">ไม่พบข้อมูล ลิงก์นี้อาจไม่ถูกต้องหรือหมดอายุ</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">สวัสดีคุณ <span className="font-semibold text-gray-900 dark:text-slate-100">{data.customerName}</span></p>

            {data.loans.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-slate-400">ไม่มีสัญญาที่กำลังใช้งานอยู่ในขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.loans.map((loan) => {
                  const paid = loan.paidPrincipal + loan.paidInterest
                  const remaining = Math.max(0, loan.totalAmount - paid)
                  const relevantDueDate = (isInstallmentBased(loan.loanType) ? loan.nextInstallmentDueDate : null) ?? loan.dueDate
                  const isOverdue = loan.status === 'overdue'
                  const isDueToday = !isOverdue && toInputDate(relevantDueDate) === todayInputDate()
                  const cardClass = isOverdue
                    ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900'
                    : isDueToday
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900'
                    : 'bg-white dark:bg-slate-800'
                  return (
                    <div key={loan.loanNumber} className={`${cardClass} rounded-2xl shadow p-5 space-y-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs text-gray-500 dark:text-slate-400">{loan.loanNumber}</span>
                            <StatusBadge status={loan.status} />
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                              {LOAN_TYPE_LABEL[loan.loanType] ?? loan.loanType}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-slate-700 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500">เงินต้น</p>
                          <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">{formatCurrency(loan.principalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500">ดอกเบี้ยรวม</p>
                          <p className="font-semibold text-green-600 dark:text-green-400 mt-0.5">{formatCurrency(loan.interestAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500">ยอดรวม</p>
                          <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">{formatCurrency(loan.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500">คงเหลือ</p>
                          <p className="font-semibold text-orange-600 dark:text-orange-400 mt-0.5">{formatCurrency(remaining)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500">วันปล่อยกู้</p>
                          <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">{formatDate(loan.issuedDate)}</p>
                        </div>
                        {loan.loanType === 'single' && (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-slate-500">จำนวนวันที่กู้</p>
                            <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                              {loan.termDays ?? Math.round((new Date(loan.dueDate).getTime() - new Date(loan.issuedDate).getTime()) / 86400000)} วัน
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500">
                            {isInstallmentBased(loan.loanType) ? 'ชำระงวดถัดไป' : 'ครบกำหนด'}
                          </p>
                          <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                            {formatDate((isInstallmentBased(loan.loanType) ? loan.nextInstallmentDueDate : null) ?? loan.dueDate)}
                          </p>
                        </div>
                        {isInstallmentBased(loan.loanType) && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400 dark:text-slate-500">งวด</p>
                            <p className="font-semibold text-gray-900 dark:text-slate-100 mt-0.5">{loan.paidInstallments}/{loan.totalInstallments} งวด</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-8">
              หากข้อมูลไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่โดยตรง
            </p>
          </>
        )}
      </div>
    </div>
  )
}
