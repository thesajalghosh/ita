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
    const res = await syncLocalDataToSupabase()
    if (res.success) {
      toast(res.message, 'success')
      setDbReady(true)
    } else {
      toast(res.message, 'info')
    }
    setSyncing(false)
  }

  const handleLogout = async () => {
    await signOut()
    toast('Logged out successfully', 'success')
  }

  return (
    <div className="min-h-screen bg-neutral-50/70 safe-area-top safe-area-bottom pb-12">
      {/* Minimal Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-neutral-200/70 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 active:scale-95 transition-all flex items-center justify-center text-neutral-700"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-neutral-900 tracking-tight">Settings</h1>
          <p className="text-[11px] text-neutral-400">App preferences and database</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-5">
        {/* User Info Card */}
        <div className="bg-white rounded-2xl p-4 border border-neutral-200/70 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5 text-neutral-200" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 text-sm">
                {user?.user_metadata?.full_name || 'Brick Kiln Admin'}
              </h3>
              <p className="text-xs text-neutral-400">{user?.email || 'Logged in'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-xs font-medium transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Database & Cloud Setup Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Database & Cloud Sync</span>
            </h2>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                dbReady
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {dbReady ? 'Supabase Connected' : 'Local Fallback Active'}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-neutral-200/70 shadow-2xs space-y-3.5">
            <p className="text-xs text-neutral-600 leading-relaxed">
              {dbReady
                ? 'Your Supabase cloud database tables are active and in sync.'
                : 'Your app is safely saving data locally in your browser. To enable multi-device sync, paste the migration SQL script into your Supabase SQL editor.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopySql}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-medium shadow-xs active:scale-95 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'SQL Copied!' : 'Copy SQL Script'}</span>
              </button>

              <a
                href="https://supabase.com/dashboard/project/akehudqkkpddhyzhtojj/sql/new"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 text-neutral-800 text-xs font-medium transition-all"
              >
                <span>Supabase SQL</span>
                <ExternalLink className="w-3 h-3 text-neutral-500" />
              </a>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Verifying...' : 'Check Status & Sync Local Data'}</span>
            </button>
          </div>
        </div>

        {/* Security & Permissions */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Permissions & Safeguards</span>
          </h2>

          <div className="bg-white rounded-2xl border border-neutral-200/70 shadow-2xs divide-y divide-neutral-100 overflow-hidden">
            {/* Edit Toggle */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Allow Entry Editing</p>
                  <p className="text-[11px] text-neutral-400">Enable editing past calculations</p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('allow_edit')}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  settings.allow_edit ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                    settings.allow_edit ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Delete Toggle */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Allow Entry Deletion</p>
                  <p className="text-[11px] text-neutral-400">Enable removing entry records</p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('allow_delete')}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  settings.allow_delete ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
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
