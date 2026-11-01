import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { createPerson, createDefaultCalculations } from '../lib/api'
import { toast } from '../components/Toast'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'

export default function AddPersonPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultCategory = searchParams.get('category') || ''

  const [name, setName] = useState('')
  const [category, setCategory] = useState(defaultCategory)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    if (!name.trim()) {
      toast('Please enter name', 'warning')
      return
    }
    if (!category) {
      toast('Please select a category', 'warning')
      return
    }

    setLoading(true)
    try {
      const { data: person, error } = await createPerson({
        name: name.trim(),
        category,
        phone: phone.trim() || null,
        address: address.trim() || null,
      })

      if (error) throw error

      // Create default calculations for this category
      await createDefaultCalculations(person.id, category)

      toast(`${name} added successfully`, 'success')
      navigate(`/person/${person.id}`)
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Add New Person</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter person's name"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(CATEGORIES).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`p-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                  category === cat.id
                    ? `${cat.colorBorder} ${cat.colorLight} ${cat.colorText}`
                    : 'border-gray-100 bg-white text-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (optional)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (optional)"
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-primary-200"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              Save Person
            </>
          )}
        </button>
      </form>
    </div>
  )
}
