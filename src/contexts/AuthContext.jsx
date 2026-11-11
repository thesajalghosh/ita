import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function withAuthTimeout(promise, ms = 10000) {
  let timeoutId
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Connection timed out. Please try again.')), ms)
    }),
  ]).finally(() => clearTimeout(timeoutId))
}

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  const signIn = async (email, password) => {
    try {
      const { data, error } = await withAuthTimeout(supabase.auth.signInWithPassword({
        email,
        password,
      }))

      if (error) {
        return { data, error }
      }

      return { data, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await withAuthTimeout(supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      }))

      if (error) return { data, error }
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
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
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
