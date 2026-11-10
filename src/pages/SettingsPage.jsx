import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { toast } from '../components/Toast'
import { checkDatabaseSchema, syncLocalDataToSupabase } from '../lib/api'
import { SUPABASE_SCHEMA_SQL } from '../lib/schemaSql'
import {
  ArrowLeft,
  Shield,
  Pencil,
  Trash2,
  LogOut,
  User,
  Database,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useSettings()
  const { user, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dbReady, setDbReady] = useState(null)

  useEffect(() => {
    checkDatabaseSchema().then((res) => {
      setDbReady(res.ready)
    })
  }, [])

  const handleToggle = async (key) => {
    setSaving(true)
    const { error } = await updateSettings({ [key]: !settings[key] })
    if (error) {
      toast('Failed to update setting', 'error')
    } else {
      toast('Setting updated', 'success')
    }
    setSaving(false)
  }

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL)
      setCopied(true)
      toast('SQL script copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast('Could not copy automatically', 'warning')
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await syncLocalDataToSupabase()
      if (res.success) {
        toast(res.message, 'success')
        setDbReady(true)
      } else {
        toast(res.message, 'info')
      }
    } catch (error) {
      toast(`Sync failed: ${error.message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    toast('Logged out successfully', 'success')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100/50 safe-area-top safe-area-bottom pb-12">
      {/* Header */}
      <div className="glass border-b border-neutral-200/60 px-4 py-3 flex items-center gap-2.5 sticky top-0 z-10 shadow-card">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center text-neutral-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-neutral-900 tracking-tight">Settings</h1>
          <p className="text-xs text-neutral-500 font-medium">Preferences & database</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        {/* User Card */}
        <div className="bg-white rounded-2xl p-4 border border-neutral-200/60 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <User className="w-5 h-5 text-neutral-200" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-sm">
                {user?.user_metadata?.full_name || 'Brick Kiln Admin'}
              </h3>
              <p className="text-xs text-neutral-500 font-medium">{user?.email || 'Logged in'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-50 text-xs font-bold text-rose-700 transition-all active:scale-95"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Database Section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>Database & Sync</span>
            </h2>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                dbReady
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {dbReady ? 'Connected' : 'Local Mode'}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-neutral-200/60 shadow-card space-y-3">
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              {dbReady
                ? 'Supabase cloud database is active and in sync.'
                : 'Data is saved locally. To enable sync, paste the migration SQL into your Supabase SQL editor.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopySql}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold shadow-sm active:scale-95 transition-all"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
              </button>

              <a
                href="https://supabase.com/dashboard/project/akehudqkkpddhyzhtojj/sql/new"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-[10px] font-bold transition-all"
              >
                <span>Supabase SQL</span>
                <ExternalLink className="w-2.5 h-2.5 text-neutral-500" />
              </a>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-[10px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Verifying...' : 'Check & Sync'}</span>
            </button>
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-1.5">
          <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1 px-0.5">
            <Shield className="w-3 h-3" />
            <span>Permissions</span>
          </h2>

          <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-card divide-y divide-neutral-100 overflow-hidden">
            {/* Edit Toggle */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-900">Allow Editing</p>
                  <p className="text-[10px] text-neutral-400 font-medium">Edit past entries</p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('allow_edit')}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  settings.allow_edit ? 'bg-emerald-500' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.allow_edit ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Delete Toggle */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-900">Allow Deletion</p>
                  <p className="text-[10px] text-neutral-400 font-medium">Remove entry records</p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('allow_delete')}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  settings.allow_delete ? 'bg-emerald-500' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.allow_delete ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
