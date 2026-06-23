import type { ReactNode } from 'react'

interface Props {
  title: string
  value: string
  sub?: string
  sub2?: string
  icon: ReactNode
  iconBg: string
  trend?: { value: string; positive: boolean }
  onClick?: () => void
}

export default function KpiCard({ title, value, sub, sub2, icon, iconBg, trend, onClick }: Props) {
  return (
    <div
      className={`kpi-card ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
          {sub2 && <p className="mt-0.5 text-xs text-red-400">{sub2}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '▲' : '▼'} {trend.value}
            </p>
          )}
        </div>
        <div className={`flex-shrink-0 ml-4 w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
