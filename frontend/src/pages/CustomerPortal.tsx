import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatDate, isInstallmentBased } from '../utils/financial'
import { portalApi } from '../api/endpoints'
import type { PortalData } from '../types'

const LOAN_TYPE_LABEL: Record<string, string> = {
  single: 'ครั้งเดียว', installment: 'รายงวด', flexible: 'ยืดหยุ่น', daily: 'รายวัน',
}

export default function CustomerPortal() {
  const { token } = useParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return }
    portalApi.get(token)
      .then((res) => setData(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg,#0D47A1,#1976D2)' }}>
            <span className="text-xs font-black text-white">KFL</span>
          </div>
          <div>
            <p className="font-bold text-gray-900">ข้อมูลสินเชื่อของคุณ</p>
            <p className="text-xs text-gray-400">Krit Friend Loan</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error || !data ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <AlertCircle size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">ไม่พบข้อมูล ลิงก์นี้อาจไม่ถูกต้องหรือหมดอายุ</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">สวัสดีคุณ <span className="font-semibold text-gray-900">{data.customerName}</span></p>

            {data.loans.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center">
                <p className="text-sm text-gray-500">ไม่มีสัญญาที่กำลังใช้งานอยู่ในขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.loans.map((loan) => {
                  const paid = loan.paidPrincipal + loan.paidInterest
                  const remaining = Math.max(0, loan.totalAmount - paid)
                  return (
                    <div key={loan.loanNumber} className="bg-white rounded-2xl shadow p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs text-gray-500">{loan.loanNumber}</span>
                            <StatusBadge status={loan.status} />
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {LOAN_TYPE_LABEL[loan.loanType] ?? loan.loanType}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-sm">
                        <div>
                          <p className="text-xs text-gray-400">เงินต้น</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(loan.principalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">ดอกเบี้ยรวม</p>
                          <p className="font-semibold text-green-600 mt-0.5">{formatCurrency(loan.interestAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">ยอดรวม</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(loan.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">คงเหลือ</p>
                          <p className="font-semibold text-orange-600 mt-0.5">{formatCurrency(remaining)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">วันปล่อยกู้</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{formatDate(loan.issuedDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">ครบกำหนด</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{formatDate(loan.dueDate)}</p>
                        </div>
                        {isInstallmentBased(loan.loanType) && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-400">งวด</p>
                            <p className="font-semibold text-gray-900 mt-0.5">{loan.paidInstallments}/{loan.totalInstallments} งวด</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-8">
              หากข้อมูลไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่โดยตรง
            </p>
          </>
        )}
      </div>
    </div>
  )
}
