import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { searchPersons } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import { ArrowLeft, Search, ChevronRight, UserSearch } from 'lucide-react'

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
    <div className="min-h-screen bg-gray-50 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search by name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <LoadingSpinner message="Searching..." />
        ) : !searched ? (
          <div className="text-center py-16">
            <UserSearch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Type a name to search</p>
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={UserSearch}
            title="No results found"
            message={`No person found matching "${query}"`}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">{results.length} result(s)</p>
            {results.map((person) => {
              const cat = CATEGORIES[person.category]
              return (
                <button
                  key={person.id}
                  onClick={() => navigate(`/person/${person.id}`)}
                  className="card-hover w-full bg-white rounded-2xl p-4 flex items-center gap-3 border border-gray-100 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  <div className={`w-11 h-11 rounded-xl ${cat?.color || 'bg-gray-400'} flex items-center justify-center shrink-0`}>
                    <span className="text-white font-bold text-lg">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{person.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{cat?.name || person.category}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
