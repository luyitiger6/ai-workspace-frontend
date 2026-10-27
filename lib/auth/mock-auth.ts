/**
 * 前端自包含的 Mock 认证：账号与会话只存在浏览器本地，不发起任何网络请求。
 * 这是接口形状的占位实现，真实认证（服务端签发 JWT）需另立项。
 * 生产构建下注册与登录会被 assertDemoEnvironment 直接拒绝，避免演示代码被当成真认证部署出去。
 */

export type UserRole = 'user' | 'admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface Session {
  token: string
  user: AuthUser
  expiresAt: number
}

export interface RegisterInput {
  email: string
  password: string
  name: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

interface StoredAccount extends AuthUser {
  password: string
}

const ACCOUNT_KEY = 'wanderchain.accounts'
const SESSION_KEY = 'wanderchain.session'
const SESSION_TTL = 1000 * 60 * 60 * 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 6

const SEED_ACCOUNTS: readonly StoredAccount[] = [
  {
    id: 'u-admin',
    email: 'admin@wanderchain.dev',
    name: 'Editor Lan',
    role: 'admin',
    password: 'admin123',
  },
  {
    id: 'u-traveler',
    email: 'traveler@wanderchain.dev',
    name: 'Traveler Zhou',
    role: 'user',
    password: 'traveler123',
  },
]

function storage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

function readRegistered(): StoredAccount[] {
  const store = storage()
  const raw = store?.getItem(ACCOUNT_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredAccount[]) : []
  } catch {
    return []
  }
}

function writeRegistered(accounts: StoredAccount[]): void {
  storage()?.setItem(ACCOUNT_KEY, JSON.stringify(accounts))
}

function allAccounts(): StoredAccount[] {
  return [...SEED_ACCOUNTS, ...readRegistered()]
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function base64Url(value: string): string {
  return btoa(value).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** 三段式假令牌：结构与 JWT 对齐，便于未来替换为真实令牌，但签名不参与校验。 */
function createToken(user: AuthUser, expiresAt: number): string {
  const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(expiresAt / 1000) }),
  )
  return `${header}.${payload}.mock-signature`
}

function toUser(account: StoredAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
  }
}

function persistSession(user: AuthUser): Session {
  const expiresAt = Date.now() + SESSION_TTL
  const session: Session = { token: createToken(user, expiresAt), user, expiresAt }
  storage()?.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

function validateCredentials(email: string, password: string): void {
  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthError('Enter a valid email address')
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AuthError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }
}

/**
 * 演示认证禁止进入生产：密码以明文写入 localStorage，令牌不参与签名校验。
 * 这里不做「前端加密密码」那种自我安慰，而是让误部署在注册/登录这一步立刻暴露，
 * 而不是静默带病运行。只在函数体内判断，不在模块顶层执行——顶层会在 SSR 预渲染时跑，
 * 那样会让 next build 直接失败，等于把护栏做成了路障。
 */
function assertDemoEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new AuthError('Demo auth is disabled: production must use real server-issued authentication.')
  }
}

export async function registerAccount(input: RegisterInput): Promise<Session> {
  assertDemoEnvironment()

  const email = normalizeEmail(input.email)
  const name = input.name.trim()

  validateCredentials(email, input.password)
  if (name.length < 2) {
    throw new AuthError('Username must be at least 2 characters')
  }
  if (allAccounts().some((account) => account.email === email)) {
    throw new AuthError('This email is already registered')
  }

  const account: StoredAccount = {
    id: `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    email,
    name,
    role: 'user',
    password: input.password,
  }
  writeRegistered([...readRegistered(), account])

  return persistSession(toUser(account))
}

export async function loginWithPassword(email: string, password: string): Promise<Session> {
  assertDemoEnvironment()

  const normalized = normalizeEmail(email)
  const account = allAccounts().find((item) => item.email === normalized)

  if (!account || account.password !== password) {
    throw new AuthError('Incorrect email or password')
  }

  return persistSession(toUser(account))
}

/**
 * 读取会话不设生产护栏：它在挂载期执行，抛错只会把首屏打崩；
 * 而新会话只能由注册/登录写入，那两条入口已经拦住了。
 */
export function readSession(): Session | null {
  const store = storage()
  const raw = store?.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as Session
    if (!session.user || session.expiresAt <= Date.now()) {
      store?.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    store?.removeItem(SESSION_KEY)
    return null
  }
}

export function logoutSession(): void {
  storage()?.removeItem(SESSION_KEY)
}
