import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const SettingsContext = createContext({})

export function useSettings() {
  return useContext(SettingsContext)
}

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState({ allow_edit: false, allow_delete: false })
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!user) return
    setLoading(true)
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
    } else if (data) {
      setSettings(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates) => {
    if (!user) return
    const { data, error } = await supabase
      .from('app_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select()
      .single()

    if (!error && data) {
      setSettings(data)
    }
    return { data, error }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
