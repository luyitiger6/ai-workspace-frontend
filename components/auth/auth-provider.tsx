'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  loginWithPassword,
  logoutSession,
  readSession,
  registerAccount,
  type AuthUser,
  type RegisterInput,
} from '@/lib/auth/mock-auth'

export type AuthStatus = 'loading' | 'guest' | 'user'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth 必须在 AuthProvider 内使用')
  }
  return value
}

/** 会话只在前端维护：首帧先读本地存储，随后切换为 guest 或 user。 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    const session = readSession()
    setUser(session?.user ?? null)
    setStatus(session ? 'user' : 'guest')
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginWithPassword(email, password)
    setUser(session.user)
    setStatus('user')
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const session = await registerAccount(input)
    setUser(session.user)
    setStatus('user')
  }, [])

  const logout = useCallback(() => {
    logoutSession()
    setUser(null)
    setStatus('guest')
  }, [])

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
