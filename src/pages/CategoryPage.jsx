import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { getPersonsByCategory } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import {
  ArrowLeft,
  Search,
  Plus,
  ChevronRight,
  Users,
  UserPlus,
  Phone,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  Clock,
  X,
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

export default function CategoryPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [rawPersons, setRawPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name_asc') // 'name_asc', 'name_desc', 'date_desc', 'date_asc'

  const category = CATEGORIES[categoryId]
  const IconComponent = category ? ICON_MAP[category.icon] || Users : Users

  useEffect(() => {
    loadPersons()
  }, [categoryId])

  async function loadPersons() {
    setLoading(true)
    const { data } = await getPersonsByCategory(categoryId)
    if (data) {
      setRawPersons(data)
    }
    setLoading(false)
  }

  // Filter and sort persons cleanly
  const displayedPersons = useMemo(() => {
    let list = [...rawPersons]

    // 1. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.phone && p.phone.includes(q))
      )
    }

    // 2. Sort Logic (Handles all sort cases accurately)
    list.sort((a, b) => {
      const nameA = (a.name || '').trim().toLowerCase()
      const nameB = (b.name || '').trim().toLowerCase()
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()

      switch (sortBy) {
        case 'name_asc':
          return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
        case 'name_desc':
          return nameB.localeCompare(nameA, 'en', { sensitivity: 'base' })
        case 'date_asc':
          return dateA - dateB
        case 'date_desc':
        default:
          return dateB - dateA
      }
    })

    return list
  }, [rawPersons, searchQuery, sortBy])

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-neutral-500 mb-3">Category not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const sortOptions = [
    { id: 'name_asc', label: 'A→Z', icon: ArrowDownAZ },
    { id: 'name_desc', label: 'Z→A', icon: ArrowUpAZ },
    { id: 'date_desc', label: 'New', icon: Clock },
    { id: 'date_asc', label: 'Old', icon: ArrowUpDown },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100/50 safe-area-top safe-area-bottom pb-12">
      {/* ─── Top Bar ─── */}
      <div className="glass border-b border-neutral-200/60 px-3 pt-3 pb-2.5 sticky top-0 z-20 shadow-card space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center text-neutral-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${category.color} text-white flex items-center justify-center shadow-sm`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-neutral-900 tracking-tight">
                  {category.name}
                </h1>
                <p className="text-[10px] text-neutral-400 font-medium">
                  {rawPersons.length} {rawPersons.length === 1 ? 'person' : 'persons'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/add-person?category=${categoryId}`)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-8.5 pr-8 py-2 rounded-xl bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200/80 transition-all"
            style={{ paddingLeft: '2rem' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-neutral-200/80 flex items-center justify-center text-neutral-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Sort Pills */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Sort:</span>
          <div className="flex items-center gap-0.5 bg-neutral-100/60 p-0.5 rounded-lg border border-neutral-200/50">
            {sortOptions.map((opt) => {
              const active = sortBy === opt.id
              const Icon = opt.icon
              return (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    active
                      ? 'bg-white text-neutral-900 shadow-sm font-bold'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="px-3 mt-3 max-w-lg mx-auto">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Loading persons..." />
          </div>
        ) : displayedPersons.length === 0 ? (
          rawPersons.length === 0 ? (
            <EmptyState
              icon={Users}
              title={`No persons in ${category.name}`}
              message="Add workers, buyers or parties to start tracking their daily hisab."
              action={
                <button
                  onClick={() => navigate(`/add-person?category=${categoryId}`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add First Person</span>
                </button>
              }
            />
          ) : (
            <div className="text-center py-16">
              <p className="text-sm font-medium text-neutral-600 mb-1">No persons match your search</p>
              <p className="text-xs text-neutral-400 mb-4">Try a different name or number</p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-medium hover:bg-neutral-200 transition-all"
              >
                Clear Search
              </button>
            </div>
          )
        ) : (
          <div className="space-y-1.5">
            {displayedPersons.map((person) => (
              <button
                key={person.id}
                onClick={() => navigate(`/person/${person.id}`)}
                className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-neutral-200/60 hover:border-neutral-300 shadow-card hover:shadow-soft text-left active:scale-[0.985] transition-all group"
              >
                {/* Monogram */}
                <div
                  className={`w-10 h-10 rounded-xl ${category.color} text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-sm`}
                >
                  {person.name ? person.name.charAt(0).toUpperCase() : '?'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-neutral-900 text-[13px] truncate tracking-tight group-hover:text-neutral-950">
                    {person.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {person.phone ? (
                      <span className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                        <Phone className="w-2.5 h-2.5 text-neutral-400" />
                        {person.phone}
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400">No phone</span>
                    )}

                    {person.id?.startsWith('local_') && (
                      <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/50 font-medium">
                        Local
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
