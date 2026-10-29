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
  fetchCurrentAccount,
  login as loginRequest,
  logout as logoutRequest,
  registerAccount,
} from '@/lib/auth/auth-api'
import type { LoginRequest, MeResponse, RegisterRequest } from '@/lib/contracts/auth'

export type AuthStatus = 'loading' | 'guest' | 'user'

export interface AuthContextValue {
  status: AuthStatus
  user: MeResponse | null
  login: (input: LoginRequest) => Promise<void>
  register: (input: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}

/**
 * 会话状态只来自服务端。
 *
 * 首帧是加载态，随后由 `GET /api/auth/me` 判定 guest 还是 user；浏览器可读存储里
 * 不保存令牌也不保存用户资料——令牌是 HttpOnly cookie，前端根本读不到。
 *
 * 登录与注册成功之后仍要再取一次 `/me`：界面上显示的必须是服务端认定的账户，
 * 而不是拿登录响应拼出来的近似值，否则「谁在登录」就有了两个真源。
 *
 * `/me` 失败（网络错误或 5xx）归为访客态而不是抛出去：认证不可用不该让整页白屏。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const refresh = useCallback(async () => {
    try {
      const account = await fetchCurrentAccount()
      setUser(account)
      setStatus(account ? 'user' : 'guest')
    } catch {
      setUser(null)
      setStatus('guest')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const account = await fetchCurrentAccount()
        if (cancelled) {
          return
        }
        setUser(account)
        setStatus(account ? 'user' : 'guest')
      } catch {
        if (cancelled) {
          return
        }
        setUser(null)
        setStatus('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (input: LoginRequest) => {
      await loginRequest(input)
      await refresh()
    },
    [refresh],
  )

  const register = useCallback(
    async (input: RegisterRequest) => {
      await registerAccount(input)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      // cookie 由后端清除；即便这一步失败，界面也不该继续显示一个已登出的账户。
      setUser(null)
      setStatus('guest')
    }
  }, [])

  const value = useMemo(
    () => ({ status, user, login, register, logout, refresh }),
    [status, user, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
