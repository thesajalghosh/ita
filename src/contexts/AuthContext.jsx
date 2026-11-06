import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if there is an offline/local session stored
    const offlineRaw = localStorage.getItem('ita_offline_user')
    if (offlineRaw) {
      try {
        const parsed = JSON.parse(offlineRaw)
        if (parsed?.id) {
          setUser(parsed)
          setLoading(false)
          return
        }
      } catch {}
    }

    let isMounted = true

    // Safety timeout: Never let loading screen freeze for more than 1.5 seconds
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 1500)

    try {
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          clearTimeout(timer)
          if (isMounted) {
            setUser(session?.user ?? null)
            setLoading(false)
          }
        })
        .catch(() => {
          clearTimeout(timer)
          if (isMounted) setLoading(false)
        })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isMounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      })

      return () => {
        isMounted = false
        clearTimeout(timer)
        subscription?.unsubscribe()
      }
    } catch {
      clearTimeout(timer)
      if (isMounted) setLoading(false)
    }
  }, [])

  const signInOffline = (email = 'admin@brickkiln.local', name = 'Admin') => {
    const offlineUser = {
      id: 'default_user',
      email: email || 'admin@brickkiln.local',
      user_metadata: { full_name: name || 'Admin' },
      is_offline: true,
    }
    localStorage.setItem('ita_offline_user', JSON.stringify(offlineUser))
    setUser(offlineUser)
    return { data: { user: offlineUser }, error: null }
  }

  const signIn = async (email, password) => {
    try {
      const authPromise = supabase.auth.signInWithPassword({
        email,
        password,
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Using local mode.')), 3500)
      )

      const { data, error } = await Promise.race([authPromise, timeoutPromise])

      if (error) {
        const msg = (error.message || '').toLowerCase()
        const isConnError =
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('timeout') ||
          msg.includes('timed out') ||
          msg.includes('522') ||
          msg.includes('502') ||
          msg.includes('503') ||
          msg.includes('doctype') ||
          msg.includes('unexpected token')

        if (isConnError) {
          return signInOffline(email)
        }
        return { data, error }
      }

      localStorage.removeItem('ita_offline_user')
      return { data, error: null }
    } catch (err) {
      return signInOffline(email)
    }
  }

  const signUp = async (email, password, fullName) => {
    try {
      const authPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out')), 3500)
      )

      const { data, error } = await Promise.race([authPromise, timeoutPromise])

      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('522')) {
          return signInOffline(email, fullName)
        }
        return { data, error }
      }
      return { data, error }
    } catch {
      return signInOffline(email, fullName)
    }
  }

  const signOut = async () => {
    localStorage.removeItem('ita_offline_user')
    try {
      await supabase.auth.signOut()
    } catch {}
    setUser(null)
    return { error: null }
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signInOffline,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
