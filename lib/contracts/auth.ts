/**
 * 认证接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端的一个出站 DTO（`web/auth/dto/*.java`
 * 与 `common/web/ErrorResponse.java`），字段名与 record 组件名完全相同，两侧一律 camelCase。
 * 一致性不靠人盯：`harness/checks/10-contract-check.ps1` 会解析两侧的字段「名字 + 类型」做双向比对，
 * 后端新增 DTO 而这里没有镜像、这里多写一个后端没有的字段、任何一侧改成蛇形命名、
 * 后端用注解改写 JSON 字段名、共有字段两侧类型经 Java↔TS 映射表归一后不一致，闸门都直接非 0 退出。
 *
 * 类型约定（由闸门按 Java↔TS 映射表强制，不靠人盯）：
 * 1. 时间字段是 ISO-8601 字符串（后端 `Instant` 由 Jackson 序列化而来），不是毫秒数值；
 * 2. 状态字段是小写字面量联合（如 `AccountStatus`，对应后端 `String`），不是枚举对象；
 * 3. 令牌不在任何响应体里，只经 `Set-Cookie` 落到 HttpOnly cookie，所以这里没有 token 字段；
 * 4. 新增字段必须先改后端 DTO，再来这里镜像，顺序反过来闸门就会先红一次——这是设计意图。
 */

/** 账户状态，取后端 `AccountStatus.dbValue()` 的小写取值。 */
export type AccountStatus = 'active' | 'email_unverified' | 'deleted'

/** GET /api/auth/captcha 的响应体。 */
export interface CaptchaResponse {
  captchaId: string
  image: string
}

/** POST /api/auth/register-code 的请求体；响应为 202 且无响应体。 */
export interface RegisterCodeRequest {
  email: string
  captchaId: string
  captchaAnswer: string
}

/** POST /api/auth/register 的请求体。 */
export interface RegisterRequest {
  email: string
  code: string
  password: string
  displayName: string
}

/** POST /api/auth/register 的响应体。 */
export interface RegisterResponse {
  publicId: string
  email: string
  displayName: string
}

/**
 * POST /api/auth/login 的请求体。
 *
 * 图形码两个字段平时省略：只有同一账户连续失败达到阈值后后端才要求带码，
 * 届时缺失或答错都是 `400` 与 `CAPTCHA_INVALID`。
 */
export interface LoginRequest {
  email: string
  password: string
  captchaId?: string
  captchaAnswer?: string
}

/** POST /api/auth/login 的响应体。 */
export interface LoginResponse {
  publicId: string
  email: string
  displayName: string
  expiresAt: string
}

/** GET /api/auth/me 的响应体；未认证时为 401。 */
export interface MeResponse {
  publicId: string
  email: string
  displayName: string
  status: AccountStatus
  createdAt: string
}

/** POST /api/auth/password-reset-code 的请求体；响应为 202 且无响应体。 */
export interface PasswordResetCodeRequest {
  email: string
  captchaId: string
  captchaAnswer: string
}

/** POST /api/auth/password-reset 的请求体；响应为 204 且无响应体。 */
export interface PasswordResetRequest {
  email: string
  code: string
  newPassword: string
}

/** 所有认证端点的统一错误体。 */
export interface ErrorResponse {
  code: string
  message: string
}

/**
 * 后端对外暴露的全部错误码，取值与 `AuthErrorEnum` 逐字一致，共七个。
 * 新增错误码属于契约变更：先改后端枚举，再改这里，闸门会核对个数与取值。
 */
export const AUTH_ERROR_CODES = [
  'UNAUTHENTICATED',
  'EMAIL_UNVERIFIED',
  'CROSS_SITE_REJECTED',
  'INVALID_CODE',
  'CAPTCHA_INVALID',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
] as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number]

/** 认证端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const AUTH_ENDPOINTS = {
  captcha: '/api/auth/captcha',
  registerCode: '/api/auth/register-code',
  register: '/api/auth/register',
  login: '/api/auth/login',
  me: '/api/auth/me',
  logout: '/api/auth/logout',
  account: '/api/auth/account',
  passwordResetCode: '/api/auth/password-reset-code',
  passwordReset: '/api/auth/password-reset',
} as const

/**
 * 密码长度界限，单位为 UTF-8 字节，取自后端 `PasswordRules.MIN_BYTES` / `MAX_BYTES`。
 * 界面提示必须用它，不能沿用早期 mock 时代「至少 6 个字符」的说法。
 */
export const PASSWORD_MIN_BYTES = 8
export const PASSWORD_MAX_BYTES = 72

/** 认证 cookie 名，仅用于说明；令牌本身是 HttpOnly，前端读不到也不需要读。 */
export const SESSION_COOKIE_NAME = 'wc_session'
