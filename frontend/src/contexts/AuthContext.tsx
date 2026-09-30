import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../types'
import api from '../lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string, loginAs?: 'admin' | 'member') => Promise<void>
  logout: () => void
  isAdmin: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('fms_user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('fms_token')
  )
  const [isLoading, setIsLoading] = useState(false)

  async function login(email: string, password: string, loginAs?: 'admin' | 'member') {
    setIsLoading(true)
    try {
      const payload: Record<string, any> = { email, password }
      if (loginAs) payload.login_as = loginAs
      const { data } = await api.post('/auth/login', payload)
      setToken(data.access_token)
      setUser(data.user)
      localStorage.setItem('fms_token', data.access_token)
      localStorage.setItem('fms_user', JSON.stringify(data.user))
    } finally {
      setIsLoading(false)
    }
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('fms_token')
    localStorage.removeItem('fms_user')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
