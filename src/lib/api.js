import { supabase } from '../lib/supabase'
import { CATEGORIES, getCalendarWeekRange } from './constants'

// Storage helpers for fallback mode (when Supabase tables aren't migrated yet or offline)
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

function getActiveUserId() {
  try {
    const offline = localStorage.getItem('ita_offline_user')
    if (offline) {
      const parsed = JSON.parse(offline)
      if (parsed?.is_offline === true && parsed.id) return parsed.id
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const parsed = JSON.parse(localStorage.getItem(key))
        if (parsed?.user?.id) return parsed.user.id
      }
    }
    if (offline) {
      const parsed = JSON.parse(offline)
      if (parsed?.id) return parsed.id
    }
  } catch {
    // fallback
  }
  return 'default_user'
}

function isOfflineSession() {
  try {
    return JSON.parse(localStorage.getItem('ita_offline_user') || 'null')?.is_offline === true
  } catch {
    return false
  }
}

function getLocalData(key) {
  try {
    const uid = getActiveUserId()
    const primaryKey = `${key}_${uid}`
    const raw = localStorage.getItem(primaryKey)
    if (raw) return JSON.parse(raw)

    // Older versions also copied signed-in users' cache into this shared key.
    const legacy = localStorage.getItem(`${key}_default_user`)
    if (!legacy) return []
    const parsed = JSON.parse(legacy)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record) => record.user_id === uid || uid === 'default_user')
  } catch {
    return []
  }
}

function getPersonIdAliases() {
  try {
    return JSON.parse(localStorage.getItem(`ita_person_id_aliases_${getActiveUserId()}`) || '{}')
  } catch {
    return {}
  }
}

function resolvePersonId(personId) {
  return getPersonIdAliases()[personId] || personId
}

function savePersonIdAlias(localId, remoteId) {
  const aliases = getPersonIdAliases()
  aliases[localId] = remoteId
  localStorage.setItem(`ita_person_id_aliases_${getActiveUserId()}`, JSON.stringify(aliases))
}

