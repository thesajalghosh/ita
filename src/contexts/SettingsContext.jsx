import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { reportDatabaseStatus } from '../lib/api'

const SettingsContext = createContext({})

export function useSettings() {
  return useContext(SettingsContext)
}

const DEFAULT_SETTINGS = {
  allow_edit: false,
  allow_delete: false,
  show_add_column: true,
}

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!user) {
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
        const { data: newData, error: insertError } = await supabase
          .from('app_settings')
          .insert({ user_id: user.id, allow_edit: false, allow_delete: false })
          .select()
          .single()
        if (insertError) {
          reportDatabaseStatus(true)
          setSettings(DEFAULT_SETTINGS)
        } else if (newData) {
          setSettings({ ...DEFAULT_SETTINGS, ...newData })
        }
      } else if (error) {
        reportDatabaseStatus(true)
        setSettings(DEFAULT_SETTINGS)
      } else if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data })
      } else {
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      reportDatabaseStatus(true)
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates) => {
    const newSettings = { ...settings, ...updates }

    if (!user) return { data: null, error: new Error('Please sign in to update settings.') }

    const cloudUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => key !== 'show_add_column')
    )
    if (Object.keys(cloudUpdates).length === 0) {
      setSettings(newSettings)
      return { data: newSettings, error: null }
    }

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ ...cloudUpdates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single()

      if (!error && data) {
        const mergedSettings = {
          ...data,
          show_add_column: newSettings.show_add_column,
        }
        setSettings(mergedSettings)
        return { data: mergedSettings, error: null }
      }

      reportDatabaseStatus(true)
      return { data: null, error: error || new Error('Database did not update settings.') }
    } catch (error) {
      reportDatabaseStatus(true)
      return { data: null, error }
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
