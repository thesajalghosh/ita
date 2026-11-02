import { useState, useEffect } from 'react'
import { subscribeDbStatus, checkDatabaseSchema, syncLocalDataToSupabase } from '../lib/api'
import { SUPABASE_SCHEMA_SQL } from '../lib/schemaSql'
import { toast } from './Toast'
import { Database, Copy, Check, ExternalLink, X, RefreshCw, AlertCircle } from 'lucide-react'

export default function DatabaseNotice() {
  const [tablesMissing, setTablesMissing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    checkDatabaseSchema()
    const unsub = subscribeDbStatus((missing) => {
      setTablesMissing(missing)
    })
    return unsub
  }, [])

  if (!tablesMissing || dismissed) return null

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL)
      setCopied(true)
      toast('SQL script copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast('Could not copy automatically. Open Setup Guide.', 'warning')
      setShowModal(true)
    }
  }

  const handleTestAndSync = async () => {
    setSyncing(true)
    const res = await syncLocalDataToSupabase()
    if (res.success) {
      toast(res.message, 'success')
      setTablesMissing(false)
    } else {
      toast(res.message, 'info')
    }
    setSyncing(false)
  }

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200/80 px-3.5 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-2 z-40 relative">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="truncate font-medium">
            Running in <span className="font-semibold underline">Local Mode</span> (Supabase tables pending)
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopySql}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy SQL'}</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-2 py-1 rounded-lg bg-amber-200/60 hover:bg-amber-200 text-amber-900 font-medium text-[11px]"
          >
            Guide
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-amber-600 hover:text-amber-800 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Database className="w-4 h-4 text-amber-700" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Setup Supabase Database</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Your app is currently saving all your records <strong>locally in this browser</strong> without losing anything. To sync with Supabase cloud database, run the SQL script once:
            </p>

            <div className="space-y-3 mb-5">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-xs">
                <span className="font-bold text-gray-800 block mb-1">Step 1 — Copy the SQL Script</span>
                <button
                  onClick={handleCopySql}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary-600 text-white font-medium text-xs shadow-sm hover:bg-primary-700 active:scale-[0.98] transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'SQL Copied to Clipboard!' : 'Copy SQL Schema Script'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-xs">
                <span className="font-bold text-gray-800 block mb-1">Step 2 — Open Supabase SQL Editor</span>
                <a
                  href="https://supabase.com/dashboard/project/akehudqkkpddhyzhtojj/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-900 text-white font-medium text-xs hover:bg-black transition-colors"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-xs">
                <span className="font-bold text-gray-800 block mb-1">Step 3 — Paste & Click "Run"</span>
                <p className="text-gray-500">
                  Paste the copied script in the SQL editor query box and hit the green <strong>Run</strong> button.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTestAndSync}
                disabled={syncing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Checking...' : 'Check & Sync to Supabase'}</span>
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
