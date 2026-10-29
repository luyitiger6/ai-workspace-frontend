import {
  AUTH_ENDPOINTS,
  type CaptchaResponse,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type RegisterCodeRequest,
  type RegisterRequest,
  type RegisterResponse,
} from '@/lib/contracts/auth'

/**
 * 认证接口的唯一调用点。
 *
 * 三条约束决定了它为什么必须收在一处：
 * 1. 令牌只存在于 HttpOnly cookie，所以这里从不返回令牌，也不写任何浏览器可读存储；
 * 2. 行为分流看错误码而不是状态码——两个 403（`EMAIL_UNVERIFIED` 与 `CROSS_SITE_REJECTED`）
 *    必须给出不同文案，只看 403 就会把它们混成一句「登录失败」；
 * 3. 限流的等待秒数取自响应头 `Retry-After`，前端不自作主张猜一个数。
 *
 * 字段名一律取自 `lib/contracts/auth.ts`，本文件不重复声明任何接口形状。
 */

/** 后端返回的错误体被解析成这个类型：带上状态码与限流等待秒数，供界面分流。 */
export class AuthApiError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfter: number | null

  constructor(code: string, message: string, status: number, retryAfter: number | null) {
    super(message)
    this.name = 'AuthApiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** 请求根本没能到达后端（离线、代理 502）。与后端错误分开建模，避免被当成某个错误码。 */
export class AuthNetworkError extends Error {
  constructor(message = 'Cannot reach the server. Check your connection and try again.') {
    super(message)
    this.name = 'AuthNetworkError'
  }
}

/** 错误码到界面文案的映射。未知码回落到后端 message 原文，不臆造文案。 */
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'The email or password is incorrect.',
  EMAIL_UNVERIFIED: 'This email has not been verified yet, so it cannot log in.',
  CROSS_SITE_REJECTED: 'The request was rejected because its origin is not trusted.',
  INVALID_CODE: 'That code is incorrect or has expired. Request a new one.',
  CAPTCHA_INVALID: 'The image verification answer is incorrect or has expired.',
  RATE_LIMITED: 'Too many attempts.',
  VALIDATION_FAILED: 'Some fields are not valid. Check them and try again.',
}

const NETWORK_MESSAGE = 'Cannot reach the server. Check your connection and try again.'

/**
 * 响应体不是后端那套 `{ code, message }` 时用的哨兵值（例如代理自己返回的 502 文本）。
 * 它故意不在后端七个错误码里：否则会被当成 `VALIDATION_FAILED` 映射出一句不相干的文案。
 */
const UNKNOWN_CODE = 'UNKNOWN'

/** 把任意异常翻译成可以直接展示给用户的英文文案，限流时带上后端给的等待秒数。 */
export function describeAuthError(cause: unknown): string {
  if (cause instanceof AuthNetworkError) {
    return NETWORK_MESSAGE
  }
  if (!(cause instanceof AuthApiError)) {
    return 'Something went wrong. Please try again later.'
  }

  const base = ERROR_MESSAGES[cause.code] ?? cause.message
  if (cause.retryAfter === null) {
    return base
  }
  return `${base} Try again in ${cause.retryAfter} seconds.`
}

/** 是否因为账户维度失败次数达到阈值而被要求补图形码。 */
export function isCaptchaRequired(cause: unknown): boolean {
  return cause instanceof AuthApiError && cause.code === 'CAPTCHA_INVALID'
}

function retryAfterOf(response: Response): number | null {
  const raw = response.headers.get('retry-after')
  if (!raw) {
    return null
  }
  const seconds = Number.parseInt(raw, 10)
  return Number.isFinite(seconds) ? seconds : null
}

async function toApiError(response: Response): Promise<AuthApiError> {
  let code = UNKNOWN_CODE
  let message = `Request failed with status ${response.status}`
  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown }
    if (typeof body.code === 'string') {
      code = body.code
    }
    if (typeof body.message === 'string') {
      message = body.message
    }
  } catch {
    // 响应体不是 JSON：保留状态码派生的兜底文案，不去猜后端想说什么。
  }
  return new AuthApiError(code, message, response.status, retryAfterOf(response))
}

async function send(endpoint: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      ...init,
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new AuthNetworkError()
  }
  return response
}

function postBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await toApiError(response)
  }
  return (await response.json()) as T
}

/** 取一张图形验证码。登录只在被要求时才调用它，注册第一步则必须调用。 */
export async function fetchCaptcha(): Promise<CaptchaResponse> {
  return readJson<CaptchaResponse>(await send(AUTH_ENDPOINTS.captcha))
}

/** 换发邮箱注册码：成功是 202 且无响应体，失败由错误码分流。 */
export async function requestRegisterCode(input: RegisterCodeRequest): Promise<void> {
  const response = await send(AUTH_ENDPOINTS.registerCode, postBody(input))
  if (!response.ok) {
    throw await toApiError(response)
  }
}

/** 提交邮箱注册码完成注册。令牌经 Set-Cookie 落下，响应体里没有它。 */
export async function registerAccount(input: RegisterRequest): Promise<RegisterResponse> {
  return readJson<RegisterResponse>(await send(AUTH_ENDPOINTS.register, postBody(input)))
}

/** 登录。凭证正确是 200 + Set-Cookie；401/403/400/429 各自对应不同处理。 */
export async function login(input: LoginRequest): Promise<LoginResponse> {
  return readJson<LoginResponse>(await send(AUTH_ENDPOINTS.login, postBody(input)))
}

/**
 * 读取当前会话。未认证返回 `null` 而不是抛错：
 * 「没登录」是正常状态，不是异常，调用方不该被迫写 try/catch 才能渲染访客态。
 */
export async function fetchCurrentAccount(): Promise<MeResponse | null> {
  const response = await send(AUTH_ENDPOINTS.me)
  if (response.status === 401) {
    return null
  }
  return readJson<MeResponse>(response)
}

/** 登出：由后端清除 cookie，返回 204。cookie 清不掉时前端无从补救，只能如实抛出。 */
export async function logout(): Promise<void> {
  const response = await send(AUTH_ENDPOINTS.logout, { method: 'POST' })
  if (!response.ok) {
    throw await toApiError(response)
  }
}
