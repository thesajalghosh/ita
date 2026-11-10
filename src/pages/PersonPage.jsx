import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CATEGORIES,
  TRANSACTION_TYPES,
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateShort,
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
  updateCalculation,
  createEntry,
  updateEntry,
  softDeleteEntry,
  generateCSV,
  generateItaSellCSV,
  getItaSalesByPerson,
  getItaPaymentsByPerson,
  getEntriesByPerson,
} from '../lib/api'
import { useSettings } from '../contexts/SettingsContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import ItaSellWeeklyView from '../components/ItaSellWeeklyView'
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
  ChevronDown,
  MoreVertical,
} from 'lucide-react'

export default function PersonPage() {
  const { categoryId, personId } = useParams()
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

    // Keep stale local IDs and category-less deep links pointed at the synced account.
    if (p.id !== personId || (p.category && categoryId !== p.category)) {
      navigate(`/category/${p.category}/person/${p.id}`, { replace: true })
      return
    }

    const { data: calcs } = await getCalculationsByPerson(personId)
    // Auto-update legacy "Other Materials" column to "Mola Material"
    if (calcs && calcs.length > 0) {
      calcs.forEach((c) => {
        if (c.name === 'Other Materials') {
          c.name = 'Mola Material'
          updateCalculation(c.id, { name: 'Mola Material' })
        }
      })
    }
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
  }, [personId, categoryId, navigate])

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
        entryData.transaction_type = isPaidCategory ? 'i_paid_them' : entryTxType
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
        updates.transaction_type = isPaidCategory ? 'i_paid_them' : entryTxType
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

  // All payment/expense categories where money is always paid by user
  const isPaidCategory = ['labour', 'koila', 'kamin', 'sordar', 'ita_khola'].includes(person?.category)

  const resetEntryForm = () => {
    setEntryDate(getTodayDate())
    setEntryQuantity('')
    setEntryAmount('')
    setEntryTxType(isPaidCategory ? 'i_paid_them' : 'i_will_receive')
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
    if (person?.category === 'ita_sell') {
      const [salesRes, paymentsRes] = await Promise.all([
        getItaSalesByPerson(personId),
        getItaPaymentsByPerson(personId),
      ])
      const sales = salesRes.data || []
      const payments = paymentsRes.data || []

      if (sales.length === 0 && payments.length === 0) {
        toast('No sales or payments available to export', 'warning')
        return
      }

      const csv = generateItaSellCSV(sales, payments, person.name)
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${person.name}_ita_sales_weekly.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast('ITA Sales CSV downloaded', 'success')
      return
    }

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
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100/50 safe-area-top safe-area-bottom pb-20">
      {/* ─── Sticky Header ─── */}
      <div className="glass border-b border-neutral-200/60 px-4 py-3 sticky top-0 z-20 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center text-neutral-600 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-neutral-900 truncate">
                  {person.name}
                </h1>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${category?.colorLight} ${category?.colorText} border ${category?.colorBorder}`}>
                  {category?.name}
                </span>
              </div>
              {person.phone && (
                <p className="text-xs text-neutral-500 font-mono flex items-center gap-1 mt-0.5">
                  <Phone className="w-2.5 h-2.5" />
                  {person.phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {person.phone && (
              <a
                href={`tel:${person.phone}`}
                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center text-emerald-600 border border-emerald-200/60"
              >
                <Phone className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={handleExport}
              className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 transition-all flex items-center justify-center text-neutral-600"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {person.category === 'ita_sell' ? (
          /* Specialized Weekly ITA Sales & Payment System for ITA Sell Person */
          <ItaSellWeeklyView person={person} onRefreshDashboard={loadData} />
        ) : (
          <>
            {/* ─── Quantity Summaries ─── */}
            {Object.keys(quantitySummary).length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {Object.entries(quantitySummary).map(([name, total]) => (
                  <div
                    key={name}
                    className="bg-white rounded-xl px-3 py-2 border border-neutral-200/70 shadow-card shrink-0 flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <div className="min-w-0">
                      <span className="text-xs text-neutral-500 block font-medium truncate max-w-[140px] leading-tight">
                        {name}
                      </span>
                      <span className="text-sm font-bold text-neutral-900">{formatNumber(total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── Section Header ─── */}
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1">
                <h2 className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                  Columns
                </h2>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-neutral-200/70 text-neutral-600">
                  {calculations.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEntrySortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-md bg-white border border-neutral-200/70 text-neutral-600 text-xs font-medium shadow-card"
                >
                  <ArrowUpDown className="w-2.5 h-2.5" />
                  <span>{entrySortOrder === 'newest' ? 'New' : 'Old'}</span>
                </button>

                <button
                  onClick={() => setShowAddCalc(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Column</span>
                </button>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                ★ 3 CALCULATION COLUMNS ON ONE MOBILE SCREEN ★
                Always grid-cols-3, compact sizing, scrollable entries
                ═══════════════════════════════════════════════════════════════ */}
            <div
              className={`pb-2 ${calculations.length <= 3
                ? 'grid grid-cols-3 gap-2'
                : 'flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none'
                }`}
            >
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

                const isMoney = calc.calc_type === 'money'

                return (
                  <div
                    key={calc.id}
                    className={`flex flex-col ${calculations.length > 3
                        ? 'w-[calc((100%-8px)/3)] min-w-[calc((100%-8px)/3)] shrink-0 snap-start'
                        : 'min-w-0'
                      }`}
                  >
                    {/* ── Column Header ── */}
                    <div
                      className={`rounded-xl p-1.5 mb-1 border shadow-card ${isMoney
                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50/80 border-blue-200/70'
                          : 'bg-gradient-to-br from-amber-50 to-orange-50/80 border-amber-200/70'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-0.5 mb-0.5">
                        <h3
                          className="text-[10px] font-bold text-neutral-800 truncate leading-tight"
                          title={calc.name}
                        >
                          {calc.name}
                        </h3>
                        <span
                          className={`text-[7px] font-extrabold px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ${isMoney
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}
                        >
                          {isMoney ? '₹' : '#'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-0.5">
                        <span
                          className={`text-[11px] font-extrabold tracking-tight truncate ${isMoney ? 'text-blue-700' : 'text-amber-800'
                            }`}
                        >
                          {isMoney ? formatCurrency(total) : formatNumber(total)}
                        </span>
                        <span className="text-[7px] text-neutral-400 font-medium shrink-0">
                          {entries.length}
                        </span>
                      </div>
                    </div>

                    {/* ── Add Entry Button ── */}
                    <button
                      onClick={() => {
                        resetEntryForm()
                        setShowAddEntry(calc)
                      }}
                      className={`w-full py-1 px-0.5 mb-1 rounded-lg border border-dashed flex items-center justify-center gap-0.5 text-[9px] font-semibold active:scale-95 transition-all ${isMoney
                          ? 'border-blue-300/80 text-blue-600 bg-white hover:bg-blue-50/50'
                          : 'border-amber-300/80 text-amber-600 bg-white hover:bg-amber-50/50'
                        }`}
                    >
                      <Plus className="w-2.5 h-2.5 shrink-0" />
                      <span>Add</span>
                    </button>

                    {/* ── Entries List (scrollable) ── */}
                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[55vh] scrollbar-none">
                      {entries.length === 0 ? (
                        <div className="text-center py-4 px-1 bg-white/60 rounded-lg border border-dashed border-neutral-200">
                          <p className="text-[8px] text-neutral-400 font-medium">No entries</p>
                        </div>
                      ) : (
                        entries.map((entry) => {
                          const tx = TRANSACTION_TYPES[entry.transaction_type]
                          return (
                            <div
                              key={entry.id}
                              className="bg-white rounded-lg p-1.5 border border-neutral-200/70 shadow-card space-y-0.5 transition-all hover:border-neutral-300 entry-card"
                            >
                              {/* Date & Actions row */}
                              <div className="flex items-center justify-between gap-0.5">
                                <span className="text-[8px] text-neutral-400 font-medium flex items-center gap-0.5 truncate leading-tight">
                                  <Calendar className="w-2 h-2 shrink-0 text-neutral-300" />
                                  {formatDateShort(entry.entry_date)}
                                </span>
                                {(settings.allow_edit || settings.allow_delete) && (
                                  <div className="flex items-center shrink-0">
                                    {settings.allow_edit && (
                                      <button
                                        onClick={() => openEditEntry(entry)}
                                        className="p-0.5 rounded text-neutral-300 hover:text-blue-600 hover:bg-blue-50"
                                      >
                                        <Pencil className="w-2 h-2" />
                                      </button>
                                    )}
                                    {settings.allow_delete && (
                                      <button
                                        onClick={() => setShowDeleteConfirm(entry)}
                                        className="p-0.5 rounded text-neutral-300 hover:text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 className="w-2 h-2" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Value */}
                              {calc.calc_type === 'quantity' ? (
                                <p className="text-[11px] font-bold text-neutral-900 tracking-tight truncate">
                                  {formatNumber(entry.quantity)}
                                </p>
                              ) : (
                                <div className="min-w-0">
                                  <p
                                    className={`text-[11px] font-bold leading-tight truncate ${tx?.color || 'text-neutral-900'
                                      }`}
                                  >
                                    {formatCurrency(entry.amount)}
                                  </p>
                                  <span
                                    className={`text-[7px] font-bold px-0.5 py-0.5 rounded inline-block mt-0.5 truncate max-w-full ${tx?.badge || 'bg-neutral-100 text-neutral-700'
                                      }`}
                                  >
                                    {tx?.shortLabel || 'Entry'}
                                  </span>
                                </div>
                              )}

                              {/* Description */}
                              {entry.description && (
                                <p
                                  className="text-[7px] text-neutral-400 truncate pt-0.5 border-t border-neutral-100 leading-tight"
                                  title={entry.description}
                                >
                                  {entry.description}
                                </p>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {calculations.length === 0 && (
              <div className="text-center py-10 bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-card">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                  <Hash className="w-6 h-6 text-neutral-400" />
                </div>
                <p className="text-xs font-medium text-neutral-500 mb-3">No calculation columns yet</p>
                <button
                  onClick={() => setShowAddCalc(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Column</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ Add Calculation Modal ═══ */}
      {showAddCalc && (
        <Modal onClose={() => setShowAddCalc(false)} panelClassName="p-5 pb-8 sm:p-6 sm:pb-6 space-y-4 max-h-[85vh]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">New Column</h3>
              <button
                onClick={() => setShowAddCalc(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1.5 tracking-wider">
                Column Name *
              </label>
              <input
                type="text"
                value={calcName}
                onChange={(e) => setCalcName(e.target.value)}
                placeholder="e.g. Brick Lifting, Money Account"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1.5 tracking-wider">
                Column Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalcType('quantity')}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${calcType === 'quantity'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                >
                  <Hash className={`w-5 h-5 mx-auto mb-1 ${calcType === 'quantity' ? 'text-amber-600' : 'text-neutral-400'}`} />
                  <span className="text-xs font-semibold">Quantity (Pcs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcType('money')}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${calcType === 'money'
                      ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                >
                  <DollarSign className={`w-5 h-5 mx-auto mb-1 ${calcType === 'money' ? 'text-blue-600' : 'text-neutral-400'}`} />
                  <span className="text-xs font-semibold">Money (₹)</span>
                </button>
              </div>
            </div>

            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={handleAddCalculation}
                disabled={saving || !calcName.trim()}
                className="w-full py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white font-bold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {saving ? 'Creating...' : 'Save Column'}
              </button>
            </div>
        </Modal>
      )}

      {/* ═══ Add Entry Modal ═══ */}
      {showAddEntry && (
        <Modal onClose={() => setShowAddEntry(null)} panelClassName="p-5 pb-8 sm:p-6 sm:pb-6 space-y-3.5 max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Add Entry</h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">{showAddEntry.name}</p>
              </div>
              <button
                onClick={() => setShowAddEntry(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {showAddEntry.calc_type === 'money' && !isPaidCategory && (
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1.5 tracking-wider">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(TRANSACTION_TYPES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEntryTxType(key)}
                      className={`p-2 rounded-lg border text-center text-[10px] font-medium transition-all ${entryTxType === key
                          ? `${val.border} ${val.bg} ${val.color} font-bold ring-1 ring-neutral-300`
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
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
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={entryQuantity}
                  onChange={(e) => setEntryQuantity(e.target.value)}
                  placeholder="Enter count"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="₹ Amount"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Note (Optional)
              </label>
              <input
                type="text"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder="Remarks or memo"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={handleAddEntry}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white font-bold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
        </Modal>
      )}

      {/* ═══ Edit Entry Modal ═══ */}
      {showEditEntry && (
        <Modal
          onClose={() => {
              setShowEditEntry(null)
              resetEntryForm()
          }}
          panelClassName="p-5 pb-8 sm:p-6 sm:pb-6 space-y-3.5 max-h-[85vh]"
        >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Edit Entry</h3>
              <button
                onClick={() => {
                  setShowEditEntry(null)
                  resetEntryForm()
                }}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {(() => {
              const calc = calculations.find((c) => c.id === showEditEntry.calculation_id)
              if (calc?.calc_type === 'money') {
                return (
                  <>
                    {!isPaidCategory && (
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1.5 tracking-wider">
                          Transaction Type
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.entries(TRANSACTION_TYPES).map(([key, val]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setEntryTxType(key)}
                              className={`p-2 rounded-lg border text-center text-[10px] font-medium transition-all ${entryTxType === key
                                  ? `${val.border} ${val.bg} ${val.color} font-bold ring-1 ring-neutral-300`
                                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                                }`}
                            >
                              {val.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                        Amount (₹) *
                      </label>
                      <input
                        type="number"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                        inputMode="numeric"
                      />
                    </div>
                  </>
                )
              }
              return (
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={entryQuantity}
                    onChange={(e) => setEntryQuantity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    inputMode="numeric"
                  />
                </div>
              )
            })()}

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Note (Optional)
              </label>
              <input
                type="text"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={handleEditEntry}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white font-bold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {saving ? 'Updating...' : 'Update Entry'}
              </button>
            </div>
        </Modal>
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
