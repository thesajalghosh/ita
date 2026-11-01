import { FolderOpen } from 'lucide-react'

export default function EmptyState({ icon: Icon = FolderOpen, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{message}</p>
      {action}
    </div>
  )
}
