import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="slide-up relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-auto p-6 shadow-2xl safe-area-bottom">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-medium text-sm active:scale-95 transition-transform"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
