import { describe, expect, it } from 'vitest'

import {
  AUTH_ENDPOINTS,
  AUTH_ERROR_CODES,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_BYTES,
  SESSION_COOKIE_NAME,
  type CaptchaResponse,
  type ErrorResponse,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type PasswordResetCodeRequest,
  type PasswordResetRequest,
  type RegisterCodeRequest,
  type RegisterRequest,
  type RegisterResponse,
} from './auth'

/**
 * 契约文件的字段名清单。
 *
 * 这些数组与上面的类型标注是一组联锁：字面量缺字段或多字段由 TypeScript 直接报错，
 * 字面量与数组不一致由下面的断言报错。改名任何一侧都会红，改法只有「两处一起改」，
 * 而后端那一侧由 `harness/checks/10-contract-check.ps1` 兜住。
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const captchaFixture: CaptchaResponse = { captchaId: '01JCAPTCHA', image: 'data:image/png;base64,AAA' }
const registerCodeFixture: RegisterCodeRequest = {
  email: 'a@example.com',
  captchaId: '01JCAPTCHA',
  captchaAnswer: 'a1b2',
}
const registerFixture: RegisterRequest = {
  email: 'a@example.com',
  code: '123456',
  password: 'password1',
  displayName: '旅人',
}
const registerResponseFixture: RegisterResponse = {
  publicId: '01JACCOUNT',
  email: 'a@example.com',
  displayName: '旅人',
}
const loginFixture: LoginRequest = {
  email: 'a@example.com',
  password: 'password1',
  captchaId: '01JCAPTCHA',
  captchaAnswer: 'a1b2',
}
const loginResponseFixture: LoginResponse = {
  publicId: '01JACCOUNT',
  email: 'a@example.com',
  displayName: '旅人',
  expiresAt: '2026-11-05T03:00:00Z',
}
const meFixture: MeResponse = {
  publicId: '01JACCOUNT',
  email: 'a@example.com',
  displayName: '旅人',
  status: 'active',
  createdAt: '2026-10-29T03:00:00Z',
}
const passwordResetCodeFixture: PasswordResetCodeRequest = {
  email: 'a@example.com',
  captchaId: '01JCAPTCHA',
  captchaAnswer: 'a1b2',
}
const passwordResetFixture: PasswordResetRequest = {
  email: 'a@example.com',
  code: '123456',
  newPassword: 'password2',
}
const errorFixture: ErrorResponse = { code: 'CAPTCHA_INVALID', message: '图形验证码错误或已过期' }

describe('认证契约', () => {
  it('每个接口的字段名与后端 record 组件名逐字相同', () => {
    expect(Object.keys(captchaFixture)).toEqual(['captchaId', 'image'])
    expect(Object.keys(registerCodeFixture)).toEqual(['email', 'captchaId', 'captchaAnswer'])
    expect(Object.keys(registerFixture)).toEqual(['email', 'code', 'password', 'displayName'])
    expect(Object.keys(registerResponseFixture)).toEqual(['publicId', 'email', 'displayName'])
    expect(Object.keys(loginFixture)).toEqual(['email', 'password', 'captchaId', 'captchaAnswer'])
    expect(Object.keys(loginResponseFixture)).toEqual(['publicId', 'email', 'displayName', 'expiresAt'])
    expect(Object.keys(meFixture)).toEqual(['publicId', 'email', 'displayName', 'status', 'createdAt'])
    expect(Object.keys(passwordResetCodeFixture)).toEqual(['email', 'captchaId', 'captchaAnswer'])
    expect(Object.keys(passwordResetFixture)).toEqual(['email', 'code', 'newPassword'])
    expect(Object.keys(errorFixture)).toEqual(['code', 'message'])
  })

  it('字段名一律 camelCase：小写字母开头，不含下划线', () => {
    const fields = [
      ...Object.keys(captchaFixture),
      ...Object.keys(registerCodeFixture),
      ...Object.keys(registerFixture),
      ...Object.keys(registerResponseFixture),
      ...Object.keys(loginFixture),
      ...Object.keys(loginResponseFixture),
      ...Object.keys(meFixture),
      ...Object.keys(passwordResetCodeFixture),
      ...Object.keys(passwordResetFixture),
      ...Object.keys(errorFixture),
    ]

    for (const field of fields) {
      expect(field).toMatch(/^[a-z][A-Za-z0-9]*$/)
    }
  })

  it('时间字段是 ISO-8601 字符串而不是毫秒数值', () => {
    expect(typeof meFixture.createdAt).toBe('string')
    expect(meFixture.createdAt).toMatch(ISO_INSTANT)
    expect(typeof loginResponseFixture.expiresAt).toBe('string')
    expect(loginResponseFixture.expiresAt).toMatch(ISO_INSTANT)
  })

  it('错误码就是后端那七个，多一个少一个都算契约变更', () => {
    expect([...AUTH_ERROR_CODES]).toEqual([
      'UNAUTHENTICATED',
      'EMAIL_UNVERIFIED',
      'CROSS_SITE_REJECTED',
      'INVALID_CODE',
      'CAPTCHA_INVALID',
      'RATE_LIMITED',
      'VALIDATION_FAILED',
    ])
    expect(AUTH_ERROR_CODES).toHaveLength(7)
  })

  it('端点路径与后端控制器映射一致，且全部走同源 /api', () => {
    expect(Object.values(AUTH_ENDPOINTS)).toEqual([
      '/api/auth/captcha',
      '/api/auth/register-code',
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/me',
      '/api/auth/logout',
      '/api/auth/account',
      '/api/auth/password-reset-code',
      '/api/auth/password-reset',
    ])
  })

  it('密码界限取自后端 PasswordRules：8 到 72 字节', () => {
    expect(PASSWORD_MIN_BYTES).toBe(8)
    expect(PASSWORD_MAX_BYTES).toBe(72)
  })

  it('会话 cookie 名与后端 AuthCookie.NAME 一致', () => {
    expect(SESSION_COOKIE_NAME).toBe('wc_session')
  })

  it('响应体里没有令牌字段：令牌只经 Set-Cookie 下发', () => {
    const responseFields = [
      ...Object.keys(loginResponseFixture),
      ...Object.keys(registerResponseFixture),
      ...Object.keys(meFixture),
    ]

    expect(responseFields).not.toContain('token')
    expect(responseFields).not.toContain('accessToken')
  })
})
