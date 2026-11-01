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
      { name: 'Other Materials', calc_type: 'quantity' },
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
  i_will_receive: { label: 'I Will Receive', labelEn: 'I Will Receive', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  they_paid_me: { label: 'They Paid Me', labelEn: 'They Paid Me', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  i_paid_them: { label: 'I Paid Them', labelEn: 'I Paid Them', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  i_have_to_pay: { label: 'I Have To Pay', labelEn: 'I Have To Pay', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
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
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-300',
    }
  } else if (balance < 0) {
    return {
      label: 'I Have To Pay',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-300',
    }
  }
  return {
    label: 'Settled',
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
  }
}

// Calculation type labels
export const CALC_TYPE_LABELS = {
  quantity: { label: 'Quantity', labelEn: 'Quantity' },
  money: { label: 'Money', labelEn: 'Money' },
}
