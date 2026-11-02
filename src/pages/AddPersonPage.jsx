import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { createPerson, createDefaultCalculations } from '../lib/api'
import { toast } from '../components/Toast'
import {
  ArrowLeft,
  Loader2,
  User,
  Phone,
  HardHat,
  Package,
  Flame,
  Truck,
  UserCheck,
  Pickaxe,
} from 'lucide-react'

const ICON_MAP = {
  HardHat,
  Package,
  Flame,
  Truck,
  UserCheck,
  Pickaxe,
}

export default function AddPersonPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categoryParam = searchParams.get('category') || 'labour'
  const currentCategory = CATEGORIES[categoryParam] || CATEGORIES.labour
  const IconComp = ICON_MAP[currentCategory.icon] || User

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    if (!name.trim()) {
      toast('Please enter person name', 'warning')
      return
    }

    setLoading(true)
    try {
      const { data: person, error, localFallback } = await createPerson({
        name: name.trim(),
        category: currentCategory.id,
        phone: phone.trim() || null,
      })

      if (error) throw error

      // Create default calculation sections for this category
      if (person?.id) {
        await createDefaultCalculations(person.id, currentCategory.id)
      }

      if (localFallback) {
        toast(`${name} added to ${currentCategory.name} (saved locally)`, 'success')
      } else {
        toast(`${name} added to ${currentCategory.name}`, 'success')
      }

      navigate(`/person/${person.id}`, { replace: true })
    } catch (err) {
      toast('Error: ' + (err.message || 'Could not save person'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50/70 safe-area-top safe-area-bottom pb-10">
      {/* Minimal Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-neutral-200/70 px-4 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            type="button"
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 active:scale-95 transition-all flex items-center justify-center text-neutral-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-neutral-900 tracking-tight">Add Person</h1>
            <p className="text-[11px] text-neutral-400">Add account to {currentCategory.name}</p>
          </div>
        </div>

        {/* Category Pill Tag */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 border border-neutral-200/60">
          <div className={`w-4 h-4 rounded-md ${currentCategory.color} text-white flex items-center justify-center`}>
            <IconComp className="w-2.5 h-2.5" />
          </div>
          <span className="text-xs font-semibold text-neutral-700">{currentCategory.name}</span>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="px-4 py-6 max-w-lg mx-auto space-y-4">
        {/* Destination Category Info Banner */}
        <div className="bg-white rounded-2xl p-3.5 border border-neutral-200/70 shadow-2xs flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${currentCategory.color} text-white flex items-center justify-center shrink-0 shadow-2xs`}>
            <IconComp className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Destination Category
            </span>
            <p className="text-sm font-bold text-neutral-900 truncate">
              {currentCategory.name}
            </p>
          </div>
        </div>

        {/* Name input */}
        <div className="bg-white rounded-2xl p-4 border border-neutral-200/70 shadow-sm space-y-1.5">
          <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider block">
            Person Name *
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahim Ali, Brick Buyer"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-50/80 border border-neutral-200 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              autoFocus
              required
            />
          </div>
        </div>

        {/* Phone input (optional) */}
        <div className="bg-white rounded-2xl p-4 border border-neutral-200/70 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider block">
              Phone Number
            </label>
            <span className="text-[11px] text-neutral-400">Optional</span>
          </div>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-50/80 border border-neutral-200 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3.5 rounded-2xl bg-neutral-900 hover:bg-black text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
              <span>Saving Account...</span>
            </>
          ) : (
            <span>Save to {currentCategory.name}</span>
          )}
        </button>
      </form>
    </div>
  )
}
