'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  login: (input: LoginRequest) => Promise<MeResponse | null>
  register: (input: RegisterRequest) => Promise<MeResponse | null>
  logout: () => Promise<void>
  refresh: () => Promise<MeResponse | null>
  /** 主动登出的事件代次；与 /me 失败归为 guest 区分，供内存草稿清除。 */
  logoutRevision?: number
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
  const [logoutRevision, setLogoutRevision] = useState(0)

  const generation = useRef(0)
  const refresh = useCallback(async (): Promise<MeResponse | null> => {
    const current = ++generation.current
    setStatus('loading')
    let account: MeResponse | null = null
    try {
      account = await fetchCurrentAccount()
    } catch {
      // 全局失败仍归 guest；返回 null 让表单区分写成功与会话未确认。
    }
    if (current !== generation.current) return null
    setUser(account)
    setStatus(account ? 'user' : 'guest')
    return account
  }, [])

  useEffect(() => {
    void refresh()
    return () => {
      generation.current += 1
    }
  }, [refresh])

  const login = useCallback(
    async (input: LoginRequest) => {
      await loginRequest(input)
      return refresh()
    },
    [refresh],
  )

  const register = useCallback(
    async (input: RegisterRequest) => {
      await registerAccount(input)
      return refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    generation.current += 1
    setLogoutRevision(value => value + 1)
    setUser(null)
    setStatus('loading')
    try {
      await logoutRequest()
    } catch {
      // 登出失败也照样落到访客态：cookie 归后端管，界面不该留着一个已经登出的账户。
      // 唯一的生产调用点是 `void logout()`，没有消费 rejection 的通道，所以在这里收敛。
    } finally {
      setUser(null)
      setStatus('guest')
    }
  }, [])

  const value = useMemo(
    () => ({ status, user, login, register, logout, refresh, logoutRevision }),
    [status, user, login, register, logout, refresh, logoutRevision],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