function saveLocalRecord(storageKey, idPrefix, recordData, defaults = {}) {
  const timestamp = new Date().toISOString()
  const record = {
    id: `${idPrefix}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...recordData,
    ...defaults,
    user_id: getActiveUserId(),
    created_at: timestamp,
    updated_at: timestamp,
  }
  const records = getLocalData(storageKey)
  records.push(record)
  setLocalData(storageKey, records)
  return { data: record, error: null, localFallback: true }
}

function setLocalData(key, data) {
  try {
    const uid = getActiveUserId()
    localStorage.setItem(`${key}_${uid}`, JSON.stringify(data))
  } catch (err) {
    console.error('Local storage write error:', err)
    throw err
  }
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

// Helper to query with timeout and automatic fallback when Supabase is down
export async function safeDbQuery(queryPromise) {
  if (isOfflineSession()) {
    notifyDbStatus(true)
    return {
      data: null,
      error: { message: 'This session is using device-local storage', code: 'OFFLINE' },
    }
  }

  try {
    const result = await withTimeout(queryPromise)
    notifyDbStatus(Boolean(result.error && isTableMissingError(result.error)))
    return result
  } catch (err) {
    notifyDbStatus(true)
    return { data: null, error: err }
  }
}

function mergePendingRecords(remoteRecords, localRecords, idPrefix, predicate = () => true) {
  const ids = new Set(remoteRecords.map((record) => record.id))
  const pending = localRecords.filter(
    (record) => record.id?.startsWith(idPrefix) && !ids.has(record.id) && predicate(record)
  )
  return [...remoteRecords, ...pending]
}

// Check database connection and schema
export async function checkDatabaseSchema() {
  try {
    const { error } = await withTimeout(supabase.from('persons').select('id').limit(1))
    if (isTableMissingError(error)) {
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
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('persons')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('persons')
      const filtered = local.filter((p) => p.category === category && p.is_active !== false)
      return { data: filtered, error: null }
    }

    if (!error && data) {
      notifyDbStatus(false)
      const local = getLocalData('persons')
      return {
        data: mergePendingRecords(
          data,
          local,
          'local_',
          (person) => person.category === category && person.is_active !== false
        ),
        error: null,
      }
    }

    // fallback
    const local = getLocalData('persons')
    const filtered = local.filter((p) => p.category === category && p.is_active !== false)
    return { data: filtered, error: null }
  } catch (err) {
    const local = getLocalData('persons')
    const filtered = local.filter((p) => p.category === category && p.is_active !== false)
    return { data: filtered, error: null }
  }
}

export async function getAllPersons() {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('persons')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('persons').filter((p) => p.is_active !== false)
      return { data: local, error: null }
    }

    if (!error && data) {
      notifyDbStatus(false)
      const local = getLocalData('persons')
      return {
        data: mergePendingRecords(
          data,
          local,
          'local_',
          (person) => person.is_active !== false
        ),
        error: null,
      }
    }

    const local = getLocalData('persons').filter((p) => p.is_active !== false)
    return { data: local, error: null }
  } catch {
    const local = getLocalData('persons').filter((p) => p.is_active !== false)
    return { data: local, error: null }
  }
}

export async function getPersonById(personId) {
  try {
    const resolvedId = resolvePersonId(personId)
    const { data, error } = await safeDbQuery(
      supabase
        .from('persons')
        .select('*')
        .eq('id', resolvedId)
        .single()
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('persons')
      const found = local.find((p) => p.id === resolvedId || p.id === personId)
      return { data: found || null, error: null }
    }

    if (data) return { data, error: null }

    const local = getLocalData('persons')
    const found = local.find((p) => p.id === resolvedId || p.id === personId)
    return { data: found || null, error: null }
  } catch {
    const local = getLocalData('persons')
    const resolvedId = resolvePersonId(personId)
    const found = local.find((p) => p.id === resolvedId || p.id === personId)
    return { data: found || null, error: null }
  }
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

  if (isOfflineSession()) {
    return saveLocalRecord('persons', 'local_', cleaned)
  }

  try {
    const { data: authData } = isOfflineSession()
      ? { data: { user: null } }
      : await supabase.auth.getUser()
    const userId = authData?.user?.id || getActiveUserId()

    const { data, error } = await withTimeout(supabase
      .from('persons')
      .insert({ ...cleaned, user_id: userId })
      .select()
      .single())

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      // Save locally so the user is NOT blocked!
      const newPerson = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        user_id: userId,
        ...cleaned,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('persons')
      local.unshift(newPerson)
      setLocalData('persons', local)
      return { data: newPerson, error: null, localFallback: true }
    }

    if (error) {
      // If error is not schema missing, also check if local save makes sense
      throw error
    }

    notifyDbStatus(false)
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) {
      notifyDbStatus(true)
      const userId = getActiveUserId()
      const newPerson = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        user_id: userId,
        ...cleaned,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('persons')
      local.unshift(newPerson)
      setLocalData('persons', local)
      return { data: newPerson, error: null, localFallback: true }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('persons')
      const idx = local.findIndex((p) => p.id === personId)
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
        setLocalData('persons', local)
        return { data: local[idx], error: null }
      }
    }

    if (data) return { data, error: null }

    const local = getLocalData('persons')
    const idx = local.findIndex((p) => p.id === personId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('persons', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    const local = getLocalData('persons')
    const idx = local.findIndex((p) => p.id === personId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('persons', local)
      return { data: local[idx], error: null }
    }
    return { data: null, error: err }
  }
}

export async function searchPersons(query, category = null) {
  const qLower = (query || '').toLowerCase().trim()
  if (!qLower) return { data: [], error: null }

  const matchesLocal = (person) =>
    person.is_active !== false &&
    (!category || person.category === category) &&
    (person.name?.toLowerCase().includes(qLower) ||
      String(person.phone || '').includes(query.trim()))

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

    if (
      (nameResult.error && isTableMissingError(nameResult.error)) ||
      (phoneResult.error && isTableMissingError(phoneResult.error))
    ) {
      notifyDbStatus(true)
      const local = getLocalData('persons').filter(matchesLocal)
      return { data: local, error: null }
    }

    const remoteById = new Map()
    for (const person of [...(nameResult.data || []), ...(phoneResult.data || [])]) {
      remoteById.set(person.id, person)
    }
    const remote = [...remoteById.values()]
    const local = getLocalData('persons').filter(matchesLocal)
    return {
      data: mergePendingRecords(remote, local, 'local_', matchesLocal),
      error: null,
    }

  } catch {
    const local = getLocalData('persons').filter(matchesLocal)
    return { data: local, error: null }
  }
}

// ============================================
// CALCULATION OPERATIONS
// ============================================

export async function getCalculationsByPerson(personId) {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('calculations')
        .select('*')
        .eq('person_id', personId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('calculations').filter(
        (c) => c.person_id === personId && c.is_active !== false
      )
      local.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return { data: local, error: null }
    }

    if (data && data.length > 0) return { data, error: null }

    const local = getLocalData('calculations').filter(
      (c) => c.person_id === personId && c.is_active !== false
    )
    local.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return { data: (data && data.length) ? data : local, error: null }
  } catch {
    const local = getLocalData('calculations').filter(
      (c) => c.person_id === personId && c.is_active !== false
    )
    local.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return { data: local, error: null }
  }
}

export async function createCalculation(calcData) {
  if (isOfflineSession()) {
    return saveLocalRecord('calculations', 'calc_', calcData, { is_active: true })
  }

  try {
    const { data: authData } = isOfflineSession()
      ? { data: { user: null } }
      : await supabase.auth.getUser()
    const userId = authData?.user?.id || getActiveUserId()

    const { data, error } = await withTimeout(supabase
      .from('calculations')
      .insert({ ...calcData, user_id: userId })
      .select()
      .single())

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const newCalc = {
        id: 'calc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        user_id: userId,
        ...calcData,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('calculations')
      local.push(newCalc)
      setLocalData('calculations', local)
      return { data: newCalc, error: null }
    }

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) {
      notifyDbStatus(true)
      const userId = getActiveUserId()
      const newCalc = {
        id: 'calc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        user_id: userId,
        ...calcData,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('calculations')
      local.push(newCalc)
      setLocalData('calculations', local)
      return { data: newCalc, error: null }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('calculations')
      const idx = local.findIndex((c) => c.id === calcId)
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
        setLocalData('calculations', local)
        return { data: local[idx], error: null }
      }
    }

    if (data) return { data, error: null }

    const local = getLocalData('calculations')
    const idx = local.findIndex((c) => c.id === calcId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('calculations', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('calculations')
      const idx = local.findIndex((c) => c.id === calcId)
      if (idx !== -1) {
        local[idx].is_active = false
        setLocalData('calculations', local)
        return { data: local[idx], error: null }
      }
    }

    if (data) return { data, error: null }

    const local = getLocalData('calculations')
    const idx = local.findIndex((c) => c.id === calcId)
    if (idx !== -1) {
      local[idx].is_active = false
      setLocalData('calculations', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function createDefaultCalculations(personId, category) {
  const categoryConfig = CATEGORIES[category]
  if (!categoryConfig) return { data: null, error: new Error('Invalid category') }

  const { data: authData } = isOfflineSession()
    ? { data: { user: null } }
    : await supabase.auth.getUser()
  const userId = authData?.user?.id || getActiveUserId()

  const calcs = categoryConfig.defaultCalculations.map((c, idx) => ({
    person_id: personId,
    user_id: userId,
    name: c.name,
    calc_type: c.calc_type,
    sort_order: idx,
    is_active: true,
  }))

  if (isOfflineSession()) {
    const timestamp = new Date().toISOString()
    const localCalcs = calcs.map((calc, index) => ({
      ...calc,
      id: `calc_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 5)}`,
      created_at: timestamp,
      updated_at: timestamp,
    }))
    const local = getLocalData('calculations')
    local.push(...localCalcs)
    setLocalData('calculations', local)
    return { data: localCalcs, error: null, localFallback: true }
  }

  try {
    const { data, error } = await withTimeout(supabase
      .from('calculations')
      .insert(calcs)
      .select()
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const localCalcs = calcs.map((c, i) => ({
        id: 'calc_' + Date.now() + '_' + i,
        ...c,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      const local = getLocalData('calculations')
      local.push(...localCalcs)
      setLocalData('calculations', local)
      return { data: localCalcs, error: null }
    }

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) {
      notifyDbStatus(true)
      const localCalcs = calcs.map((c, i) => ({
        id: 'calc_' + Date.now() + '_' + i,
        ...c,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      const local = getLocalData('calculations')
      local.push(...localCalcs)
      setLocalData('calculations', local)
      return { data: localCalcs, error: null }
    }
    return { data: null, error: err }
  }
}

// ============================================
// ENTRY OPERATIONS
// ============================================

export async function getEntriesByCalculation(calculationId) {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('entries')
        .select('*')
        .eq('calculation_id', calculationId)
        .eq('is_deleted', false)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('entries').filter(
        (e) => e.calculation_id === calculationId && e.is_deleted !== true
      )
      local.sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date))
      return { data: local, error: null }
    }

    if (data) return { data, error: null }

    const local = getLocalData('entries').filter(
      (e) => e.calculation_id === calculationId && e.is_deleted !== true
    )
    local.sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date))
    return { data: local, error: null }
  } catch {
    const local = getLocalData('entries').filter(
      (e) => e.calculation_id === calculationId && e.is_deleted !== true
    )
    local.sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date))
    return { data: local, error: null }
  }
}

export async function getEntriesByPerson(personId) {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('entries')
        .select('*, calculations(name, calc_type)')
        .eq('person_id', personId)
        .eq('is_deleted', false)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const localEntries = getLocalData('entries').filter(
        (e) => e.person_id === personId && e.is_deleted !== true
      )
      const localCalcs = getLocalData('calculations')
      const enriched = localEntries.map((e) => {
        const c = localCalcs.find((calc) => calc.id === e.calculation_id)
        return {
          ...e,
          calculations: c ? { name: c.name, calc_type: c.calc_type } : null,
        }
      })
      enriched.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
      return { data: enriched, error: null }
    }

    if (data) return { data, error: null }

    const localEntries = getLocalData('entries').filter(
      (e) => e.person_id === personId && e.is_deleted !== true
    )
    const localCalcs = getLocalData('calculations')
    const enriched = localEntries.map((e) => {
      const c = localCalcs.find((calc) => calc.id === e.calculation_id)
      return {
        ...e,
        calculations: c ? { name: c.name, calc_type: c.calc_type } : null,
      }
    })
    enriched.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
    return { data: enriched, error }
  } catch (error) {
    const localEntries = getLocalData('entries').filter(
      (e) => e.person_id === personId && e.is_deleted !== true
    )
    const localCalcs = getLocalData('calculations')
    const enriched = localEntries.map((e) => {
      const c = localCalcs.find((calc) => calc.id === e.calculation_id)
      return {
        ...e,
        calculations: c ? { name: c.name, calc_type: c.calc_type } : null,
      }
    })
    enriched.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
    return { data: enriched, error, localFallback: true }
  }
}

export async function createEntry(entryData) {
  try {
    const { data: authData } = isOfflineSession()
      ? { data: { user: null } }
      : await supabase.auth.getUser()
    const userId = authData?.user?.id || getActiveUserId()

    if (isOfflineSession()) {
      return saveLocalRecord('entries', 'entry_', entryData, { is_deleted: false })
    }

    const { data, error } = await withTimeout(supabase
      .from('entries')
      .insert({ ...entryData, user_id: userId })
      .select()
      .single())

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const newEntry = {
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        user_id: userId,
        ...entryData,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('entries')
      local.push(newEntry)
      setLocalData('entries', local)
      return { data: newEntry, error: null }
    }

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) {
      notifyDbStatus(true)
      const userId = getActiveUserId()
      const newEntry = {
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        user_id: userId,
        ...entryData,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('entries')
      local.push(newEntry)
      setLocalData('entries', local)
      return { data: newEntry, error: null }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('entries')
      const idx = local.findIndex((e) => e.id === entryId)
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
        setLocalData('entries', local)
        return { data: local[idx], error: null }
      }
    }

    if (data) return { data, error: null }

    const local = getLocalData('entries')
    const idx = local.findIndex((e) => e.id === entryId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('entries', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    const local = getLocalData('entries')
    const idx = local.findIndex((e) => e.id === entryId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('entries', local)
      return { data: local[idx], error: null }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('entries')
      const idx = local.findIndex((e) => e.id === entryId)
      if (idx !== -1) {
        local[idx].is_deleted = true
        setLocalData('entries', local)
        return { data: local[idx], error: null }
      }
    }

    if (data) return { data, error: null }

    const local = getLocalData('entries')
    const idx = local.findIndex((e) => e.id === entryId)
    if (idx !== -1) {
      local[idx].is_deleted = true
      setLocalData('entries', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    const local = getLocalData('entries')
    const idx = local.findIndex((e) => e.id === entryId)
    if (idx !== -1) {
      local[idx].is_deleted = true
      setLocalData('entries', local)
      return { data: local[idx], error: null }
    }
    return { data: null, error: err }
  }
}

// ============================================
// FINANCIAL SUMMARY
// ============================================

export async function getPersonFinancialSummary(personId) {
  try {
    const { data, error } = await safeDbQuery(
      supabase.rpc('get_person_financial_summary', {
        p_person_id: personId,
      })
    )

    if (!error && data && data.length > 0) {
      return { data, error: null }
    }

    // Fallback: calculate directly from entries
    const { data: entries } = await getEntriesByPerson(personId)
    const moneyEntries = (entries || []).filter(
      (e) => e.calculations?.calc_type === 'money' || e.amount
    )

    const summary = {
      total_receivable: 0,
      total_received: 0,
      total_payable: 0,
      total_paid: 0,
      net_balance: 0,
    }

    moneyEntries.forEach((e) => {
      const amt = Number(e.amount) || 0
      switch (e.transaction_type) {
        case 'i_will_receive':
          summary.total_receivable += amt
          break
        case 'they_paid_me':
          summary.total_received += amt
          break
        case 'i_paid_them':
          summary.total_paid += amt
          break
        case 'i_have_to_pay':
          summary.total_payable += amt
          break
      }
    })

    summary.net_balance =
      summary.total_receivable -
      summary.total_received -
      (summary.total_payable - summary.total_paid)

    return { data: [summary], error: null }
  } catch {
    const { data: entries } = await getEntriesByPerson(personId)
    const moneyEntries = (entries || []).filter((e) => e.amount)

    const summary = {
      total_receivable: 0,
      total_received: 0,
      total_payable: 0,
      total_paid: 0,
      net_balance: 0,
    }

    moneyEntries.forEach((e) => {
      const amt = Number(e.amount) || 0
      switch (e.transaction_type) {
        case 'i_will_receive':
          summary.total_receivable += amt
          break
        case 'they_paid_me':
          summary.total_received += amt
          break
        case 'i_paid_them':
          summary.total_paid += amt
          break
        case 'i_have_to_pay':
          summary.total_payable += amt
          break
      }
    })

    summary.net_balance =
      summary.total_receivable -
      summary.total_received -
      (summary.total_payable - summary.total_paid)

    return { data: [summary], error: null }
  }
}

// ============================================
// QUANTITY SUMMARY
// ============================================

export async function getPersonQuantitySummary(personId) {
  try {
    const { data: entries } = await getEntriesByPerson(personId)
    const totals = {}
    ;(entries || []).forEach((e) => {
      if (e.quantity) {
        const name = e.calculations?.name || 'Quantity'
        totals[name] = (totals[name] || 0) + (Number(e.quantity) || 0)
      }
    })
    return { data: totals, error: null }
  } catch {
    return { data: {}, error: null }
  }
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getCategoryStats() {
  try {
    const { data: persons } = await getAllPersons()
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
  } catch {
    const stats = {}
    Object.keys(CATEGORIES).forEach((cat) => {
      stats[cat] = { personCount: 0 }
    })
    return { data: stats, error: null }
  }
}

export async function getRecentEntries(limit = 10) {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('entries')
        .select('*, calculations(name, calc_type), persons(name, category)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit)
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const localEntries = getLocalData('entries').filter((e) => e.is_deleted !== true)
      const localPersons = getLocalData('persons')
      const localCalcs = getLocalData('calculations')

      const enriched = localEntries.map((e) => {
        const p = localPersons.find((x) => x.id === e.person_id)
        const c = localCalcs.find((x) => x.id === e.calculation_id)
        return {
          ...e,
          persons: p ? { name: p.name, category: p.category } : null,
          calculations: c ? { name: c.name, calc_type: c.calc_type } : null,
        }
      })
      enriched.sort((a, b) => new Date(b.created_at || b.entry_date) - new Date(a.created_at || a.entry_date))
      return { data: enriched.slice(0, limit), error: null }
    }

    if (data) return { data, error: null }

    const localEntries = getLocalData('entries').filter((e) => e.is_deleted !== true)
    return { data: localEntries.slice(0, limit), error: null }
  } catch {
    const localEntries = getLocalData('entries').filter((e) => e.is_deleted !== true)
    return { data: localEntries.slice(0, limit), error: null }
  }
}

// ============================================
// EXPORT & SYNC OPERATIONS
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

// Sync local data up to Supabase once tables are ready
async function performLocalDataSync() {
  const { ready } = await checkDatabaseSchema()
  if (!ready) {
    return {
      success: false,
      message: 'Supabase is unavailable or its database tables are not ready. Check the connection and migrations, then retry.',
    }
  }

  const { data: authData } = await withTimeout(supabase.auth.getUser())
  const userId = authData?.user?.id
  if (!userId) {
    return { success: false, message: 'Please log in to sync data.' }
  }

  const localPersons = getLocalData('persons')
  const localCalcs = getLocalData('calculations')
  const localEntries = getLocalData('entries')
  const localSales = getLocalData('ita_sales')
  const localPayments = getLocalData('ita_payments')

  let syncedPersons = 0
  let syncedCalcs = 0
  let syncedEntries = 0
  let syncedSales = 0
  let syncedPayments = 0
  let failedRecords = 0

  // 1. Sync Persons
  const personIdMap = {}
  for (const p of localPersons) {
    if (p.id?.startsWith('local_')) {
      const { data, error } = await withTimeout(supabase
        .from('persons')
        .insert({
          name: p.name,
          category: p.category,
          phone: p.phone || null,
          is_active: p.is_active !== false,
          user_id: userId,
        })
        .select()
        .single())
      if (!error && data) {
        personIdMap[p.id] = data.id
        savePersonIdAlias(p.id, data.id)
        p.id = data.id
        p.user_id = userId
        syncedPersons++
      } else if (error) {
        failedRecords++
      }
    }
  }

  // 2. Sync Calculations
  const calcIdMap = {}
  for (const c of localCalcs) {
    if (c.id?.startsWith('calc_')) {
      const targetPersonId = personIdMap[c.person_id] || c.person_id
      const { data, error } = await withTimeout(supabase
        .from('calculations')
        .insert({
          person_id: targetPersonId,
          user_id: userId,
          name: c.name,
          calc_type: c.calc_type,
          sort_order: c.sort_order || 0,
          is_active: c.is_active !== false,
        })
        .select()
        .single())
      if (!error && data) {
        calcIdMap[c.id] = data.id
        c.id = data.id
        c.person_id = targetPersonId
        c.user_id = userId
        syncedCalcs++
      } else if (error) {
        failedRecords++
      }
    }
  }

  // 3. Sync Entries
  for (const e of localEntries) {
    if (e.id?.startsWith('entry_')) {
      const targetPersonId = personIdMap[e.person_id] || e.person_id
      const targetCalcId = calcIdMap[e.calculation_id] || e.calculation_id
      const { error } = await withTimeout(supabase.from('entries').insert({
        person_id: targetPersonId,
        calculation_id: targetCalcId,
        user_id: userId,
        entry_date: e.entry_date,
        quantity: e.quantity || null,
        amount: e.amount || null,
        transaction_type: e.transaction_type || null,
        description: e.description || null,
        is_deleted: e.is_deleted === true,
      }))
      if (!error) {
        e.id = undefined
        e.person_id = targetPersonId
        e.calculation_id = targetCalcId
        e.user_id = userId
        syncedEntries++
      } else {
        failedRecords++
      }
    }
  }

  for (const sale of localSales) {
    if (sale.id?.startsWith('sale_')) {
      const { data, error } = await withTimeout(supabase
        .from('ita_sales')
        .insert({
          person_id: personIdMap[sale.person_id] || sale.person_id,
          user_id: userId,
          sale_date: sale.sale_date,
          quantity: sale.quantity,
          rate_per_thousand: sale.rate_per_thousand,
          sales_amount: sale.sales_amount,
          note: sale.note || null,
          week_start_date: sale.week_start_date,
          week_end_date: sale.week_end_date,
          is_deleted: sale.is_deleted === true,
        })
        .select()
        .single())
      if (!error && data) {
        sale.id = data.id
        sale.person_id = data.person_id
        sale.user_id = userId
        syncedSales++
      } else if (error) {
        failedRecords++
      }
    }
  }

  for (const payment of localPayments) {
    if (payment.id?.startsWith('payment_')) {
      const { data, error } = await withTimeout(supabase
        .from('ita_payments')
        .insert({
          person_id: personIdMap[payment.person_id] || payment.person_id,
          user_id: userId,
          payment_date: payment.payment_date,
          amount: payment.amount,
          week_start_date: payment.week_start_date,
          week_end_date: payment.week_end_date,
          note: payment.note || null,
          is_deleted: payment.is_deleted === true,
        })
        .select()
        .single())
      if (!error && data) {
        payment.id = data.id
        payment.person_id = data.person_id
        payment.user_id = userId
        syncedPayments++
      } else if (error) {
        failedRecords++
      }
    }
  }

  setLocalData('persons', localPersons)
  setLocalData('calculations', localCalcs)
  setLocalData('entries', localEntries.filter((entry) => entry.id))
  setLocalData('ita_sales', localSales)
  setLocalData('ita_payments', localPayments)

  notifyDbStatus(failedRecords > 0)
  return {
    success: failedRecords === 0,
    message: failedRecords === 0
      ? `Synced ${syncedPersons} persons, ${syncedCalcs} calculations, ${syncedEntries} entries, ${syncedSales} ITA sales, and ${syncedPayments} ITA payments to Supabase!`
      : `Synced available records, but ${failedRecords} records could not be uploaded. They will be retried; check the database connection and permissions.`,
  }
}

let syncPromise = null
export function syncLocalDataToSupabase() {
  if (!syncPromise) {
    syncPromise = performLocalDataSync().finally(() => {
      syncPromise = null
    })
  }
  return syncPromise
}

// ============================================
// ITA SALES & PAYMENTS OPERATIONS
// ============================================

export async function getItaSalesByPerson(personId) {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('ita_sales')
        .select('*')
        .eq('person_id', personId)
        .eq('is_deleted', false)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('ita_sales').filter(
        (s) => s.person_id === personId && s.is_deleted !== true
      )
      local.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
      return { data: local, error, localFallback: true }
    }

    if (data) {
      return { data, error: null }
    }

    const local = getLocalData('ita_sales').filter(
      (s) => s.person_id === personId && s.is_deleted !== true
    )
    local.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
    return { data: local, error }
  } catch (error) {
    const local = getLocalData('ita_sales').filter(
      (s) => s.person_id === personId && s.is_deleted !== true
    )
    local.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
    return { data: local, error, localFallback: true }
  }
}

export async function createItaSale(saleData) {
  try {
    const { data: authData } = isOfflineSession()
      ? { data: { user: null } }
      : await supabase.auth.getUser()
    const userId = authData?.user?.id || getActiveUserId()

    const weekRange = getCalendarWeekRange(saleData.sale_date)
    const payload = {
      ...saleData,
      user_id: userId,
      week_start_date: saleData.week_start_date || weekRange.start,
      week_end_date: saleData.week_end_date || weekRange.end,
    }

    if (isOfflineSession()) {
      return saveLocalRecord('ita_sales', 'sale_', payload, { is_deleted: false })
    }

    const { data, error } = await withTimeout(supabase
      .from('ita_sales')
      .insert(payload)
      .select()
      .single())

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const newSale = {
        id: 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        ...payload,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('ita_sales')
      local.push(newSale)
      setLocalData('ita_sales', local)
      return { data: newSale, error: null, localFallback: true }
    }

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) {
      notifyDbStatus(true)
      const userId = getActiveUserId()
      const weekRange = getCalendarWeekRange(saleData.sale_date)
      const newSale = {
        id: 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        ...saleData,
        user_id: userId,
        week_start_date: saleData.week_start_date || weekRange.start,
        week_end_date: saleData.week_end_date || weekRange.end,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('ita_sales')
      local.push(newSale)
      setLocalData('ita_sales', local)
      return { data: newSale, error: null, localFallback: true }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('ita_sales')
      const idx = local.findIndex((s) => s.id === saleId)
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updates, ...extra, updated_at: new Date().toISOString() }
        setLocalData('ita_sales', local)
        return { data: local[idx], error: null }
      }
    }

    if (data) return { data, error: null }

    if (error && !isTableMissingError(error)) return { data: null, error }

    const local = getLocalData('ita_sales')
    const idx = local.findIndex((s) => s.id === saleId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, ...extra, updated_at: new Date().toISOString() }
      setLocalData('ita_sales', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    if (!isTableMissingError(err)) return { data: null, error: err }
    notifyDbStatus(true)
    const local = getLocalData('ita_sales')
    const idx = local.findIndex((s) => s.id === saleId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('ita_sales', local)
      return { data: local[idx], error: null }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('ita_sales')
      const idx = local.findIndex((s) => s.id === saleId)
      if (idx !== -1) {
        local[idx].is_deleted = true
        setLocalData('ita_sales', local)
        return { data: local[idx], error: null }
      }
    }

    if (error && !isTableMissingError(error)) return { data: null, error }
    if (data) return { data, error: null }

    const local = getLocalData('ita_sales')
    const idx = local.findIndex((s) => s.id === saleId)
    if (idx !== -1) {
      local[idx].is_deleted = true
      setLocalData('ita_sales', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    if (!isTableMissingError(err)) return { data: null, error: err }
    notifyDbStatus(true)
    const local = getLocalData('ita_sales')
    const idx = local.findIndex((s) => s.id === saleId)
    if (idx !== -1) {
      local[idx].is_deleted = true
      setLocalData('ita_sales', local)
      return { data: local[idx], error: null }
    }
    return { data: null, error: err }
  }
}

export async function getItaPaymentsByPerson(personId) {
  try {
    const { data, error } = await safeDbQuery(
      supabase
        .from('ita_payments')
        .select('*')
        .eq('person_id', personId)
        .eq('is_deleted', false)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
    )

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('ita_payments').filter(
        (p) => p.person_id === personId && p.is_deleted !== true
      )
      local.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      return { data: local, error, localFallback: true }
    }

    if (data) {
      return { data, error: null }
    }

    const local = getLocalData('ita_payments').filter(
      (p) => p.person_id === personId && p.is_deleted !== true
    )
    local.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
    return { data: local, error }
  } catch (error) {
    const local = getLocalData('ita_payments').filter(
      (p) => p.person_id === personId && p.is_deleted !== true
    )
    local.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
    return { data: local, error, localFallback: true }
  }
}

export async function createItaPayment(paymentData) {
  try {
    const { data: authData } = isOfflineSession()
      ? { data: { user: null } }
      : await supabase.auth.getUser()
    const userId = authData?.user?.id || getActiveUserId()

    const payload = {
      ...paymentData,
      user_id: userId,
    }

    if (isOfflineSession()) {
      return saveLocalRecord('ita_payments', 'payment_', payload, { is_deleted: false })
    }

    const { data, error } = await withTimeout(supabase
      .from('ita_payments')
      .insert(payload)
      .select()
      .single())

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const newPayment = {
        id: 'payment_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        ...payload,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('ita_payments')
      local.push(newPayment)
      setLocalData('ita_payments', local)
      return { data: newPayment, error: null, localFallback: true }
    }

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    if (isTableMissingError(err)) {
      notifyDbStatus(true)
      const userId = getActiveUserId()
      const newPayment = {
        id: 'payment_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        ...paymentData,
        user_id: userId,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const local = getLocalData('ita_payments')
      local.push(newPayment)
      setLocalData('ita_payments', local)
      return { data: newPayment, error: null, localFallback: true }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('ita_payments')
      const idx = local.findIndex((p) => p.id === paymentId)
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
        setLocalData('ita_payments', local)
        return { data: local[idx], error: null }
      }
    }

    if (error && !isTableMissingError(error)) return { data: null, error }
    if (data) return { data, error: null }

    const local = getLocalData('ita_payments')
    const idx = local.findIndex((p) => p.id === paymentId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('ita_payments', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    if (!isTableMissingError(err)) return { data: null, error: err }
    notifyDbStatus(true)
    const local = getLocalData('ita_payments')
    const idx = local.findIndex((p) => p.id === paymentId)
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalData('ita_payments', local)
      return { data: local[idx], error: null }
    }
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

    if (error && isTableMissingError(error)) {
      notifyDbStatus(true)
      const local = getLocalData('ita_payments')
      const idx = local.findIndex((p) => p.id === paymentId)
      if (idx !== -1) {
        local[idx].is_deleted = true
        setLocalData('ita_payments', local)
        return { data: local[idx], error: null }
      }
    }

    if (error && !isTableMissingError(error)) return { data: null, error }
    if (data) return { data, error: null }

    const local = getLocalData('ita_payments')
    const idx = local.findIndex((p) => p.id === paymentId)
    if (idx !== -1) {
      local[idx].is_deleted = true
      setLocalData('ita_payments', local)
      return { data: local[idx], error: null }
    }

    return { data: null, error }
  } catch (err) {
    if (!isTableMissingError(err)) return { data: null, error: err }
    notifyDbStatus(true)
    const local = getLocalData('ita_payments')
    const idx = local.findIndex((p) => p.id === paymentId)
    if (idx !== -1) {
      local[idx].is_deleted = true
      setLocalData('ita_payments', local)
      return { data: local[idx], error: null }
    }
    return { data: null, error: err }
  }
}

// Automatically migrate legacy entries for an ita_sell person into ita_sales and ita_payments
const legacyItaSellMigrations = new Map()

export function migrateLegacyItaSellEntries(personId, existingResults = null) {
  const inFlightMigration = legacyItaSellMigrations.get(personId)
  if (inFlightMigration) return inFlightMigration

  const migration = performLegacyItaSellMigration(personId, existingResults).finally(() => {
    if (legacyItaSellMigrations.get(personId) === migration) {
      legacyItaSellMigrations.delete(personId)
    }
  })
  legacyItaSellMigrations.set(personId, migration)
  return migration
}

async function performLegacyItaSellMigration(personId, existingResults) {
  try {
    const [salesResult, paymentsResult] = existingResults
      ? [existingResults.salesResult, existingResults.paymentsResult]
      : await Promise.all([
          getItaSalesByPerson(personId),
          getItaPaymentsByPerson(personId),
        ])
    if (salesResult.error || paymentsResult.error) {
      return { migrated: false, error: salesResult.error || paymentsResult.error }
    }

    const { data: sales } = salesResult
    const { data: payments } = paymentsResult

    // Only migrate if no sales or payments exist yet for this person
    if ((sales && sales.length > 0) || (payments && payments.length > 0)) {
      return { migrated: false }
    }

    const { data: entries, error: entriesError } = await getEntriesByPerson(personId)
    if (entriesError) return { migrated: false, error: entriesError }
    if (!entries || entries.length === 0) {
      return { migrated: false }
    }

    let salesAdded = 0
    let paymentsAdded = 0

    for (const e of entries) {
      const weekRange = getCalendarWeekRange(e.entry_date)
      // Check if it's quantity (Brick Lifting)
      if (e.quantity && Number(e.quantity) > 0) {
        const qty = Number(e.quantity)
        // Check if there was amount attached or fallback default
        const rate = e.amount ? (Number(e.amount) / (qty / 1000)) : 120
        const salesAmt = Number(e.amount) || ((qty / 1000) * rate)

        const { error } = await createItaSale({
          person_id: personId,
          sale_date: e.entry_date,
          quantity: qty,
          rate_per_thousand: Math.round(rate * 100) / 100,
          sales_amount: Math.round(salesAmt * 100) / 100,
          note: e.description || (e.calculations?.name ? `From ${e.calculations.name}` : null),
          week_start_date: weekRange.start,
          week_end_date: weekRange.end,
        })
        if (error) return { migrated: false, error }
        salesAdded++
      } else if (e.amount && Number(e.amount) > 0) {
        // Payment entry
        const { error } = await createItaPayment({
          person_id: personId,
          payment_date: e.entry_date,
          amount: Number(e.amount),
          week_start_date: weekRange.start,
          week_end_date: weekRange.end,
          note: e.description || (e.calculations?.name ? `From ${e.calculations.name}` : null),
        })
        if (error) return { migrated: false, error }
        paymentsAdded++
      }
    }

    return { migrated: true, salesAdded, paymentsAdded }
  } catch (err) {
    console.error('Migration error:', err)
    return { migrated: false, error: err }
  }
}
