import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CATEGORIES, TRANSACTION_TYPES, formatNumber, formatCurrency, formatDate, getBalanceStatus, getTodayDate, CALC_TYPE_LABELS } from '../lib/constants'
import {
  getPersonById, getCalculationsByPerson, getEntriesByCalculation,
  getPersonFinancialSummary, getPersonQuantitySummary,
  createCalculation, createEntry, updateEntry, softDeleteEntry,
  generateCSV, getEntriesByPerson
} from '../lib/api'
import { useSettings } from '../contexts/SettingsContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { toast } from '../components/Toast'
import {
  ArrowLeft, Plus, X, Calendar, Hash, DollarSign,
  Download, MoreVertical, Pencil, Trash2, ChevronDown,
  FileText, TrendingUp, TrendingDown, Minus
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

  // Modals
  const [showAddCalc, setShowAddCalc] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(null) // calculation object or null
  const [showEditEntry, setShowEditEntry] = useState(null) // entry object or null
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Add Calculation form
  const [calcName, setCalcName] = useState('')
  const [calcType, setCalcType] = useState('quantity')

  // Add Entry form
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
    if (calcs) {
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
      toast('Please enter calculation name', 'warning')
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
      toast('New calculation added', 'success')
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

      toast('Entry updated successfully', 'success')
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
      toast('Entry deleted successfully', 'success')
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
      toast('Edit permission disabled. Enable it from Settings.', 'warning')
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
    toast('Downloading CSV...', 'success')
  }

  if (loading) return <LoadingSpinner message="Loading accounts..." />
  if (!person) return <div className="min-h-screen flex items-center justify-center text-gray-500">Person not found</div>

  const balanceStatus = financialSummary ? getBalanceStatus(financialSummary.net_balance) : null

  return (
    <div className="min-h-screen bg-gray-50 safe-area-top safe-area-bottom pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-800 to-primary-900 px-4 pt-4 pb-5 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{person.name}</h1>
              <p className="text-xs text-primary-200">{category?.name}</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Financial Summary */}
        {financialSummary && (
          <div className={`rounded-2xl p-4 border ${balanceStatus?.border} ${balanceStatus?.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Balance</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${balanceStatus?.bg} ${balanceStatus?.color}`}>
                {balanceStatus?.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${balanceStatus?.color} mb-3`}>
              {formatCurrency(Math.abs(financialSummary.net_balance))}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/70 rounded-lg p-2">
                <span className="text-gray-500">Receivable</span>
                <p className="font-semibold text-green-600">{formatCurrency(financialSummary.total_receivable)}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-2">
                <span className="text-gray-500">Received</span>
                <p className="font-semibold text-blue-600">{formatCurrency(financialSummary.total_received)}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-2">
                <span className="text-gray-500">Payable</span>
                <p className="font-semibold text-red-600">{formatCurrency(financialSummary.total_payable)}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-2">
                <span className="text-gray-500">Paid</span>
                <p className="font-semibold text-orange-600">{formatCurrency(financialSummary.total_paid)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quantity Summaries */}
        {Object.keys(quantitySummary).length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {Object.entries(quantitySummary).map(([name, total]) => (
              <div key={name} className="bg-white/15 backdrop-blur rounded-xl px-3 py-2 border border-white/10 shrink-0">
                <span className="text-xs text-primary-200 block">{name}</span>
                <span className="text-sm font-bold text-white">{formatNumber(total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculation Columns */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Calculation Columns</h2>
          <button
            onClick={() => setShowAddCalc(true)}
            className="flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full"
          >
            <Plus className="w-3.5 h-3.5" />
            New Column
          </button>
        </div>

        {/* The main timeline columns - side by side horizontally scrollable */}
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
          {calculations.map((calc) => {
            const entries = entriesMap[calc.id] || []
            const total = calc.calc_type === 'quantity'
              ? entries.reduce((s, e) => s + (Number(e.quantity) || 0), 0)
              : entries.reduce((s, e) => {
                  const amt = Number(e.amount) || 0
                  if (e.transaction_type === 'i_will_receive' || e.transaction_type === 'i_paid_them') return s + amt
                  return s - amt
                }, 0)

            return (
              <div
                key={calc.id}
                className="min-w-[160px] w-[47vw] max-w-[200px] shrink-0 snap-start"
              >
                {/* Column Header */}
                <div className={`rounded-xl p-3 mb-2 ${calc.calc_type === 'money' ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'}`}>
                  <h3 className="text-xs font-bold text-gray-800 truncate">{calc.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-sm font-bold ${calc.calc_type === 'money' ? 'text-blue-700' : 'text-amber-700'}`}>
                      {calc.calc_type === 'money' ? formatCurrency(total) : formatNumber(total)}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase">
                      {CALC_TYPE_LABELS[calc.calc_type]?.label}
                    </span>
                  </div>
                </div>

                {/* Timeline entries */}
                <div className="relative">
                  {entries.length > 0 && (
                    <div className="absolute left-[50%] top-2 bottom-12 w-0.5 bg-gradient-to-b from-gray-200 to-gray-100 -translate-x-1/2 z-0" />
                  )}

                  <div className="relative z-10 space-y-1.5">
                    {entries.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="entry-card group relative"
                      >
                        <div
                          className={`rounded-xl p-2.5 border bg-white shadow-sm transition-all ${
                            calc.calc_type === 'money' && entry.transaction_type
                              ? TRANSACTION_TYPES[entry.transaction_type]?.border || 'border-gray-100'
                              : 'border-gray-100'
                          }`}
                        >
                          {/* Date */}
                          <div className="flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-400 font-medium">{formatDate(entry.entry_date)}</span>
                          </div>

                          {/* Value */}
                          {calc.calc_type === 'quantity' ? (
                            <p className="text-sm font-bold text-gray-800">{formatNumber(entry.quantity)}</p>
                          ) : (
                            <>
                              <p className={`text-sm font-bold ${TRANSACTION_TYPES[entry.transaction_type]?.color || 'text-gray-800'}`}>
                                {formatCurrency(entry.amount)}
                              </p>
                              <span className={`text-[9px] font-medium mt-0.5 block ${TRANSACTION_TYPES[entry.transaction_type]?.color || 'text-gray-400'}`}>
                                {TRANSACTION_TYPES[entry.transaction_type]?.label}
                              </span>
                            </>
                          )}

                          {/* Description */}
                          {entry.description && (
                            <p className="text-[10px] text-gray-400 mt-1 truncate">{entry.description}</p>
                          )}

                          {/* Edit/Delete buttons - show on tap */}
                          {(settings.allow_edit || settings.allow_delete) && (
                            <div className="flex gap-1 mt-1.5 pt-1.5 border-t border-gray-50">
                              {settings.allow_edit && (
                                <button
                                  onClick={() => openEditEntry(entry)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-gray-50 text-gray-500 text-[10px]"
                                >
                                  <Pencil className="w-2.5 h-2.5" />
                                  Edit
                                </button>
                              )}
                              {settings.allow_delete && (
                                <button
                                  onClick={() => setShowDeleteConfirm(entry)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-red-50 text-red-500 text-[10px]"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Connector dot */}
                        {idx < entries.length - 1 && (
                          <div className="flex justify-center my-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Entry Button */}
                  <button
                    onClick={() => {
                      resetEntryForm()
                      setShowAddEntry(calc)
                    }}
                    className={`w-full mt-2 py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-1.5 text-xs font-semibold transition-all active:scale-95 ${
                      calc.calc_type === 'money'
                        ? 'border-blue-200 text-blue-500 bg-blue-50/50'
                        : 'border-amber-200 text-amber-600 bg-amber-50/50'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {calculations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 mb-3">No calculation columns yet</p>
            <button
              onClick={() => setShowAddCalc(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Calculation Column
            </button>
          </div>
        )}
      </div>

      {/* Add Calculation Modal */}
      {showAddCalc && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddCalc(false)} />
          <div className="slide-up relative bg-white rounded-t-3xl w-full max-w-lg p-6 safe-area-bottom">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">New Calculation Column</h3>
              <button onClick={() => setShowAddCalc(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Column Name</label>
                <input
                  type="text"
                  value={calcName}
                  onChange={(e) => setCalcName(e.target.value)}
                  placeholder="e.g. Brick Production, Transport Cost"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCalcType('quantity')}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                      calcType === 'quantity'
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-gray-100 bg-white text-gray-600'
                    }`}
                  >
                    <Hash className="w-5 h-5 mx-auto mb-1" />
                    Quantity
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcType('money')}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                      calcType === 'money'
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-600'
                    }`}
                  >
                    <DollarSign className="w-5 h-5 mx-auto mb-1" />
                    Money
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddCalculation}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Column'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddEntry(null)} />
          <div className="slide-up relative bg-white rounded-t-3xl w-full max-w-lg p-6 safe-area-bottom">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">New Entry</h3>
                <p className="text-xs text-gray-400">{showAddEntry.name}</p>
              </div>
              <button onClick={() => setShowAddEntry(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Transaction type for money */}
              {showAddEntry.calc_type === 'money' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TRANSACTION_TYPES).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEntryTxType(key)}
                        className={`p-2.5 rounded-xl border-2 text-center text-xs font-medium transition-all ${
                          entryTxType === key
                            ? `${val.border} ${val.bg} ${val.color}`
                            : 'border-gray-100 bg-white text-gray-600'
                        }`}
                      >
                        {val.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity or Amount */}
              {showAddEntry.calc_type === 'quantity' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    value={entryQuantity}
                    onChange={(e) => setEntryQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    inputMode="numeric"
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
                  <input
                    type="number"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    placeholder="₹ Amount"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    inputMode="numeric"
                    autoFocus
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  placeholder="Write a note"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                onClick={handleAddEntry}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {showEditEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowEditEntry(null); resetEntryForm() }} />
          <div className="slide-up relative bg-white rounded-t-3xl w-full max-w-lg p-6 safe-area-bottom">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Edit Entry</h3>
              <button onClick={() => { setShowEditEntry(null); resetEntryForm() }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Check calc type from the entry's calculation */}
              {(() => {
                const calc = calculations.find((c) => c.id === showEditEntry.calculation_id)
                if (calc?.calc_type === 'money') {
                  return (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(TRANSACTION_TYPES).map(([key, val]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setEntryTxType(key)}
                              className={`p-2.5 rounded-xl border-2 text-center text-xs font-medium transition-all ${
                                entryTxType === key
                                  ? `${val.border} ${val.bg} ${val.color}`
                                  : 'border-gray-100 bg-white text-gray-600'
                              }`}
                            >
                              {val.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
                        <input
                          type="number"
                          value={entryAmount}
                          onChange={(e) => setEntryAmount(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          inputMode="numeric"
                        />
                      </div>
                    </>
                  )
                }
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      value={entryQuantity}
                      onChange={(e) => setEntryQuantity(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      inputMode="numeric"
                    />
                  </div>
                )
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  placeholder="Write a note"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                onClick={handleEditEntry}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {saving ? 'Updating...' : 'Update Entry'}
              </button>
            </div>
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
