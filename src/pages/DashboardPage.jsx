import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CATEGORIES, formatCurrency, formatDate } from '../lib/constants'
import { getCategoryStats, getRecentEntries, getAllPersons } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  HardHat,
  Package,
  Flame,
  Truck,
  UserCheck,
  Pickaxe,
  Settings,
  LogOut,
  Search,
  Plus,
  TrendingUp,
  Clock,
  Users,
  ChevronRight,
  Building2,
  UserPlus,
  LayoutGrid,
} from 'lucide-react'

const ICON_MAP = {
  HardHat,
  Package,
  Flame,
  Truck,
  UserCheck,
  Pickaxe,
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [recentEntries, setRecentEntries] = useState([])
  const [totalPersons, setTotalPersons] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    const [statsRes, recentRes, personsRes] = await Promise.all([
      getCategoryStats(),
      getRecentEntries(6),
      getAllPersons(),
    ])
    if (statsRes.data) setStats(statsRes.data)
    if (recentRes.data) setRecentEntries(recentRes.data)
    if (personsRes.data) setTotalPersons(personsRes.data.length)
    setLoading(false)
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Loading accounts..." />
      </div>
    )
  }

  const categories = Object.values(CATEGORIES)

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100/50 safe-area-top safe-area-bottom pb-12">
      {/* ─── Top Header ─── */}
      <div className="glass border-b border-neutral-200/60 px-4 pt-4 pb-4 sticky top-0 z-20 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5 text-neutral-100" />
            </div>
            <div>
              <h1 className="text-base font-bold text-neutral-900 tracking-tight leading-tight">
                Brick Kiln Hisab
              </h1>
              <p className="text-xs text-neutral-500 font-medium">Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center text-neutral-600"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={signOut}
              className="w-10 h-10 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center text-neutral-600"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault()
            handleSearch()
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by person name or phone..."
            aria-label="Search people by name or phone"
            className="w-full pl-10 pr-12 py-3 rounded-xl bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200/80 transition-all"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-500"
          >
            Search
          </button>
        </form>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-7">
        {/* ─── Stats Row ─── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-3 border border-neutral-200/60 shadow-card">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Persons</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="w-3 h-3 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-neutral-900">{totalPersons}</p>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-neutral-200/60 shadow-card">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Categories</span>
              <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                <LayoutGrid className="w-3 h-3 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-neutral-900">{categories.length}</p>
          </div>
        </div>

        {/* ─── Categories Grid ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-bold text-neutral-600 uppercase tracking-wider">
              Account Categories
            </h2>
            <span className="text-xs text-neutral-500 font-medium">{categories.length} sections</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => {
              const IconComponent = ICON_MAP[cat.icon] || HardHat
              const count = stats[cat.id]?.personCount || 0
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/category/${cat.id}`)}
                  className="bg-white rounded-2xl p-4 text-left border border-neutral-200/60 hover:border-neutral-300 shadow-card hover:shadow-soft active:scale-[0.98] transition-all group focus-visible:outline-2 focus-visible:outline-emerald-600"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`w-11 h-11 rounded-xl ${cat.color} text-white flex items-center justify-center shadow-sm`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm truncate tracking-tight mb-1">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium">
                      {count} {count === 1 ? 'person' : 'persons'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Recent Transactions ─── */}
        {recentEntries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-bold text-neutral-600 uppercase tracking-wider">
                Recent Transactions
              </h2>
              <span className="text-xs text-neutral-500 font-medium">Latest activity</span>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-card divide-y divide-neutral-100 overflow-hidden">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => {
                    if (!entry.person_id) return
                    const cat = entry.persons?.category
                    if (cat) {
                      navigate(`/category/${cat}/person/${entry.person_id}`)
                    } else {
                      navigate(`/person/${entry.person_id}`)
                    }
                  }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate">
                        {entry.persons?.name || 'Unnamed Person'}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        {entry.calculations?.name} · {formatDate(entry.entry_date)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    {entry.amount ? (
                      <span className="text-xs font-bold text-neutral-900 font-mono">
                        {formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-neutral-900 font-mono">
                        {Number(entry.quantity).toLocaleString('en-IN')} pcs
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
