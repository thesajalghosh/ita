// Category definitions with English labels and default calculation templates
export const CATEGORIES = {
  labour: {
    id: 'labour',
    name: 'Labour Hisab',
    nameBn: 'Labour Hisab',
    icon: 'HardHat',
    color: 'bg-amber-500',
    colorLight: 'bg-amber-50',
    colorText: 'text-amber-700',
    colorBorder: 'border-amber-200',
    defaultCalculations: [
      { name: 'Brick Production', calc_type: 'quantity' },
      { name: 'Money Account', calc_type: 'money' },
    ],
  },
  ita_sell: {
    id: 'ita_sell',
    name: 'Ita Sell Person',
    nameBn: 'Ita Sell Person',
    icon: 'Package',
    color: 'bg-blue-500',
    colorLight: 'bg-blue-50',
    colorText: 'text-blue-700',
    colorBorder: 'border-blue-200',
    defaultCalculations: [
      { name: 'Brick Lifting', calc_type: 'quantity' },
      { name: 'Money Account', calc_type: 'money' },
      { name: 'Transport Cost', calc_type: 'money' },
    ],
  },
  koila: {
    id: 'koila',
    name: 'Koila Person',
    nameBn: 'Koila Person',
    icon: 'Flame',
    color: 'bg-orange-500',
    colorLight: 'bg-orange-50',
    colorText: 'text-orange-700',
    colorBorder: 'border-orange-200',
    defaultCalculations: [
      { name: 'Coal Quantity', calc_type: 'quantity' },
      { name: 'Mola Material', calc_type: 'quantity' },
      { name: 'Money Account', calc_type: 'money' },
    ],
  },
  kamin: {
    id: 'kamin',
    name: 'Kamin Hisab',
    nameBn: 'Kamin Hisab',
    icon: 'Truck',
    color: 'bg-purple-500',
    colorLight: 'bg-purple-50',
    colorText: 'text-purple-700',
    colorBorder: 'border-purple-200',
    defaultCalculations: [
      { name: 'Brick Lifting', calc_type: 'quantity' },
      { name: 'Money Account', calc_type: 'money' },
    ],
  },
  sordar: {
    id: 'sordar',
    name: 'Sordar Hisab',
    nameBn: 'Sordar Hisab',
    icon: 'UserCheck',
    color: 'bg-teal-500',
    colorLight: 'bg-teal-50',
    colorText: 'text-teal-700',
    colorBorder: 'border-teal-200',
    defaultCalculations: [
      { name: 'Money Account', calc_type: 'money' },
    ],
  },
  ita_khola: {
    id: 'ita_khola',
    name: 'Ita Khola Hisab',
    nameBn: 'Ita Khola Hisab',
    icon: 'Pickaxe',
    color: 'bg-rose-500',
    colorLight: 'bg-rose-50',
    colorText: 'text-rose-700',
    colorBorder: 'border-rose-200',
    defaultCalculations: [
      { name: 'Brick Opening', calc_type: 'quantity' },
      { name: 'Money Account', calc_type: 'money' },
    ],
  },
}

// Transaction type labels in English
export const TRANSACTION_TYPES = {
  i_will_receive: {
    label: 'I Will Receive',
    shortLabel: 'Receive',
    labelEn: 'I Will Receive',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100/70 text-emerald-800',
  },
  they_paid_me: {
    label: 'They Paid Me',
    shortLabel: 'Received',
    labelEn: 'They Paid Me',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100/70 text-blue-800',
  },
  i_paid_them: {
    label: 'I Paid Them',
    shortLabel: 'Paid',
    labelEn: 'I Paid Them',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100/70 text-amber-800',
  },
  i_have_to_pay: {
    label: 'I Have To Pay',
    shortLabel: 'Payable',
    labelEn: 'I Have To Pay',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    badge: 'bg-rose-100/70 text-rose-800',
  },
}

// Format number for display
export function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return Number(num).toLocaleString('en-IN')
}

// Format currency
export function formatCurrency(num) {
  if (num === null || num === undefined) return '₹0'
  return `₹${Number(num).toLocaleString('en-IN')}`
}

// Format date for display
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Format date for short display
export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

// Get today's date in YYYY-MM-DD format
export function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

// Get balance status info
export function getBalanceStatus(balance) {
  if (balance > 0) {
    return {
      label: 'I Will Receive',
      shortLabel: 'Will Receive',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
    }
  } else if (balance < 0) {
    return {
      label: 'I Have To Pay',
      shortLabel: 'Have To Pay',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      badge: 'bg-rose-100/80 text-rose-800 border-rose-200',
    }
  }
  return {
    label: 'Settled',
    shortLabel: 'Settled',
    color: 'text-neutral-600',
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
    dot: 'bg-neutral-400',
    badge: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  }
}

// Calculation type labels
export const CALC_TYPE_LABELS = {
  quantity: { label: 'Quantity', labelEn: 'Quantity' },
  money: { label: 'Money', labelEn: 'Money' },
}

// Helper to get calendar week (Monday to Sunday) for any date string 'YYYY-MM-DD'
export function getCalendarWeekRange(dateStr) {
  if (!dateStr) return { start: '', end: '', label: '' }
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMon = day === 0 ? -6 : 1 - day

  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)

  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)

  const toYMD = (dt) => {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const dayOfMonth = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${dayOfMonth}`
  }

  const start = toYMD(mon)
  const end = toYMD(sun)

  return {
    start,
    end,
    label: `${formatDateShort(start)} – ${formatDateShort(end)}`,
    fullLabel: `${formatDate(start)} – ${formatDate(end)}`,
  }
}

// Payment status determination for ITA Sell weeks
export function getWeeklyPaymentStatus(salesAmount, paidAmount) {
  const remaining = Math.max(0, salesAmount - paidAmount)
  if (remaining === 0 && salesAmount > 0) {
    return {
      status: 'paid',
      label: 'Paid',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    }
  }
  if (paidAmount > 0 && remaining > 0) {
    return {
      status: 'partial',
      label: 'Partially Paid',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
      textColor: 'text-amber-700',
    }
  }
  return {
    status: 'unpaid',
    label: 'Unpaid',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    textColor: 'text-rose-700',
  }
}

