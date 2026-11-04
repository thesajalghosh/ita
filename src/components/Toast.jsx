import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

let toastId = 0
let addToastFn = null

export function toast(message, type = 'success') {
  if (addToastFn) {
    addToastFn({ id: ++toastId, message, type })
  }
}

export default function Toast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((t) => {
    setToasts((prev) => [...prev, t])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id))
    }, 3000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
  }

  const bgColors = {
    success: 'bg-white border-emerald-200/80',
    error: 'bg-white border-red-200/80',
    warning: 'bg-white border-amber-200/80',
    info: 'bg-white border-blue-200/80',
  }

  return (
    <div className="fixed top-3 left-3 right-3 z-[60] flex flex-col gap-1.5 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-lg ${bgColors[t.type] || bgColors.success}`}
        >
          {icons[t.type] || icons.success}
          <span className="flex-1 text-xs font-semibold text-neutral-800">{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
