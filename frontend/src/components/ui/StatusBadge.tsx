import type { LoanStatus, InstallmentStatus, RiskLevel } from '../../types'

interface Props {
  status: LoanStatus | InstallmentStatus | RiskLevel | string
}

const config: Record<string, { label: string; className: string }> = {
  // Loan status
  active: { label: 'กำลังชำระ', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'ชำระแล้ว', className: 'bg-green-100 text-green-800' },
  overdue: { label: 'ค้างชำระ', className: 'bg-red-100 text-red-800' },
  bad_debt: { label: 'หนี้เสีย', className: 'bg-gray-200 text-gray-700' },
  written_off: { label: 'ตัดหนี้แล้ว', className: 'bg-gray-100 text-gray-500' },
  // Installment status
  pending: { label: 'รอชำระ', className: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'ชำระแล้ว', className: 'bg-green-100 text-green-800' },
  partial: { label: 'ชำระบางส่วน', className: 'bg-orange-100 text-orange-800' },
  skipped: { label: 'ข้าม', className: 'bg-gray-100 text-gray-600' },
  // Risk level
  low: { label: 'ความเสี่ยงต่ำ', className: 'bg-green-100 text-green-800' },
  normal: { label: 'ปกติ', className: 'bg-blue-100 text-blue-800' },
  high: { label: 'ความเสี่ยงสูง', className: 'bg-orange-100 text-orange-800' },
  blacklist: { label: 'Blacklist', className: 'bg-red-100 text-red-800' },
}

export default function StatusBadge({ status }: Props) {
  const cfg = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
