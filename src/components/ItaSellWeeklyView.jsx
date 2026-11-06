import { useState, useMemo, useEffect } from 'react'
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateShort,
  getTodayDate,
  getCalendarWeekRange,
  getWeeklyPaymentStatus,
} from '../lib/constants'
import {
  getItaSalesByPerson,
  getItaPaymentsByPerson,
  createItaSale,
  updateItaSale,
  softDeleteItaSale,
  createItaPayment,
  updateItaPayment,
  softDeleteItaPayment,
  migrateLegacyItaSellEntries,
} from '../lib/api'
import { useSettings } from '../contexts/SettingsContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { toast } from '../components/Toast'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Pencil,
  Trash2,
  X,
  CreditCard,
  ShoppingBag,
  AlertCircle,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react'

export default function ItaSellWeeklyView({ person, onRefreshDashboard }) {
  const { settings } = useSettings()

  const [sales, setSales] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  // Expanded weeks state (object map of weekStart -> boolean)
  const [expandedWeeks, setExpandedWeeks] = useState({})

  // Filter: 'all' | 'unpaid' | 'paid'
  const [weekFilter, setWeekFilter] = useState('all')

  // Modals state
  const [showAddSale, setShowAddSale] = useState(false)
  const [showEditSale, setShowEditSale] = useState(null)
  const [showAddPayment, setShowAddPayment] = useState(null) // week object or null
  const [showEditPayment, setShowEditPayment] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { type: 'sale'|'payment', item }

  // Form states - Sale
  const [saleDate, setSaleDate] = useState(getTodayDate())
  const [saleQuantity, setSaleQuantity] = useState('')
  const [saleRate, setSaleRate] = useState('')
  const [saleNote, setSaleNote] = useState('')

  // Form states - Payment
  const [paymentDate, setPaymentDate] = useState(getTodayDate())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentTargetWeek, setPaymentTargetWeek] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentWarning, setPaymentWarning] = useState('')

  const [saving, setSaving] = useState(false)

  // Load Sales and Payments
  const loadData = async () => {
    setLoading(true)
    try {
      // Auto-migrate legacy entries if any
      await migrateLegacyItaSellEntries(person.id)

      const [salesRes, paymentsRes] = await Promise.all([
        getItaSalesByPerson(person.id),
        getItaPaymentsByPerson(person.id),
      ])

      setSales(salesRes.data || [])
      setPayments(paymentsRes.data || [])
    } catch (err) {
      toast('Failed to load ITA sales: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (person?.id) {
      loadData()
    }
  }, [person?.id])

  // Calculated Sales Amount preview in Sale modal
  const calculatedSaleAmount = useMemo(() => {
    const qty = Number(saleQuantity) || 0
    const rate = Number(saleRate) || 0
    if (qty > 0 && rate > 0) {
      return (qty / 1000) * rate
    }
    return 0
  }, [saleQuantity, saleRate])

  // Group transactions by calendar week (Monday to Sunday)
  // Excess payment allocation: If any week receives payments exceeding its sales amount,
  // the excess is automatically carried forward and added to the next remaining week(s).
  const weeklyGroups = useMemo(() => {
    const groups = {}

    // Helper for precise 2-decimal calculations
    const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100

    // 1. Group sales by week_start_date
    sales.forEach((s) => {
      const weekStart = s.week_start_date || getCalendarWeekRange(s.sale_date).start
      const weekEnd = s.week_end_date || getCalendarWeekRange(s.sale_date).end

      if (!groups[weekStart]) {
        groups[weekStart] = {
          weekStart,
          weekEnd,
          label: `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`,
          sales: [],
          payments: [],
          totalQuantity: 0,
          totalSalesAmount: 0,
          directPaid: 0,
          carriedIn: 0,
          carriedOut: 0,
          carriedInFrom: [],
          carriedOutTo: [],
          totalPaid: 0,
          remainingAmount: 0,
          rates: new Set(),
        }
      }

      groups[weekStart].sales.push(s)
      groups[weekStart].totalQuantity += Number(s.quantity) || 0
      groups[weekStart].totalSalesAmount = round2(groups[weekStart].totalSalesAmount + (Number(s.sales_amount) || 0))
      if (s.rate_per_thousand !== undefined && s.rate_per_thousand !== null) {
        groups[weekStart].rates.add(Number(s.rate_per_thousand))
      }
    })

    // 2. Associate direct payments to their weeks
    payments.forEach((p) => {
      const weekStart = p.week_start_date || getCalendarWeekRange(p.payment_date).start
      if (groups[weekStart]) {
        groups[weekStart].payments.push(p)
        groups[weekStart].directPaid = round2(groups[weekStart].directPaid + (Number(p.amount) || 0))
      } else {
        const matchedWeek = Object.keys(groups).find((k) => k === weekStart)
        if (matchedWeek) {
          groups[matchedWeek].payments.push(p)
          groups[matchedWeek].directPaid = round2(groups[matchedWeek].directPaid + (Number(p.amount) || 0))
        }
      }
    })

    // 3. Sort chronologically (oldest week to newest week) for accurate cascading
    const chronoWeeks = Object.values(groups).sort(
      (a, b) => new Date(a.weekStart) - new Date(b.weekStart)
    )

    // 4. Excess payment allocation pass:
    // Any excess payment on week i flows to the next remaining week(s)
    for (let i = 0; i < chronoWeeks.length; i++) {
      const current = chronoWeeks[i]
      const totalAvailable = round2(current.directPaid + current.carriedIn)
      const salesAmt = round2(current.totalSalesAmount)

      if (totalAvailable > salesAmt) {
        let excess = round2(totalAvailable - salesAmt)

        // Forward excess to subsequent weeks (i + 1, i + 2, ...) that have outstanding balance
        for (let j = i + 1; j < chronoWeeks.length && excess > 0; j++) {
          const nextWeek = chronoWeeks[j]
          const nextSales = round2(nextWeek.totalSalesAmount)
          const nextAlreadyAvailable = round2(nextWeek.directPaid + nextWeek.carriedIn)
          const nextNeeded = round2(Math.max(0, nextSales - nextAlreadyAvailable))

          if (nextNeeded > 0) {
            const transfer = round2(Math.min(excess, nextNeeded))
            nextWeek.carriedIn = round2(nextWeek.carriedIn + transfer)
            current.carriedOut = round2(current.carriedOut + transfer)

            current.carriedOutTo.push({
              toWeekStart: nextWeek.weekStart,
              toLabel: nextWeek.label,
              amount: transfer,
            })
            nextWeek.carriedInFrom.push({
              fromWeekStart: current.weekStart,
              fromLabel: current.label,
              amount: transfer,
            })

            excess = round2(excess - transfer)
          }
        }

        // If there is still excess after checking all subsequent weeks,
        // allocate to any earlier unpaid weeks (0 ... i - 1)
        if (excess > 0) {
          for (let k = 0; k < i && excess > 0; k++) {
            const earlierWeek = chronoWeeks[k]
            const earlierSales = round2(earlierWeek.totalSalesAmount)
            const earlierAlreadyAvailable = round2(earlierWeek.directPaid + earlierWeek.carriedIn)
            const earlierNeeded = round2(Math.max(0, earlierSales - earlierAlreadyAvailable))

            if (earlierNeeded > 0) {
              const transfer = round2(Math.min(excess, earlierNeeded))
              earlierWeek.carriedIn = round2(earlierWeek.carriedIn + transfer)
              current.carriedOut = round2(current.carriedOut + transfer)

              current.carriedOutTo.push({
                toWeekStart: earlierWeek.weekStart,
                toLabel: earlierWeek.label,
                amount: transfer,
              })
              earlierWeek.carriedInFrom.push({
                fromWeekStart: current.weekStart,
                fromLabel: current.label,
                amount: transfer,
              })

              excess = round2(excess - transfer)
            }
          }
        }
      }
    }

    // 5. Finalize totals, remaining, status, and sorting for each week
    const weekList = chronoWeeks.map((w) => {
      // Effective totalPaid = directPaid + carriedIn - carriedOut
      const totalPaid = round2(w.directPaid + w.carriedIn - w.carriedOut)
      const remaining = round2(Math.max(0, w.totalSalesAmount - totalPaid))
      const statusInfo = getWeeklyPaymentStatus(w.totalSalesAmount, totalPaid)

      // Sort sales inside week (latest first)
      w.sales.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
      // Sort payments inside week (latest first)
      w.payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))

      return {
        ...w,
        totalPaid,
        remainingAmount: remaining,
        statusInfo,
        ratesList: Array.from(w.rates),
      }
    })

    // 6. Sort weeks descending (latest week at the top) for UI display
    weekList.sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart))

    return weekList
  }, [sales, payments])

  // Overall Summary Metrics across all weeks
  const topSummary = useMemo(() => {
    let totalSold = 0
    let totalSales = 0
    let totalPaid = 0

    sales.forEach((s) => {
      totalSold += Number(s.quantity) || 0
      totalSales += Number(s.sales_amount) || 0
    })

    payments.forEach((p) => {
      totalPaid += Number(p.amount) || 0
    })

    const totalRemaining = Math.max(0, totalSales - totalPaid)

    return {
      totalSold,
      totalSales,
      totalPaid,
      totalRemaining,
    }
  }, [sales, payments])

  // Filtered weeks based on filter selection
  const filteredWeeks = useMemo(() => {
    if (weekFilter === 'unpaid') {
      return weeklyGroups.filter((w) => w.remainingAmount > 0)
    }
    if (weekFilter === 'paid') {
      return weeklyGroups.filter((w) => w.remainingAmount === 0 && w.totalSalesAmount > 0)
    }
    return weeklyGroups
  }, [weeklyGroups, weekFilter])

  // Toggle Week Expand/Collapse
  const toggleWeek = (weekStart) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekStart]: !prev[weekStart],
    }))
  }

  // ----------------------------------------------------
  // Handlers for Sale
  // ----------------------------------------------------
  const handleOpenAddSale = () => {
    setSaleDate(getTodayDate())
    setSaleQuantity('')
    setSaleRate('')
    setSaleNote('')
    setShowAddSale(true)
  }

  const handleOpenEditSale = (sale) => {
    if (!settings.allow_edit) {
      toast('Enable editing permission from Settings first.', 'warning')
      return
    }
    setSaleDate(sale.sale_date)
    setSaleQuantity(String(sale.quantity))
    setSaleRate(String(sale.rate_per_thousand))
    setSaleNote(sale.note || '')
    setShowEditSale(sale)
  }

  const handleSaveSale = async () => {
    const qty = Number(saleQuantity)
    const rate = Number(saleRate)

    if (!saleDate) {
      toast('Please choose a date', 'warning')
      return
    }
    if (!qty || qty <= 0) {
      toast('Please enter a valid ITA quantity', 'warning')
      return
    }
    if (rate === undefined || rate < 0 || isNaN(rate)) {
      toast('Please enter rate per 1,000 ITA', 'warning')
      return
    }

    setSaving(true)
    const salesAmt = Math.round(((qty / 1000) * rate) * 100) / 100
    const weekRange = getCalendarWeekRange(saleDate)

    try {
      if (showEditSale) {
        const { error } = await updateItaSale(showEditSale.id, {
          sale_date: saleDate,
          quantity: qty,
          rate_per_thousand: rate,
          sales_amount: salesAmt,
          note: saleNote.trim() || null,
        })
        if (error) throw error
        toast('Sale record updated', 'success')
        setShowEditSale(null)
      } else {
        const { error } = await createItaSale({
          person_id: person.id,
          sale_date: saleDate,
          quantity: qty,
          rate_per_thousand: rate,
          sales_amount: salesAmt,
          note: saleNote.trim() || null,
          week_start_date: weekRange.start,
          week_end_date: weekRange.end,
        })
        if (error) throw error
        toast('Sale entry saved successfully', 'success')
        setShowAddSale(false)
        // Automatically expand this week
        setExpandedWeeks((prev) => ({ ...prev, [weekRange.start]: true }))
      }

      await loadData()
      if (onRefreshDashboard) onRefreshDashboard()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ----------------------------------------------------
  // Handlers for Payment
  // ----------------------------------------------------
  const handleOpenAddPayment = (targetWeek = null) => {
    setPaymentDate(getTodayDate())
    setPaymentAmount('')
    setPaymentNote('')
    setPaymentWarning('')

    const defaultWeek = targetWeek ? targetWeek.weekStart : (weeklyGroups[0]?.weekStart || '')
    setPaymentTargetWeek(defaultWeek)
    setShowAddPayment(true)
  }

  const handleOpenEditPayment = (payment) => {
    if (!settings.allow_edit) {
      toast('Enable editing permission from Settings first.', 'warning')
      return
    }
    setPaymentDate(payment.payment_date)
    setPaymentAmount(String(payment.amount))
    setPaymentTargetWeek(payment.week_start_date)
    setPaymentNote(payment.note || '')
    setPaymentWarning('')
    setShowEditPayment(payment)
  }

  const handlePaymentAmountChange = (val, targetWeek = paymentTargetWeek) => {
    setPaymentAmount(val)
    const amt = Number(val)
    if (!amt || !targetWeek) {
      setPaymentWarning('')
      return
    }

    const week = weeklyGroups.find((w) => w.weekStart === targetWeek)
    if (week) {
      // If editing, exclude this payment's current amount from week's direct payments
      const currentDirect = showEditPayment
        ? Math.max(0, (week.directPaid || 0) - (Number(showEditPayment.amount) || 0))
        : (week.directPaid || 0)
      const availableWithoutThis = (week.carriedIn || 0) + currentDirect
      const outstanding = Math.max(0, week.totalSalesAmount - availableWithoutThis)

      if (amt > outstanding) {
        const excess = Math.round((amt - outstanding) * 100) / 100
        // Find next chronological week with an outstanding balance
        const chrono = [...weeklyGroups].sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
        const currentIndex = chrono.findIndex((w) => w.weekStart === targetWeek)
        const nextWeek = chrono.slice(currentIndex + 1).find((w) => w.remainingAmount > 0)

        if (nextWeek) {
          setPaymentWarning(
            `Excess payment of ${formatCurrency(excess)} will be automatically added to the next remaining week (${nextWeek.label}).`
          )
        } else {
          setPaymentWarning(
            `Excess payment of ${formatCurrency(excess)} will be automatically added to the next remaining week or future sales.`
          )
        }
      } else {
        setPaymentWarning('')
      }
    }
  }

  const handleSavePayment = async () => {
    const amt = Number(paymentAmount)

    if (!paymentDate) {
      toast('Please choose payment date', 'warning')
      return
    }
    if (!amt || amt <= 0) {
      toast('Please enter a valid payment amount', 'warning')
      return
    }
    if (!paymentTargetWeek) {
      toast('Please select a week for this payment', 'warning')
      return
    }

    const selectedWeek = weeklyGroups.find((w) => w.weekStart === paymentTargetWeek)
    if (!selectedWeek) {
      toast('Selected week could not be found', 'warning')
      return
    }

    setSaving(true)
    const isExcess = amt > (selectedWeek.remainingAmount || 0)

    try {
      if (showEditPayment) {
        const { error } = await updateItaPayment(showEditPayment.id, {
          payment_date: paymentDate,
          amount: amt,
          week_start_date: selectedWeek.weekStart,
          week_end_date: selectedWeek.weekEnd,
          note: paymentNote.trim() || null,
        })
        if (error) throw error
        toast(
          isExcess
            ? 'Payment updated! Excess amount automatically added to next remaining week.'
            : 'Payment record updated',
          'success'
        )
        setShowEditPayment(null)
      } else {
        const { error } = await createItaPayment({
          person_id: person.id,
          payment_date: paymentDate,
          amount: amt,
          week_start_date: selectedWeek.weekStart,
          week_end_date: selectedWeek.weekEnd,
          note: paymentNote.trim() || null,
        })
        if (error) throw error
        toast(
          isExcess
            ? 'Payment saved! Excess amount automatically added to next remaining week.'
            : 'Payment saved successfully',
          'success'
        )
        setShowAddPayment(null)
        // Automatically expand the week where payment was posted
        setExpandedWeeks((prev) => ({ ...prev, [selectedWeek.weekStart]: true }))
      }

      await loadData()
      if (onRefreshDashboard) onRefreshDashboard()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ----------------------------------------------------
  // Delete handler
  // ----------------------------------------------------
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    const { type, item } = deleteConfirm

    try {
      if (type === 'sale') {
        const { error } = await softDeleteItaSale(item.id)
        if (error) throw error
        toast('Sale entry deleted', 'success')
      } else if (type === 'payment') {
        const { error } = await softDeleteItaPayment(item.id)
        if (error) throw error
        toast('Payment entry deleted', 'success')
      }
      setDeleteConfirm(null)
      await loadData()
      if (onRefreshDashboard) onRefreshDashboard()
    } catch (err) {
      toast('Error: ' + err.message, 'error')
    }
  }

  return (
    <div className="space-y-3 pb-8">
      {/* ═══════════════════════════════════════════════════════════════
          1. TOP SUMMARY DASHBOARD (4 CARDS)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {/* Card 1: Total ITA Sold */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-neutral-200/70 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
              Total ITA Sold
            </span>
            <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-3 h-3" />
            </div>
          </div>
          <div>
            <p className="text-base sm:text-lg font-extrabold text-neutral-900 tracking-tight">
              {formatNumber(topSummary.totalSold)}
              <span className="text-[10px] text-neutral-400 font-medium ml-1">pcs</span>
            </p>
            <span className="text-[8px] text-neutral-400 font-medium">All sales quantity</span>
          </div>
        </div>

        {/* Card 2: Total Sales Amount */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-neutral-200/70 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
              Total Sales
            </span>
            <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="text-xs font-bold">₹</span>
            </div>
          </div>
          <div>
            <p className="text-base sm:text-lg font-extrabold text-blue-700 tracking-tight">
              {formatCurrency(topSummary.totalSales)}
            </p>
            <span className="text-[8px] text-neutral-400 font-medium">Expected revenue</span>
          </div>
        </div>

        {/* Card 3: Total Paid */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-neutral-200/70 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
              Total Paid
            </span>
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-3 h-3" />
            </div>
          </div>
          <div>
            <p className="text-base sm:text-lg font-extrabold text-emerald-700 tracking-tight">
              {formatCurrency(topSummary.totalPaid)}
            </p>
            <span className="text-[8px] text-neutral-400 font-medium">Payment received</span>
          </div>
        </div>

        {/* Card 4: Total Remaining */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-neutral-200/70 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
              Total Remaining
            </span>
            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${topSummary.totalRemaining > 0 ? 'bg-rose-50 text-rose-600' : 'bg-neutral-100 text-neutral-400'}`}>
              <AlertCircle className="w-3 h-3" />
            </div>
          </div>
          <div>
            <p className={`text-base sm:text-lg font-extrabold tracking-tight ${topSummary.totalRemaining > 0 ? 'text-rose-700' : 'text-neutral-500'}`}>
              {formatCurrency(topSummary.totalRemaining)}
            </p>
            <span className="text-[8px] text-neutral-400 font-medium">
              {topSummary.totalRemaining > 0 ? 'Outstanding balance' : 'Fully settled'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ACTION BUTTONS ROW
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <button
          onClick={handleOpenAddSale}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-card active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add ITA Sale</span>
        </button>

        <button
          onClick={() => handleOpenAddPayment(null)}
          disabled={weeklyGroups.length === 0}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white text-xs font-bold shadow-card active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Add Payment</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2 & 5. FILTER & WEEKLY DETAILS HEADER
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-neutral-200/70 shadow-card space-y-2">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Weekly Details
            </h2>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              {filteredWeeks.length} {filteredWeeks.length === 1 ? 'week' : 'weeks'}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-0.5 bg-neutral-100/80 p-0.5 rounded-lg border border-neutral-200/60">
            <button
              onClick={() => setWeekFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[9.5px] font-semibold transition-all ${weekFilter === 'all' ? 'bg-white text-neutral-900 shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              All Weeks
            </button>
            <button
              onClick={() => setWeekFilter('unpaid')}
              className={`px-2 py-0.5 rounded-md text-[9.5px] font-semibold transition-all ${weekFilter === 'unpaid' ? 'bg-white text-rose-700 shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              Outstanding
            </button>
            <button
              onClick={() => setWeekFilter('paid')}
              className={`px-2 py-0.5 rounded-md text-[9.5px] font-semibold transition-all ${weekFilter === 'paid' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              Fully Paid
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            3 & 4. EXPANDABLE WEEKLY CARDS
            ═══════════════════════════════════════════════════════════════ */}
        {loading ? (
          <div className="py-8 text-center text-xs text-neutral-400">Loading weekly sales...</div>
        ) : filteredWeeks.length === 0 ? (
          <div className="text-center py-8 px-3 bg-neutral-50/60 rounded-xl border border-dashed border-neutral-200">
            <p className="text-xs font-medium text-neutral-600 mb-1">
              {weeklyGroups.length === 0
                ? 'No weekly ITA sales recorded yet'
                : 'No weeks matching the selected filter'}
            </p>
            <p className="text-[10px] text-neutral-400 mb-3">
              {weeklyGroups.length === 0
                ? 'Click "+ Add ITA Sale" above to enter your first sales record.'
                : 'Switch back to "All Weeks" to see full history.'}
            </p>
            {weeklyGroups.length === 0 && (
              <button
                onClick={handleOpenAddSale}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[10px] font-bold shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>Add First Sale</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {filteredWeeks.map((week) => {
              const isExpanded = !!expandedWeeks[week.weekStart]
              const status = week.statusInfo

              return (
                <div
                  key={week.weekStart}
                  className="bg-neutral-50/70 hover:bg-neutral-50/90 rounded-xl border border-neutral-200/80 transition-all overflow-hidden"
                >
                  {/* Week Card Header / Summary bar */}
                  <div
                    onClick={() => toggleWeek(week.weekStart)}
                    className="p-2.5 sm:p-3 cursor-pointer flex items-center justify-between gap-2 select-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] sm:text-xs font-bold text-neutral-900 tracking-tight">
                          {week.label}
                        </span>
                        <span
                          className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border ${status.badge}`}
                        >
                          <span className={`inline-block w-1 h-1 rounded-full ${status.dot} mr-1`} />
                          {status.label}
                        </span>
                      </div>

                      {/* Micro summary line */}
                      <div className="flex items-center gap-2 mt-1 text-[9.5px] text-neutral-500 font-medium flex-wrap">
                        <span>
                          <strong className="text-neutral-800">{formatNumber(week.totalQuantity)}</strong> pcs
                        </span>
                        <span>•</span>
                        <span>
                          Sales: <strong className="text-blue-700">{formatCurrency(week.totalSalesAmount)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Paid: <strong className="text-emerald-700">{formatCurrency(week.totalPaid)}</strong>
                          {week.carriedIn > 0 && (
                            <span className="text-[8px] text-emerald-600 font-bold ml-1">
                              (+{formatCurrency(week.carriedIn)})
                            </span>
                          )}
                        </span>
                        <span>•</span>
                        <span className={week.remainingAmount > 0 ? 'text-rose-700 font-bold' : 'text-neutral-500'}>
                          Rem: {formatCurrency(week.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenAddPayment(week)
                        }}
                        className="px-2 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 text-[9px] font-bold shadow-xs active:scale-95 transition-all"
                        title="Add payment for this week"
                      >
                        + Pay
                      </button>

                      <div className="w-6 h-6 rounded-lg bg-neutral-200/60 flex items-center justify-center text-neutral-600">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Weekly Content */}
                  {isExpanded && (
                    <div className="border-t border-neutral-200/70 bg-white p-3 space-y-3">
                      {/* Week Metric Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 rounded-xl bg-neutral-50/80 border border-neutral-200/60 text-[9.5px]">
                        <div>
                          <span className="text-neutral-400 block font-medium">Rates / 1,000</span>
                          <span className="font-bold text-neutral-800">
                            {week.ratesList.length > 0
                              ? week.ratesList.map((r) => `₹${r}`).join(', ')
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block font-medium">Sales Amount</span>
                          <span className="font-bold text-blue-700">{formatCurrency(week.totalSalesAmount)}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block font-medium">Paid Amount</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(week.totalPaid)}</span>
                          {week.carriedIn > 0 && (
                            <span className="text-[8px] text-emerald-600 font-semibold block leading-tight">
                              (+{formatCurrency(week.carriedIn)} carried over)
                            </span>
                          )}
                          {week.carriedOut > 0 && (
                            <span className="text-[8px] text-amber-600 font-semibold block leading-tight">
                              (-{formatCurrency(week.carriedOut)} excess to next)
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-neutral-400 block font-medium">Outstanding</span>
                          <span className={`font-bold ${week.remainingAmount > 0 ? 'text-rose-700' : 'text-neutral-600'}`}>
                            {formatCurrency(week.remainingAmount)}
                          </span>
                        </div>
                      </div>

                      {/* 1. Sales Records in this week */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 text-blue-600" />
                            <span>ITA Sales Entries ({week.sales.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSaleDate(week.weekStart)
                              setSaleQuantity('')
                              setSaleRate('')
                              setSaleNote('')
                              setShowAddSale(true)
                            }}
                            className="text-[9px] font-bold text-blue-600 hover:text-blue-800"
                          >
                            + Add Sale
                          </button>
                        </div>

                        {week.sales.length === 0 ? (
                          <p className="text-[9px] text-neutral-400 italic">No sales recorded</p>
                        ) : (
                          <div className="space-y-1">
                            {week.sales.map((sale) => (
                              <div
                                key={sale.id}
                                className="p-2 rounded-xl bg-blue-50/40 border border-blue-100 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9.5px] font-semibold text-neutral-400 flex items-center gap-0.5">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {formatDateShort(sale.sale_date)}
                                    </span>
                                    <span className="text-[10px] font-bold text-neutral-900">
                                      {formatNumber(sale.quantity)} pcs
                                    </span>
                                    <span className="text-[9px] text-neutral-500">
                                      @ ₹{sale.rate_per_thousand}/1k
                                    </span>
                                  </div>
                                  {sale.note && (
                                    <p className="text-[9px] text-neutral-500 truncate mt-0.5">{sale.note}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-extrabold text-blue-700 text-xs">
                                    {formatCurrency(sale.sales_amount)}
                                  </span>

                                  {(settings.allow_edit || settings.allow_delete) && (
                                    <div className="flex items-center gap-0.5">
                                      {settings.allow_edit && (
                                        <button
                                          onClick={() => handleOpenEditSale(sale)}
                                          className="p-1 rounded text-neutral-400 hover:text-blue-600 hover:bg-white"
                                          title="Edit sale"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                      {settings.allow_delete && (
                                        <button
                                          onClick={() => setDeleteConfirm({ type: 'sale', item: sale })}
                                          className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-white"
                                          title="Delete sale"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Payments in this week */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-emerald-600" />
                            <span>Payments Received ({week.payments.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenAddPayment(week)}
                            className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800"
                          >
                            + Add Payment
                          </button>
                        </div>

                        {week.payments.length === 0 && week.carriedInFrom.length === 0 ? (
                          <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-200/60 text-center">
                            <p className="text-[9px] text-neutral-400">No payments allocated to this week yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Carried in from previous weeks */}
                            {week.carriedInFrom.map((c, idx) => (
                              <div
                                key={'carried_in_' + idx}
                                className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      Carried Over
                                    </span>
                                    <span className="text-[9.5px] font-semibold text-neutral-600">
                                      from {c.fromLabel}
                                    </span>
                                  </div>
                                  <p className="text-[8.5px] text-emerald-700 mt-0.5">
                                    Excess payment from previous week added to this week's balance
                                  </p>
                                </div>
                                <span className="font-extrabold text-emerald-700 text-xs shrink-0">
                                  +{formatCurrency(c.amount)}
                                </span>
                              </div>
                            ))}

                            {/* Direct payments for this week */}
                            {week.payments.map((pmt) => (
                              <div
                                key={pmt.id}
                                className="p-2 rounded-xl bg-emerald-50/40 border border-emerald-100 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9.5px] font-semibold text-neutral-400 flex items-center gap-0.5">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {formatDateShort(pmt.payment_date)}
                                    </span>
                                    <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/70 px-1 py-0.2 rounded">
                                      Payment
                                    </span>
                                  </div>
                                  {pmt.note && (
                                    <p className="text-[9px] text-neutral-500 truncate mt-0.5">{pmt.note}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-extrabold text-emerald-700 text-xs">
                                    {formatCurrency(pmt.amount)}
                                  </span>

                                  {(settings.allow_edit || settings.allow_delete) && (
                                    <div className="flex items-center gap-0.5">
                                      {settings.allow_edit && (
                                        <button
                                          onClick={() => handleOpenEditPayment(pmt)}
                                          className="p-1 rounded text-neutral-400 hover:text-emerald-600 hover:bg-white"
                                          title="Edit payment"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                      {settings.allow_delete && (
                                        <button
                                          onClick={() => setDeleteConfirm({ type: 'payment', item: pmt })}
                                          className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-white"
                                          title="Delete payment"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Excess forwarded to next weeks */}
                            {week.carriedOutTo.map((c, idx) => (
                              <div
                                key={'carried_out_' + idx}
                                className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-bold text-blue-800 bg-blue-100/90 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                      <ArrowRight className="w-2.5 h-2.5 text-blue-600" />
                                      Excess Forwarded
                                    </span>
                                    <span className="text-[9.5px] font-semibold text-neutral-600">
                                      to {c.toLabel}
                                    </span>
                                  </div>
                                  <p className="text-[8.5px] text-blue-700 mt-0.5">
                                    Excess payment transferred to cover next remaining week
                                  </p>
                                </div>
                                <span className="font-extrabold text-blue-700 text-xs shrink-0">
                                  -{formatCurrency(c.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT ITA SALE
          ═══════════════════════════════════════════════════════════════ */}
      {(showAddSale || showEditSale) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowAddSale(false)
              setShowEditSale(null)
            }}
          />
          <div className="slide-up relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 pb-8 sm:p-6 sm:pb-6 z-10 space-y-3.5 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {showEditSale ? 'Edit ITA Sale' : 'Add ITA Sale'}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Calculation: (Quantity / 1,000) × Price
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddSale(false)
                  setShowEditSale(null)
                }}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Transaction Date *
              </label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              <span className="text-[9px] text-neutral-400 mt-0.5 block">
                Week: {getCalendarWeekRange(saleDate).label}
              </span>
            </div>

            {/* ITA Quantity */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                ITA Quantity Sold *
              </label>
              <input
                type="number"
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                inputMode="numeric"
                autoFocus
              />
            </div>

            {/* Price per 1,000 */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Price per 1,000 ITA (₹) *
              </label>
              <input
                type="number"
                value={saleRate}
                onChange={(e) => setSaleRate(e.target.value)}
                placeholder="e.g. 120"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                inputMode="decimal"
              />
            </div>

            {/* Computed Sales Amount preview */}
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/70 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold text-blue-700 uppercase tracking-wider block">
                  Calculated Sales Amount
                </span>
                <span className="text-[9px] text-neutral-500">
                  ({Number(saleQuantity) || 0} / 1,000) × ₹{Number(saleRate) || 0}
                </span>
              </div>
              <p className="text-base font-extrabold text-blue-700">
                {formatCurrency(calculatedSaleAmount)}
              </p>
            </div>

            {/* Optional Note */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Note (Optional)
              </label>
              <input
                type="text"
                value={saleNote}
                onChange={(e) => setSaleNote(e.target.value)}
                placeholder="e.g. Site delivery, Challan #12"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={handleSaveSale}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {saving ? 'Saving Sale...' : showEditSale ? 'Update Sale' : 'Save ITA Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT PAYMENT
          ═══════════════════════════════════════════════════════════════ */}
      {(showAddPayment || showEditPayment) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowAddPayment(null)
              setShowEditPayment(null)
            }}
          />
          <div className="slide-up relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 pb-8 sm:p-6 sm:pb-6 z-10 space-y-3.5 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {showEditPayment ? 'Edit Payment' : 'Add Payment'}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Allocate payment to a specific week
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddPayment(null)
                  setShowEditPayment(null)
                }}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Week Selector */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Select Calendar Week *
              </label>
              <select
                value={paymentTargetWeek}
                onChange={(e) => {
                  setPaymentTargetWeek(e.target.value)
                  handlePaymentAmountChange(paymentAmount, e.target.value)
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              >
                {weeklyGroups.map((w) => (
                  <option key={w.weekStart} value={w.weekStart}>
                    {w.label} (Remaining: {formatCurrency(w.remainingAmount)})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {/* Payment Amount */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Payment Received (₹) *
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => handlePaymentAmountChange(e.target.value)}
                placeholder="₹ Payment Amount"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                inputMode="decimal"
                autoFocus
              />
            </div>

            {/* Notice if amount exceeds outstanding */}
            {paymentWarning && (
              <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 flex items-start gap-2 text-blue-900 text-[10px] leading-tight">
                <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <span className="font-bold block text-blue-950 mb-0.5">Excess Payment Allocation</span>
                  <span>{paymentWarning}</span>
                </div>
              </div>
            )}

            {/* Optional Note */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 tracking-wider">
                Note (Optional)
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. Cash, GPay, Cheque #004"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={handleSavePayment}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white font-bold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {saving ? 'Saving Payment...' : showEditPayment ? 'Update Payment' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DELETE CONFIRMATION DIALOG
          ═══════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={deleteConfirm?.type === 'sale' ? 'Delete ITA Sale?' : 'Delete Payment?'}
        message={`Are you sure you want to delete this ${deleteConfirm?.type === 'sale' ? 'sales entry' : 'payment entry'}? All weekly totals and summaries will be recalculated.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

