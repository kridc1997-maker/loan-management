import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const icons = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertCircle size={18} className="text-yellow-500" />,
  info: <Info size={18} className="text-blue-500" />,
}

const bgClass = {
  success: 'border-l-4 border-green-500',
  error: 'border-l-4 border-red-500',
  warning: 'border-l-4 border-yellow-500',
  info: 'border-l-4 border-blue-500',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 min-w-[280px]">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 bg-white rounded-xl shadow-lg px-4 py-3 ${bgClass[t.type]}`}>
          {icons[t.type]}
          <span className="flex-1 text-sm text-gray-800">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
