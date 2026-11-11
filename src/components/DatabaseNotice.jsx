import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { checkDatabaseSchema, subscribeDbStatus } from '../lib/api'

export default function DatabaseNotice() {
  const [unavailable, setUnavailable] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => subscribeDbStatus(setUnavailable), [])

  const handleRetry = async () => {
    setChecking(true)
    const result = await checkDatabaseSchema()
    setUnavailable(!result.ready)
    setChecking(false)
  }

  if (!unavailable) return null

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm"
    >
      <span className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Database unavailable. Business data is only shown from Supabase; local device data is not used.</span>
      </span>
      <button
        type="button"
        onClick={handleRetry}
        disabled={checking}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-semibold shadow-sm disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
        Retry
      </button>
    </div>
  )
}
