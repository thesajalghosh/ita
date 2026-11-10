import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { isTableMissingError } from '../lib/api'

const SettingsContext = createContext({})

export function useSettings() {
  return useContext(SettingsContext)
}

const LOCAL_SETTINGS_KEY = 'ita_app_settings'

function getLocalSettings(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_SETTINGS_KEY}_${userId || 'default'}`)
    return raw ? JSON.parse(raw) : { allow_edit: false, allow_delete: false }
  } catch {
    return { allow_edit: false, allow_delete: false }
  }
}

function setLocalSettings(userId, settings) {
  try {
    localStorage.setItem(`${LOCAL_SETTINGS_KEY}_${userId || 'default'}`, JSON.stringify(settings))
  } catch {
    // Ignore
  }
}

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState({ allow_edit: false, allow_delete: false })
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    if (user.is_offline) {
      setSettings(getLocalSettings(user.id))
      setLoading(false)
      return
    }
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // No settings row, create one
        const { data: newData } = await supabase
          .from('app_settings')
          .insert({ user_id: user.id, allow_edit: false, allow_delete: false })
          .select()
          .single()
        if (newData) setSettings(newData)
      } else if (error && isTableMissingError(error)) {
        // Table not found in schema cache - fallback to local storage
        const local = getLocalSettings(user.id)
        setSettings(local)
      } else if (data) {
        setSettings(data)
      } else {
        const local = getLocalSettings(user.id)
        setSettings(local)
      }
    } catch {
      const local = getLocalSettings(user?.id)
      setSettings(local)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    if (user?.id) {
      setLocalSettings(user.id, newSettings)
    }

    if (!user || user.is_offline) return { data: newSettings, error: null }

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single()

      if (!error && data) {
        setSettings(data)
        return { data, error: null }
      }

      if (error && isTableMissingError(error)) {
        return { data: newSettings, error: null }
      }

      return { data: newSettings, error: null }
    } catch {
      return { data: newSettings, error: null }
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
