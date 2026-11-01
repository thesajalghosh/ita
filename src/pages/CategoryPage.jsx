import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { getPersonsByCategory, searchPersons } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import { ArrowLeft, Search, Plus, ChevronRight, Users, UserPlus } from 'lucide-react'

export default function CategoryPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const category = CATEGORIES[categoryId]

  useEffect(() => {
    loadPersons()
  }, [categoryId])

  async function loadPersons() {
    setLoading(true)
    const { data } = await getPersonsByCategory(categoryId)
    if (data) setPersons(data)
    setLoading(false)
  }

  async function handleSearch(query) {
    setSearchQuery(query)
    if (!query.trim()) {
      loadPersons()
      return
    }
    const { data } = await searchPersons(query, categoryId)
    if (data) setPersons(data)
  }

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Category not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className={`bg-gradient-to-br from-primary-800 to-primary-900 px-4 pt-4 pb-6 rounded-b-3xl`}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{category.name}</h1>
            <p className="text-xs text-primary-200">{persons.length} persons</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 shadow-lg"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {/* Add Person Button */}
        <button
          onClick={() => navigate(`/add-person?category=${categoryId}`)}
          className="w-full flex items-center justify-center gap-2 py-3.5 mb-4 rounded-2xl bg-primary-600 text-white font-semibold text-sm shadow-lg shadow-primary-200 active:scale-[0.98] transition-transform"
        >
          <UserPlus className="w-5 h-5" />
          Add New Person
        </button>

        {loading ? (
          <LoadingSpinner />
        ) : persons.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No persons found"
            message="No persons have been added to this category yet"
            action={
              <button
                onClick={() => navigate(`/add-person?category=${categoryId}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Person
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {persons.map((person) => (
              <button
                key={person.id}
                onClick={() => navigate(`/person/${person.id}`)}
                className="card-hover w-full bg-white rounded-2xl p-4 flex items-center gap-3 border border-gray-100 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                <div className={`w-11 h-11 rounded-xl ${category.color} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-lg">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{person.name}</h3>
                  {person.phone && (
                    <p className="text-xs text-gray-400 mt-0.5">{person.phone}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
