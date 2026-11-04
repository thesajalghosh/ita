import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { searchPersons } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import { ArrowLeft, Search, ChevronRight, UserSearch, X, Phone } from 'lucide-react'

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery)
    }
  }, [])

  async function handleSearch(q) {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    const { data } = await searchPersons(q.trim())
    setResults(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100/50 safe-area-top safe-area-bottom pb-12">
      {/* Header */}
      <div className="glass border-b border-neutral-200/60 px-3 py-2.5 flex items-center gap-2 sticky top-0 z-20 shadow-card">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center shrink-0 text-neutral-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search person across all categories..."
            className="w-full pl-8 pr-8 py-2 rounded-xl bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200/80 transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setResults([])
                setSearched(false)
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-neutral-200/80 flex items-center justify-center text-neutral-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-3 max-w-lg mx-auto">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Searching records..." />
          </div>
        ) : !searched ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3 text-neutral-400">
              <UserSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-neutral-600 mb-1">Search by Name or Phone</p>
            <p className="text-xs text-neutral-400">Press enter to look up any worker or dealer</p>
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={UserSearch}
            title="No persons found"
            message={`No accounts matching "${query}". Check spelling or create a new person.`}
          />
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 px-0.5">
              Found {results.length} {results.length === 1 ? 'person' : 'persons'}
            </p>

            {results.map((person) => {
              const cat = CATEGORIES[person.category]
              return (
                <button
                  key={person.id}
                  onClick={() => navigate(`/category/${person.category || 'labour'}/person/${person.id}`)}
                  className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-neutral-200/60 hover:border-neutral-300 shadow-card text-left active:scale-[0.985] transition-all group"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${
                      cat?.color || 'bg-neutral-800'
                    } text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-sm`}
                  >
                    {person.name ? person.name.charAt(0).toUpperCase() : '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-[13px] truncate tracking-tight">
                      {person.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">
                        {cat?.name || person.category}
                      </span>
                      {person.phone && (
                        <span className="text-[9px] text-neutral-400 font-mono flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {person.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
