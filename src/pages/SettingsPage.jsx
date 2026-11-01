import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { toast } from '../components/Toast'
import { ArrowLeft, Shield, Pencil, Trash2, LogOut, User, Info } from 'lucide-react'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useSettings()
  const { user, signOut } = useAuth()
  const [saving, setSaving] = useState(false)

  const handleToggle = async (key) => {
    setSaving(true)
    const { error } = await updateSettings({ [key]: !settings[key] })
    if (error) {
      toast('Failed to update setting', 'error')
    } else {
      toast('Settings updated', 'success')
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await signOut()
    toast('Logged out successfully', 'success')
  }

  return (
    <div className="min-h-screen bg-gray-50 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* User Info */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <User className="w-6 h-6 text-primary-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{user?.user_metadata?.full_name || 'User'}</h3>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Permissions</h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Edit Toggle */}
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Allow Entry Editing</p>
                  <p className="text-xs text-gray-400">Allow modifying existing entries</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('allow_edit')}
                disabled={saving}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  settings.allow_edit ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.allow_edit ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-gray-50" />

            {/* Delete Toggle */}
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Allow Entry Deletion</p>
                  <p className="text-xs text-gray-400">Allow deleting existing entries</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('allow_delete')}
                disabled={saving}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  settings.allow_delete ? 'bg-red-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.allow_delete ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 mt-3 px-1">
            <Info className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Note: When editing and deletion are disabled, previous entries cannot be modified or deleted. All activities are recorded in the audit logs.
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 text-red-600 font-semibold text-sm bg-red-50 active:scale-[0.98] transition-transform"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>

        {/* App Info */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-300">Brick Kiln Hisab v1.0</p>
          <p className="text-xs text-gray-300">Brick Kiln Management System</p>
        </div>
      </div>
    </div>
  )
}
