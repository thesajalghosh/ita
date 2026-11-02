import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CATEGORIES,
  TRANSACTION_TYPES,
  formatNumber,
  formatCurrency,
  formatDate,
  getBalanceStatus,
  getTodayDate,
  CALC_TYPE_LABELS,
} from '../lib/constants'
import {
  getPersonById,
  getCalculationsByPerson,
  getEntriesByCalculation,
  getPersonFinancialSummary,
  getPersonQuantitySummary,
  createCalculation,
  createEntry,
  updateEntry,
  softDeleteEntry,
  generateCSV,
  getEntriesByPerson,
} from '../lib/api'
import { useSettings } from '../contexts/SettingsContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { toast } from '../components/Toast'
import {
  ArrowLeft,
  Plus,
  X,
  Calendar,
  Hash,
  DollarSign,
  Download,
  Pencil,
  Trash2,
  Clock,
  ArrowUpDown,
  Phone,
} from 'lucide-react'

export default function PersonPage() {
  const { personId } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()

  const [person, setPerson] = useState(null)
  const [calculations, setCalculations] = useState([])
  const [entriesMap, setEntriesMap] = useState({})
  const [financialSummary, setFinancialSummary] = useState(null)
  const [quantitySummary, setQuantitySummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [entrySortOrder, setEntrySortOrder] = useState('newest') // 'newest' | 'oldest'

  // Modals
  const [showAddCalc, setShowAddCalc] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(null)
  const [showEditEntry, setShowEditEntry] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Add Calculation form
  const [calcName, setCalcName] = useState('')
  const [calcType, setCalcType] = useState('quantity')

  // Add/Edit Entry form
  const [entryDate, setEntryDate] = useState(getTodayDate())
  const [entryQuantity, setEntryQuantity] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryTxType, setEntryTxType] = useState('i_will_receive')
  const [entryDescription, setEntryDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: p } = await getPersonById(personId)
    if (!p) {
      setLoading(false)
      return
    }
    setPerson(p)

    const { data: calcs } = await getCalculationsByPerson(personId)
    setCalculations(calcs || [])

    // Load entries for each calculation
    const eMap = {}
    if (calcs && calcs.length > 0) {
      await Promise.all(
        calcs.map(async (c) => {
          const { data: entries } = await getEntriesByCalculation(c.id)
          eMap[c.id] = entries || []
        })
      )
    }
    setEntriesMap(eMap)

    // Load financial summary
    const { data: finData } = await getPersonFinancialSummary(personId)
    if (finData && finData.length > 0) setFinancialSummary(finData[0])

    // Load quantity summary
    const { data: qtyData } = await getPersonQuantitySummary(personId)
    if (qtyData) setQuantitySummary(qtyData)

    setLoading(false)
  }, [personId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const category = person ? CATEGORIES[person.category] : null

  // Handle add calculation
  const handleAddCalculation = async () => {
    if (!calcName.trim()) {
      toast('Please enter column name', 'warning')
      return
    }
    setSaving(true)
    try {
      const { error } = await createCalculation({
        person_id: personId,
        name: calcName.trim(),
        calc_type: calcType,
        sort_order: calculations.length,
      })
      if (error) throw error
      toast('New column added', 'success')
      setShowAddCalc(false)
      setCalcName('')
      setCalcType('quantity')
      await loadData()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle add entry
  const handleAddEntry = async () => {
    if (!showAddEntry) return
    const calc = showAddEntry

    if (calc.calc_type === 'quantity' && !entryQuantity) {
      toast('Please enter quantity', 'warning')
      return
    }
    if (calc.calc_type === 'money' && !entryAmount) {
      toast('Please enter amount', 'warning')
      return
    }

    setSaving(true)
    try {
      const entryData = {
        calculation_id: calc.id,
        person_id: personId,
        entry_date: entryDate,
        description: entryDescription.trim() || null,
      }

      if (calc.calc_type === 'quantity') {
        entryData.quantity = Number(entryQuantity)
      } else {
        entryData.amount = Number(entryAmount)
        entryData.transaction_type = entryTxType
      }

      const { error } = await createEntry(entryData)
      if (error) throw error

      toast('Entry saved successfully', 'success')
      setShowAddEntry(null)
      resetEntryForm()
      await loadData()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle edit entry
  const handleEditEntry = async () => {
    if (!showEditEntry) return
    const entry = showEditEntry

    setSaving(true)
    try {
      const updates = {
        entry_date: entryDate,
        description: entryDescription.trim() || null,
      }

      const calc = calculations.find((c) => c.id === entry.calculation_id)
      if (calc?.calc_type === 'quantity') {
        updates.quantity = Number(entryQuantity)
      } else {
        updates.amount = Number(entryAmount)
        updates.transaction_type = entryTxType
      }

      const { error } = await updateEntry(entry.id, updates)
      if (error) throw error

      toast('Entry updated', 'success')
      setShowEditEntry(null)
      resetEntryForm()
      await loadData()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle delete entry
  const handleDeleteEntry = async () => {
    if (!showDeleteConfirm) return
    try {
      const { error } = await softDeleteEntry(showDeleteConfirm.id)
      if (error) throw error
      toast('Entry deleted', 'success')
      setShowDeleteConfirm(null)
      await loadData()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    }
  }

  const resetEntryForm = () => {
    setEntryDate(getTodayDate())
    setEntryQuantity('')
    setEntryAmount('')
    setEntryTxType('i_will_receive')
    setEntryDescription('')
  }

  const openEditEntry = (entry) => {
    if (!settings.allow_edit) {
      toast('Enable editing permission from Settings first.', 'warning')
      return
    }
    setEntryDate(entry.entry_date)
    setEntryQuantity(entry.quantity ? String(entry.quantity) : '')
    setEntryAmount(entry.amount ? String(entry.amount) : '')
    setEntryTxType(entry.transaction_type || 'i_will_receive')
    setEntryDescription(entry.description || '')
    setShowEditEntry(entry)
  }

  // CSV Export
  const handleExport = async () => {
    const { data: allEntries } = await getEntriesByPerson(personId)
    if (!allEntries || allEntries.length === 0) {
      toast('No data available to export', 'warning')
      return
    }
    const csv = generateCSV(allEntries, person.name)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${person.name}_hisab.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('CSV downloaded successfully', 'success')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Loading account..." />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-neutral-500 mb-3">Person not found</p>
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

  const balanceStatus = financialSummary ? getBalanceStatus(financialSummary.net_balance) : null

  return (
    <div className="min-h-screen bg-neutral-50/70 safe-area-top safe-area-bottom pb-24">
      {/* Minimalist Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-neutral-200/70 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 active:scale-95 transition-all flex items-center justify-center text-neutral-700 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-neutral-900 tracking-tight truncate">
                  {person.name}
                </h1>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/60 shrink-0">
                  {category?.name}
                </span>
              </div>
              {person.phone && (
                <p className="text-[11px] text-neutral-400 font-mono flex items-center gap-1 mt-0.5">
                  <Phone className="w-2.5 h-2.5" />
                  {person.phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExport}
              title="Download CSV"
              className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 active:scale-95 transition-all flex items-center justify-center text-neutral-700"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Financial Summary Card */}
        {financialSummary && (
          <div className="bg-white rounded-2xl p-4 border border-neutral-200/70 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                Net Balance
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${balanceStatus?.border} ${balanceStatus?.bg} ${balanceStatus?.color}`}
              >
                {balanceStatus?.label}
              </span>
            </div>

            <p className={`text-2xl font-bold tracking-tight ${balanceStatus?.color}`}>
              {formatCurrency(Math.abs(financialSummary.net_balance))}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-neutral-100">
              <div className="p-2 rounded-xl bg-emerald-50/50 border border-emerald-100/60">
                <span className="text-[10px] text-neutral-500 block">Receivable</span>
                <p className="font-bold text-emerald-700 text-xs">
                  {formatCurrency(financialSummary.total_receivable)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-blue-50/50 border border-blue-100/60">
                <span className="text-[10px] text-neutral-500 block">Received</span>
                <p className="font-bold text-blue-700 text-xs">
                  {formatCurrency(financialSummary.total_received)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/50 border border-rose-100/60">
                <span className="text-[10px] text-neutral-500 block">Payable</span>
                <p className="font-bold text-rose-700 text-xs">
                  {formatCurrency(financialSummary.total_payable)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/50 border border-amber-100/60">
                <span className="text-[10px] text-neutral-500 block">Paid</span>
                <p className="font-bold text-amber-700 text-xs">
                  {formatCurrency(financialSummary.total_paid)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quantity Summaries */}
        {Object.keys(quantitySummary).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {Object.entries(quantitySummary).map(([name, total]) => (
              <div
                key={name}
                className="bg-white rounded-xl px-3 py-2 border border-neutral-200/70 shadow-2xs shrink-0 flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">{name}</span>
                  <span className="text-xs font-bold text-neutral-900">{formatNumber(total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calculations Section Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              Calculation Columns
            </h2>
            <span className="text-[11px] text-neutral-400">({calculations.length})</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sort order toggle for timeline entries */}
            <button
              onClick={() => setEntrySortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 text-neutral-600 text-[11px] font-medium transition-colors"
              title="Toggle entry sorting order"
            >
              <ArrowUpDown className="w-3 h-3 text-neutral-500" />
              <span>{entrySortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
            </button>

            <button
              onClick={() => setShowAddCalc(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-black text-white text-[11px] font-medium shadow-2xs active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3" />
              <span>Column</span>
            </button>
          </div>
        </div>

        {/* Calculation Columns - Horizontally Scrollable Cards */}
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 scrollbar-none">
          {calculations.map((calc) => {
            const rawEntries = entriesMap[calc.id] || []
            const entries = [...rawEntries].sort((a, b) => {
              const dateA = new Date(a.entry_date).getTime()
              const dateB = new Date(b.entry_date).getTime()
              return entrySortOrder === 'newest' ? dateB - dateA : dateA - dateB
            })

            const total =
              calc.calc_type === 'quantity'
                ? entries.reduce((s, e) => s + (Number(e.quantity) || 0), 0)
                : entries.reduce((s, e) => {
                    const amt = Number(e.amount) || 0
                    if (e.transaction_type === 'i_will_receive' || e.transaction_type === 'i_paid_them')
                      return s + amt
                    return s - amt
                  }, 0)

            return (
              <div
                key={calc.id}
                className="min-w-[170px] w-[50vw] max-w-[210px] shrink-0 snap-start flex flex-col"
              >
                {/* Column Card Header */}
                <div
                  className={`rounded-2xl p-3 mb-2.5 border transition-all ${
                    calc.calc_type === 'money'
                      ? 'bg-blue-50/70 border-blue-200/70'
                      : 'bg-amber-50/70 border-amber-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-xs font-bold text-neutral-900 truncate">{calc.name}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                      {calc.calc_type === 'money' ? '₹' : '#'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-sm font-extrabold ${
                        calc.calc_type === 'money' ? 'text-blue-700' : 'text-amber-800'
                      }`}
                    >
                      {calc.calc_type === 'money' ? formatCurrency(total) : formatNumber(total)}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                </div>

                {/* Add Entry Quick Trigger */}
                <button
                  onClick={() => {
                    resetEntryForm()
                    setShowAddEntry(calc)
                  }}
                  className={`w-full py-2 mb-2 rounded-xl border border-dashed flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-all ${
                    calc.calc_type === 'money'
                      ? 'border-blue-300 text-blue-700 bg-white hover:bg-blue-50/60'
                      : 'border-amber-300 text-amber-700 bg-white hover:bg-amber-50/60'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Entry</span>
                </button>

                {/* Entries Timeline List */}
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[50vh] pr-0.5">
                  {entries.length === 0 ? (
                    <div className="text-center py-6 px-2 bg-white rounded-xl border border-neutral-100">
                      <p className="text-[11px] text-neutral-400">No entries yet</p>
                    </div>
                  ) : (
                    entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white rounded-xl p-2.5 border border-neutral-200/70 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {formatDate(entry.entry_date)}
                          </span>
                          {(settings.allow_edit || settings.allow_delete) && (
                            <div className="flex items-center gap-1">
                              {settings.allow_edit && (
                                <button
                                  onClick={() => openEditEntry(entry)}
                                  className="p-1 rounded text-neutral-400 hover:text-neutral-700"
                                >
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                              )}
                              {settings.allow_delete && (
                                <button
                                  onClick={() => setShowDeleteConfirm(entry)}
                                  className="p-1 rounded text-neutral-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {calc.calc_type === 'quantity' ? (
                          <p className="text-sm font-bold text-neutral-900">
                            {formatNumber(entry.quantity)}
                          </p>
                        ) : (
                          <div>
                            <p
                              className={`text-sm font-bold ${
                                TRANSACTION_TYPES[entry.transaction_type]?.color || 'text-neutral-900'
                              }`}
                            >
                              {formatCurrency(entry.amount)}
                            </p>
                            <span
                              className={`text-[9px] font-semibold block ${
                                TRANSACTION_TYPES[entry.transaction_type]?.color || 'text-neutral-400'
                              }`}
                            >
                              {TRANSACTION_TYPES[entry.transaction_type]?.label}
                            </span>
                          </div>
                        )}

                        {entry.description && (
                          <p className="text-[10px] text-neutral-500 truncate pt-0.5 border-t border-neutral-100">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {calculations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200/70 p-6">
            <p className="text-sm font-medium text-neutral-500 mb-3">No calculation columns yet</p>
            <button
              onClick={() => setShowAddCalc(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Column</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Calculation Modal */}
      {showAddCalc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowAddCalc(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">New Column</h3>
              <button
                onClick={() => setShowAddCalc(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                Column Name *
              </label>
              <input
                type="text"
                value={calcName}
                onChange={(e) => setCalcName(e.target.value)}
                placeholder="e.g. Brick Lifting, Money Account"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-200"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                Column Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalcType('quantity')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    calcType === 'quantity'
                      ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold'
                      : 'border-neutral-200 bg-white text-neutral-600'
                  }`}
                >
                  <Hash className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                  <span className="text-xs">Quantity (Pcs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcType('money')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    calcType === 'money'
                      ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-bold'
                      : 'border-neutral-200 bg-white text-neutral-600'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                  <span className="text-xs">Money (₹ Cash)</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleAddCalculation}
              disabled={saving || !calcName.trim()}
              className="w-full py-3 rounded-xl bg-neutral-900 text-white font-medium text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'Creating Column...' : 'Save Column'}
            </button>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowAddEntry(null)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Add Entry</h3>
                <p className="text-xs text-neutral-400">{showAddEntry.name}</p>
              </div>
              <button
                onClick={() => setShowAddEntry(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
              />
            </div>

            {showAddEntry.calc_type === 'money' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(TRANSACTION_TYPES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEntryTxType(key)}
                      className={`p-2 rounded-lg border text-center text-[11px] font-medium transition-all ${
                        entryTxType === key
                          ? `${val.border} ${val.bg} ${val.color} font-bold ring-1 ring-neutral-300`
                          : 'border-neutral-200 bg-white text-neutral-600'
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showAddEntry.calc_type === 'quantity' ? (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={entryQuantity}
                  onChange={(e) => setEntryQuantity(e.target.value)}
                  placeholder="Enter brick count"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="₹ Amount"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder="Remarks or memo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
              />
            </div>

            <button
              onClick={handleAddEntry}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-neutral-900 text-white font-medium text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {showEditEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => {
              setShowEditEntry(null)
              resetEntryForm()
            }}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Edit Entry</h3>
              <button
                onClick={() => {
                  setShowEditEntry(null)
                  resetEntryForm()
                }}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
              />
            </div>

            {(() => {
              const calc = calculations.find((c) => c.id === showEditEntry.calculation_id)
              if (calc?.calc_type === 'money') {
                return (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                        Transaction Type
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(TRANSACTION_TYPES).map(([key, val]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEntryTxType(key)}
                            className={`p-2 rounded-lg border text-center text-[11px] font-medium transition-all ${
                              entryTxType === key
                                ? `${val.border} ${val.bg} ${val.color} font-bold ring-1 ring-neutral-300`
                                : 'border-neutral-200 bg-white text-neutral-600'
                            }`}
                          >
                            {val.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
                        inputMode="numeric"
                      />
                    </div>
                  </>
                )
              }
              return (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={entryQuantity}
                    onChange={(e) => setEntryQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
                    inputMode="numeric"
                  />
                </div>
              )
            })()}

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none"
              />
            </div>

            <button
              onClick={handleEditEntry}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-neutral-900 text-white font-medium text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Entry'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        title="Delete Entry?"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        onConfirm={handleDeleteEntry}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}
