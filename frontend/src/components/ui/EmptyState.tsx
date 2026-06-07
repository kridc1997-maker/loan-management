import type { ReactNode } from 'react'
import { FileSearch } from 'lucide-react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
        {icon ?? <FileSearch size={24} />}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-500 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
