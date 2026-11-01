import { supabase } from '../lib/supabase'
import { CATEGORIES } from './constants'

// ============================================
// PERSON OPERATIONS
// ============================================

export async function getPersonsByCategory(category) {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function getAllPersons() {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function getPersonById(personId) {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('id', personId)
    .single()
  return { data, error }
}

export async function createPerson(personData) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('persons')
    .insert({ ...personData, user_id: user.id })
    .select()
    .single()
  return { data, error }
}

export async function updatePerson(personId, updates) {
  const { data, error } = await supabase
    .from('persons')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', personId)
    .select()
    .single()
  return { data, error }
}

export async function searchPersons(query, category = null) {
  let q = supabase
    .from('persons')
    .select('*')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
  if (category) {
    q = q.eq('category', category)
  }
  const { data, error } = await q.order('name')
  return { data, error }
}

// ============================================
// CALCULATION OPERATIONS
// ============================================

export async function getCalculationsByPerson(personId) {
  const { data, error } = await supabase
    .from('calculations')
    .select('*')
    .eq('person_id', personId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return { data, error }
}

export async function createCalculation(calcData) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('calculations')
    .insert({ ...calcData, user_id: user.id })
    .select()
    .single()
  return { data, error }
}

export async function updateCalculation(calcId, updates) {
  const { data, error } = await supabase
    .from('calculations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', calcId)
    .select()
    .single()
  return { data, error }
}

export async function deleteCalculation(calcId) {
  const { data, error } = await supabase
    .from('calculations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', calcId)
    .select()
    .single()
  return { data, error }
}

export async function createDefaultCalculations(personId, category) {
  const { data: { user } } = await supabase.auth.getUser()
  const categoryConfig = CATEGORIES[category]
  if (!categoryConfig) return { data: null, error: new Error('Invalid category') }

  const calcs = categoryConfig.defaultCalculations.map((c, idx) => ({
    person_id: personId,
    user_id: user.id,
    name: c.name,
    calc_type: c.calc_type,
    sort_order: idx,
  }))

  const { data, error } = await supabase
    .from('calculations')
    .insert(calcs)
    .select()
  return { data, error }
}

// ============================================
// ENTRY OPERATIONS
// ============================================

export async function getEntriesByCalculation(calculationId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('calculation_id', calculationId)
    .eq('is_deleted', false)
    .order('entry_date', { ascending: true })
    .order('created_at', { ascending: true })
  return { data, error }
}

export async function getEntriesByPerson(personId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*, calculations(name, calc_type)')
    .eq('person_id', personId)
    .eq('is_deleted', false)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function createEntry(entryData) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('entries')
    .insert({ ...entryData, user_id: user.id })
    .select()
    .single()
  return { data, error }
}

export async function updateEntry(entryId, updates) {
  const { data, error } = await supabase
    .from('entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single()
  return { data, error }
}

export async function softDeleteEntry(entryId) {
  const { data, error } = await supabase
    .from('entries')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single()
  return { data, error }
}

// ============================================
// FINANCIAL SUMMARY
// ============================================

export async function getPersonFinancialSummary(personId) {
  const { data, error } = await supabase.rpc('get_person_financial_summary', {
    p_person_id: personId,
  })
  if (error) {
    // Fallback: calculate from entries
    const { data: entries } = await supabase
      .from('entries')
      .select('*, calculations!inner(calc_type)')
      .eq('person_id', personId)
      .eq('is_deleted', false)
      .eq('calculations.calc_type', 'money')

    if (!entries) return { data: null, error }

    const summary = {
      total_receivable: 0,
      total_received: 0,
      total_payable: 0,
      total_paid: 0,
      net_balance: 0,
    }

    entries.forEach((e) => {
      const amt = Number(e.amount) || 0
      switch (e.transaction_type) {
        case 'i_will_receive': summary.total_receivable += amt; break
        case 'they_paid_me': summary.total_received += amt; break
        case 'i_paid_them': summary.total_paid += amt; break
        case 'i_have_to_pay': summary.total_payable += amt; break
      }
    })

    summary.net_balance = (summary.total_receivable - summary.total_received) - (summary.total_payable - summary.total_paid)
    return { data: [summary], error: null }
  }
  return { data, error }
}

// ============================================
// QUANTITY SUMMARY
// ============================================

export async function getPersonQuantitySummary(personId) {
  const { data: entries, error } = await supabase
    .from('entries')
    .select('quantity, calculations!inner(name, calc_type)')
    .eq('person_id', personId)
    .eq('is_deleted', false)
    .eq('calculations.calc_type', 'quantity')

  if (error || !entries) return { data: null, error }

  const totals = {}
  entries.forEach((e) => {
    const name = e.calculations.name
    if (!totals[name]) totals[name] = 0
    totals[name] += Number(e.quantity) || 0
  })

  return { data: totals, error: null }
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getCategoryStats() {
  const { data: persons, error: pError } = await supabase
    .from('persons')
    .select('id, category')
    .eq('is_active', true)

  if (pError) return { data: null, error: pError }

  const stats = {}
  Object.keys(CATEGORIES).forEach((cat) => {
    stats[cat] = { personCount: 0 }
  })

  persons?.forEach((p) => {
    if (stats[p.category]) {
      stats[p.category].personCount++
    }
  })

  return { data: stats, error: null }
}

export async function getRecentEntries(limit = 10) {
  const { data, error } = await supabase
    .from('entries')
    .select('*, calculations(name, calc_type), persons(name, category)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data, error }
}

// ============================================
// EXPORT OPERATIONS
// ============================================

export async function exportPersonData(personId) {
  const { data: person } = await getPersonById(personId)
  const { data: entries } = await getEntriesByPerson(personId)
  const { data: calculations } = await getCalculationsByPerson(personId)

  return { person, calculations, entries }
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

// ============================================
// AUDIT LOGS
// ============================================

export async function getAuditLogs(recordId = null, limit = 50) {
  let q = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (recordId) {
    q = q.eq('record_id', recordId)
  }

  const { data, error } = await q
  return { data, error }
}
