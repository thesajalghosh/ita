import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message }) {
  if (!isOpen) return null

  return (
    <Modal onClose={onCancel} panelClassName="p-5 safe-area-bottom">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      </div>
      <p className="text-xs text-neutral-500 mb-5 leading-relaxed">{message}</p>
      <div className="flex gap-2.5">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-semibold text-xs active:scale-95 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-sm"
        >
          Confirm
        </button>
      </div>
    </Modal>
  )
}
