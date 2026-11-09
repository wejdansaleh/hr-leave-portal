import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onUnauthorized } from '../api/client'
import {
  completeNewPassword,
  getCurrentUser,
  logout,
  signInWithPassword,
  type AuthUser,
} from './authService'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void getCurrentUser().then((current) => {
      if (!active) return
      setUser(current)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logout()
    } finally {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    onUnauthorized(() => {
      void signOut()
    })
    return () => onUnauthorized(null)
  }, [signOut])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithPassword(email, password)
    if (result === 'signed-in') setUser(await getCurrentUser())
    return result
  }, [])

  const confirmNewPassword = useCallback(async (newPassword: string) => {
    const result = await completeNewPassword(newPassword)
    if (result === 'signed-in') setUser(await getCurrentUser())
    return result
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, confirmNewPassword, signOut }),
    [user, loading, signIn, confirmNewPassword, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

