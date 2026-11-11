import { supabase } from '../lib/supabase'
import { CATEGORIES, getCalendarWeekRange } from './constants'

export function isTableMissingError(error) {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  const code = String(error.code || '')
  const status = Number(error.status || error.statusCode || 0)
  return (
    code === 'OFFLINE' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '57014' ||
    status === 522 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 404 ||
    status === 0 ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('relation') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('522') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('doctype') ||
    msg.includes('unexpected token') ||
    msg.includes('aborterror') ||
    msg.includes('typeerror') ||
    msg.includes('connection timed out')
  )
}

// Timeout helper: prevents UI from freezing for 30-60s when Supabase is in 522/paused state
export function withTimeout(promise, ms = 10000) {
  let timeoutId
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Database request timed out after ${ms}ms`)),
        ms
      )
    }),
  ]).finally(() => clearTimeout(timeoutId))
}

// Global flag to track whether tables are missing
let _tablesMissingDetected = false
const listeners = new Set()

export function subscribeDbStatus(fn) {
  listeners.add(fn)
  fn(_tablesMissingDetected)
  return () => listeners.delete(fn)
}

function notifyDbStatus(isMissing) {
  _tablesMissingDetected = isMissing
  listeners.forEach((fn) => fn(isMissing))
}

export function reportDatabaseStatus(unavailable) {
  notifyDbStatus(unavailable)
}

// Query Supabase only; business data is never read from browser storage.
export async function safeDbQuery(queryPromise) {
  try {
    const result = await withTimeout(queryPromise)
    if (result.error) notifyDbStatus(true)
    return result
  } catch (err) {
    notifyDbStatus(true)
    return { data: null, error: err }
  }
}

// Check database connection and schema
export async function checkDatabaseSchema() {
  try {
    const tableChecks = await Promise.all([
      supabase.from('persons').select('id').limit(1),
      supabase.from('calculations').select('id').limit(1),
      supabase.from('entries').select('id').limit(1),
      supabase.from('ita_sales').select('id').limit(1),
      supabase.from('ita_payments').select('id').limit(1),
      supabase.from('app_settings').select('id').limit(1),
    ].map((query) => withTimeout(query)))
    const error = tableChecks.find((result) => result.error)?.error
    if (error) {
      notifyDbStatus(true)
      return { ready: false, error }
    }

    notifyDbStatus(false)
    return { ready: true, error: null }
  } catch (err) {
    notifyDbStatus(true)
    return { ready: false, error: err }
  }
}

// ============================================
// PERSON OPERATIONS
// ============================================

export async function getPersonsByCategory(category) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('persons')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
  )
  return { data: error ? [] : data || [], error }
}

export async function getAllPersons() {
  const { data, error } = await safeDbQuery(
    supabase
      .from('persons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
  )
  return { data: error ? [] : data || [], error }
}

export async function getPersonById(personId) {
  const { data, error } = await safeDbQuery(
    supabase.from('persons').select('*').eq('id', personId).maybeSingle()
  )
  return { data: error ? null : data, error }
}

export async function createPerson(personData) {
  // Clean person data - address is not required
  const cleaned = {
    name: personData.name,
    category: personData.category,
    phone: personData.phone || null,
    address: null,
    is_active: true,
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return { data: null, error: authError || new Error('Please sign in to save data.') }
    }

    const { data, error } = await withTimeout(supabase
      .from('persons')
      .insert({ ...cleaned, user_id: authData.user.id })
      .select()
      .single())

    if (error) throw error

    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function updatePerson(personId, updates) {
  try {
    const { data, error } = await supabase
      .from('persons')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', personId)
      .select()
      .single()

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Person was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function searchPersons(query, category = null) {
  const qLower = (query || '').toLowerCase().trim()
  if (!qLower) return { data: [], error: null }

  try {
    let nameQuery = supabase.from('persons').select('*').eq('is_active', true)
      .ilike('name', `%${query.trim()}%`)
    let phoneQuery = supabase.from('persons').select('*').eq('is_active', true)
      .ilike('phone', `%${query.trim()}%`)
    if (category) {
      nameQuery = nameQuery.eq('category', category)
      phoneQuery = phoneQuery.eq('category', category)
    }
    const [nameResult, phoneResult] = await Promise.all([
      safeDbQuery(nameQuery.order('name')),
      safeDbQuery(phoneQuery.order('name')),
    ])

    const error = nameResult.error || phoneResult.error
    if (error) return { data: [], error }

    const remoteById = new Map()
    for (const person of [...(nameResult.data || []), ...(phoneResult.data || [])]) {
      remoteById.set(person.id, person)
    }
    return { data: [...remoteById.values()], error: null }
  } catch (error) {
    notifyDbStatus(true)
    return { data: [], error }
  }
}

// ============================================
// CALCULATION OPERATIONS
// ============================================

export async function getCalculationsByPerson(personId) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('calculations')
      .select('*')
      .eq('person_id', personId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  )
  return { data: error ? [] : data || [], error }
}

export async function createCalculation(calcData) {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return { data: null, error: authError || new Error('Please sign in to save data.') }
    }

    const { data, error } = await withTimeout(supabase
      .from('calculations')
      .insert({ ...calcData, user_id: authData.user.id })
      .select()
      .single())

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function updateCalculation(calcId, updates) {
  try {
    const { data, error } = await supabase
      .from('calculations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', calcId)
      .select()
      .single()

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Calculation was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function deleteCalculation(calcId) {
  try {
    const { data, error } = await supabase
      .from('calculations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', calcId)
      .select()
      .single()

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Calculation was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function createDefaultCalculations(personId, category) {
  const categoryConfig = CATEGORIES[category]
  if (!categoryConfig) return { data: null, error: new Error('Invalid category') }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return { data: null, error: authError || new Error('Please sign in to save data.') }
  }
  const userId = authData.user.id

  const calcs = categoryConfig.defaultCalculations.map((c, idx) => ({
    person_id: personId,
    user_id: userId,
    name: c.name,
    calc_type: c.calc_type,
    sort_order: idx,
    is_active: true,
  }))

  try {
    const { data, error } = await withTimeout(supabase
      .from('calculations')
      .insert(calcs)
      .select()
    )

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

// ============================================
// ENTRY OPERATIONS
// ============================================

export async function getEntriesByCalculation(calculationId) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('entries')
      .select('*')
      .eq('calculation_id', calculationId)
      .eq('is_deleted', false)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true })
  )
  return { data: error ? [] : data || [], error }
}

export async function getEntriesByPerson(personId) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('entries')
      .select('*, calculations(name, calc_type)')
      .eq('person_id', personId)
      .eq('is_deleted', false)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return { data: error ? [] : data || [], error }
}

export async function createEntry(entryData) {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return { data: null, error: authError || new Error('Please sign in to save data.') }
    }

    const { data, error } = await withTimeout(supabase
      .from('entries')
      .insert({ ...entryData, user_id: authData.user.id })
      .select()
      .single())

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function updateEntry(entryId, updates) {
  try {
    const { data, error } = await supabase
      .from('entries')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single()

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Entry was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function softDeleteEntry(entryId) {
  try {
    const { data, error } = await supabase
      .from('entries')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single()

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Entry was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

// ============================================
// FINANCIAL SUMMARY
// ============================================

export async function getPersonFinancialSummary(personId) {
  const { data, error } = await safeDbQuery(
    supabase.rpc('get_person_financial_summary', { p_person_id: personId })
  )
  if (!error && data?.length) return { data, error: null }

  const { data: entries, error: entriesError } = await getEntriesByPerson(personId)
  if (entriesError) return { data: null, error: entriesError }
  const summary = (entries || []).reduce((totals, entry) => {
    const amount = Number(entry.amount) || 0
    switch (entry.transaction_type) {
      case 'i_will_receive':
        totals.total_receivable += amount
        break
      case 'they_paid_me':
        totals.total_received += amount
        break
      case 'i_paid_them':
        totals.total_paid += amount
        break
      case 'i_have_to_pay':
        totals.total_payable += amount
        break
    }
    return totals
  }, {
    total_receivable: 0,
    total_received: 0,
    total_payable: 0,
    total_paid: 0,
    net_balance: 0,
  })
  summary.net_balance = summary.total_receivable - summary.total_received -
    (summary.total_payable - summary.total_paid)
  return { data: [summary], error: null }
}

// ============================================
// QUANTITY SUMMARY
// ============================================

export async function getPersonQuantitySummary(personId) {
  const { data: entries, error } = await getEntriesByPerson(personId)
  if (error) return { data: null, error }
  const totals = {}
  ;(entries || []).forEach((entry) => {
    if (entry.quantity) {
      const name = entry.calculations?.name || 'Quantity'
      totals[name] = (totals[name] || 0) + (Number(entry.quantity) || 0)
    }
  })
  return { data: totals, error: null }
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getCategoryStats() {
  const { data: persons, error } = await getAllPersons()
  if (error) return { data: null, error }
  const stats = Object.fromEntries(
    Object.keys(CATEGORIES).map((category) => [category, { personCount: 0 }])
  )
  persons.forEach((person) => {
    if (stats[person.category]) stats[person.category].personCount++
  })
  return { data: stats, error: null }
}

export async function getRecentEntries(limit = 10) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('entries')
      .select('*, calculations(name, calc_type), persons(name, category)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)
  )
  return { data: error ? [] : data || [], error }
}

// ============================================
// EXPORT & SYNC OPERATIONS
// ============================================

export async function exportPersonData(personId) {
  const [personResult, entriesResult, calculationsResult] = await Promise.all([
    getPersonById(personId),
    getEntriesByPerson(personId),
    getCalculationsByPerson(personId),
  ])
  const error = personResult.error || entriesResult.error || calculationsResult.error
  if (error) return { person: null, calculations: null, entries: null, error }
  return {
    person: personResult.data,
    calculations: calculationsResult.data,
    entries: entriesResult.data,
    error: null,
  }
}

export function generateCSV(entries, personName) {
  if (!entries || entries.length === 0) return ''
  const headers = ['Date,Calculation,Type,Quantity,Amount,Transaction Type,Description']
  const rows = entries.map((e) => {
    const calcName = e.calculations?.name || ''
    const calcType = e.calculations?.calc_type || ''
    const qty = e.quantity || ''
    const amt = e.amount || ''
    const txType = e.transaction_type || ''
    const desc = (e.description || '').replace(/,/g, ';')
    return `${e.entry_date},${calcName},${calcType},${qty},${amt},${txType},${desc}`
  })
  return [headers, ...rows].join('\n')
}

export function generateItaSellCSV(sales, payments, personName) {
  const sections = []

  // Sales Section
  sections.push(`--- ITA SALES ---`)
  sections.push('Date,Week Start,Week End,Quantity (pcs),Rate per 1000,Sales Amount,Note')
  if (sales && sales.length > 0) {
    sales.forEach((s) => {
      const note = (s.note || '').replace(/,/g, ';')
      sections.push(`${s.sale_date},${s.week_start_date},${s.week_end_date},${s.quantity},${s.rate_per_thousand},${s.sales_amount},${note}`)
    })
  } else {
    sections.push('No sales recorded')
  }

  sections.push('')

  // Payments Section
  sections.push(`--- PAYMENTS RECEIVED ---`)
  sections.push('Date,Allocated Week Start,Allocated Week End,Amount,Note')
  if (payments && payments.length > 0) {
    payments.forEach((p) => {
      const note = (p.note || '').replace(/,/g, ';')
      sections.push(`${p.payment_date},${p.week_start_date},${p.week_end_date},${p.amount},${note}`)
    })
  } else {
    sections.push('No payments recorded')
  }

  return sections.join('\n')
}

// ============================================
// ITA SALES & PAYMENTS OPERATIONS
// ============================================

export async function getItaSalesByPerson(personId) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('ita_sales')
      .select('*')
      .eq('person_id', personId)
      .eq('is_deleted', false)
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return { data: error ? [] : data || [], error }
}

export async function createItaSale(saleData) {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return { data: null, error: authError || new Error('Please sign in to save data.') }
    }

    const weekRange = getCalendarWeekRange(saleData.sale_date)
    const payload = {
      ...saleData,
      user_id: authData.user.id,
      week_start_date: saleData.week_start_date || weekRange.start,
      week_end_date: saleData.week_end_date || weekRange.end,
    }

    const { data, error } = await withTimeout(supabase
      .from('ita_sales')
      .insert(payload)
      .select()
      .single())

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function updateItaSale(saleId, updates) {
  try {
    let extra = {}
    if (updates.sale_date) {
      const weekRange = getCalendarWeekRange(updates.sale_date)
      extra.week_start_date = weekRange.start
      extra.week_end_date = weekRange.end
    }

    const { data, error } = await withTimeout(supabase
      .from('ita_sales')
      .update({ ...updates, ...extra, updated_at: new Date().toISOString() })
      .eq('id', saleId)
      .select()
      .single())

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Sale was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function softDeleteItaSale(saleId) {
  try {
    const { data, error } = await withTimeout(supabase
      .from('ita_sales')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', saleId)
      .select()
      .single())

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Sale was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function getItaPaymentsByPerson(personId) {
  const { data, error } = await safeDbQuery(
    supabase
      .from('ita_payments')
      .select('*')
      .eq('person_id', personId)
      .eq('is_deleted', false)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return { data: error ? [] : data || [], error }
}

export async function createItaPayment(paymentData) {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return { data: null, error: authError || new Error('Please sign in to save data.') }
    }

    const payload = {
      ...paymentData,
      user_id: authData.user.id,
    }

    const { data, error } = await withTimeout(supabase
      .from('ita_payments')
      .insert(payload)
      .select()
      .single())

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function updateItaPayment(paymentId, updates) {
  try {
    const { data, error } = await withTimeout(supabase
      .from('ita_payments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .select()
      .single())

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Payment was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}

export async function softDeleteItaPayment(paymentId) {
  try {
    const { data, error } = await withTimeout(supabase
      .from('ita_payments')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .select()
      .single())

    if (error) {
      if (isTableMissingError(error)) notifyDbStatus(true)
      return { data: null, error }
    }
    return data
      ? { data, error: null }
      : { data: null, error: new Error('Payment was not found in the database.') }
  } catch (err) {
    if (isTableMissingError(err)) notifyDbStatus(true)
    return { data: null, error: err }
  }
}
