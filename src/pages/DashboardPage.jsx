import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CATEGORIES, formatCurrency, formatDate } from '../lib/constants'
import { getCategoryStats, getRecentEntries, getAllPersons } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  HardHat, Package, Flame, Truck, UserCheck, Pickaxe,
  Settings, LogOut, Search, Plus, TrendingUp,
  Clock, Users, ChevronRight, Building2
} from 'lucide-react'

const ICON_MAP = {
  HardHat, Package, Flame, Truck, UserCheck, Pickaxe,
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
      getRecentEntries(8),
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

  if (loading) return <LoadingSpinner message="Loading dashboard..." />

  const categories = Object.values(CATEGORIES)

  return (
    <div className="min-h-screen bg-gray-50 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 px-4 pt-4 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Brick Kiln Hisab</h1>
              <p className="text-xs text-primary-200">Brick Kiln Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={signOut}
              className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white/15 backdrop-blur rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary-200" />
              <span className="text-xs text-primary-200">Total Persons</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalPersons}</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary-200" />
              <span className="text-xs text-primary-200">Categories</span>
            </div>
            <p className="text-2xl font-bold text-white">{categories.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 shadow-lg"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-2">
        {/* Quick Add */}
        <button
          onClick={() => navigate('/add-person')}
          className="w-full flex items-center justify-center gap-2 py-3.5 mb-5 rounded-2xl bg-primary-600 text-white font-semibold text-sm shadow-lg shadow-primary-200 active:scale-[0.98] transition-transform"
        >
          <Plus className="w-5 h-5" />
          Add New Person
        </button>

        {/* Categories */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Account Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => {
              const IconComponent = ICON_MAP[cat.icon] || HardHat
              const count = stats[cat.id]?.personCount || 0
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/category/${cat.id}`)}
                  className="card-hover bg-white rounded-2xl p-4 text-left border border-gray-100 shadow-sm active:scale-[0.97] transition-transform"
                >
                  <div className={`w-11 h-11 rounded-xl ${cat.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{cat.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{count} persons</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        {recentEntries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Transactions</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {recentEntries.slice(0, 5).map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{entry.persons?.name}</p>
                      <p className="text-xs text-gray-400">{entry.calculations?.name} · {formatDate(entry.entry_date)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {entry.amount ? (
                      <span className={`text-sm font-semibold ${Number(entry.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-gray-700">
                        {Number(entry.quantity).toLocaleString('en-IN')}
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
