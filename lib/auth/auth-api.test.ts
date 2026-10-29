// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthApiError,
  AuthNetworkError,
  describeAuthError,
  fetchCurrentAccount,
  fetchCaptcha,
  isCaptchaRequired,
  login,
  logout,
  registerAccount,
  requestRegisterCode,
} from './auth-api'

const fetchMock = vi.fn()

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

/** 取出最近一次请求的 URL 与初始化参数。 */
function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
  return { url, init }
}

/** 取出最近一次请求的请求体（GET 无请求体时不要调它）。 */
function lastBody(): Record<string, unknown> {
  return JSON.parse(String(lastCall().init.body)) as Record<string, unknown>
}

describe('认证 API 客户端', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('登录成功返回契约字段，且请求体字段名逐字取自契约', async () => {
    fetchMock.mockResolvedValue(
      json({
        publicId: '01JACCOUNT',
        email: 'a@example.com',
        displayName: 'Road Tester',
        expiresAt: '2026-11-05T03:00:00Z',
      }),
    )

    const result = await login({
      email: 'a@example.com',
      password: 'password1',
      captchaId: '01JCAPTCHA',
      captchaAnswer: 'a1b2',
    })

    expect(result.displayName).toBe('Road Tester')
    const { url, init } = lastCall()
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(Object.keys(lastBody())).toEqual(['email', 'password', 'captchaId', 'captchaAnswer'])
    // 响应体里没有令牌：令牌只经 Set-Cookie 落地，客户端拿不到字符串。
    expect(Object.keys(result)).not.toContain('token')
  })

  it('不带图形码登录时请求体不出现图形码字段', async () => {
    fetchMock.mockResolvedValue(
      json({ publicId: '01J', email: 'a@example.com', displayName: 'R', expiresAt: '2026-11-05T03:00:00Z' }),
    )

    await login({ email: 'a@example.com', password: 'password1' })

    expect(Object.keys(lastBody())).toEqual(['email', 'password'])
  })

  it('GET /me 的 401 归一化为 null，而不是抛错', async () => {
    fetchMock.mockResolvedValue(
      json({ code: 'UNAUTHENTICATED', message: '未认证' }, 401),
    )

    await expect(fetchCurrentAccount()).resolves.toBeNull()
    expect(lastCall().url).toBe('/api/auth/me')
  })

  it('GET /me 返回账户时字段与契约一致', async () => {
    fetchMock.mockResolvedValue(
      json({
        publicId: '01JACCOUNT',
        email: 'a@example.com',
        displayName: 'Road Tester',
        status: 'active',
        createdAt: '2026-10-29T03:00:00Z',
      }),
    )

    const account = await fetchCurrentAccount()

    expect(Object.keys(account ?? {})).toEqual([
      'publicId',
      'email',
      'displayName',
      'status',
      'createdAt',
    ])
  })

  it('GET /me 的 5xx 抛 AuthApiError，由调用方决定降级', async () => {
    fetchMock.mockResolvedValue(json({ code: 'VALIDATION_FAILED', message: 'upstream boom' }, 503))

    const error = await fetchCurrentAccount().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).status).toBe(503)
  })

  it('429 带上 Retry-After 的秒数，文案里出现该秒数', async () => {
    fetchMock.mockResolvedValue(
      json({ code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }, 429, {
        'retry-after': '45',
      }),
    )

    const error = await login({ email: 'a@example.com', password: 'password1' }).catch(
      (cause: unknown) => cause,
    )

    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).retryAfter).toBe(45)
    expect(describeAuthError(error)).toContain('45 seconds')
  })

  it('两个 403 的文案不同：邮箱未验证与来源不可信不共用一句话', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'EMAIL_UNVERIFIED', message: '邮箱尚未验证' }, 403))
    const unverified = await login({ email: 'a@example.com', password: 'password1' }).catch(
      (cause: unknown) => cause,
    )

    fetchMock.mockResolvedValueOnce(json({ code: 'CROSS_SITE_REJECTED', message: '请求来源不可信' }, 403))
    const crossSite = await login({ email: 'a@example.com', password: 'password1' }).catch(
      (cause: unknown) => cause,
    )

    expect((unverified as AuthApiError).code).toBe('EMAIL_UNVERIFIED')
    expect((crossSite as AuthApiError).code).toBe('CROSS_SITE_REJECTED')
    expect(describeAuthError(unverified)).not.toBe(describeAuthError(crossSite))
  })

  it('401 凭证错误只给一句统一提示，不区分邮箱是否存在', async () => {
    fetchMock.mockResolvedValue(json({ code: 'UNAUTHENTICATED', message: '未认证' }, 401))

    const error = await login({ email: 'nobody@example.com', password: 'password1' }).catch(
      (cause: unknown) => cause,
    )

    expect(describeAuthError(error)).toBe('The email or password is incorrect.')
    expect(isCaptchaRequired(error)).toBe(false)
  })

  it('CAPTCHA_INVALID 被识别为需要补图形码', async () => {
    fetchMock.mockResolvedValue(json({ code: 'CAPTCHA_INVALID', message: '图形验证码错误或已过期' }, 400))

    const error = await login({ email: 'a@example.com', password: 'wrong123' }).catch(
      (cause: unknown) => cause,
    )

    expect(isCaptchaRequired(error)).toBe(true)
  })

  it('未知错误码回落到后端 message 原文，不臆造文案', async () => {
    fetchMock.mockResolvedValue(json({ code: 'SOMETHING_NEW', message: 'backend said so' }, 400))

    const error = await login({ email: 'a@example.com', password: 'password1' }).catch(
      (cause: unknown) => cause,
    )

    expect(describeAuthError(error)).toBe('backend said so')
  })

  it('网络不可达抛 AuthNetworkError，与后端错误码分开建模', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const error = await fetchCurrentAccount().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(AuthNetworkError)
    expect(describeAuthError(error)).toBe(
      'Cannot reach the server. Check your connection and try again.',
    )
  })

  it('取图形码走 GET /api/auth/captcha，返回 captchaId 与 image', async () => {
    fetchMock.mockResolvedValue(json({ captchaId: '01JCAPTCHA', image: 'data:image/png;base64,AAA' }))

    const captcha = await fetchCaptcha()

    expect(captcha).toEqual({ captchaId: '01JCAPTCHA', image: 'data:image/png;base64,AAA' })
    const { url, init } = lastCall()
    expect(url).toBe('/api/auth/captcha')
    expect(init.method).toBeUndefined()
  })

  it('换发邮箱注册码：POST /api/auth/register-code，请求体三个字段逐字对齐契约', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 202 }))

    await requestRegisterCode({
      email: 'a@example.com',
      captchaId: '01JCAPTCHA',
      captchaAnswer: 'a1b2',
    })

    const { url } = lastCall()
    expect(url).toBe('/api/auth/register-code')
    expect(Object.keys(lastBody())).toEqual(['email', 'captchaId', 'captchaAnswer'])
  })

  it('注册请求体四个字段逐字对齐契约，成功返回账户字段', async () => {
    fetchMock.mockResolvedValue(
      json({ publicId: '01JACCOUNT', email: 'a@example.com', displayName: 'Road Tester' }),
    )

    const result = await registerAccount({
      email: 'a@example.com',
      code: '123456',
      password: 'password1',
      displayName: 'Road Tester',
    })

    expect(result.publicId).toBe('01JACCOUNT')
    const { url } = lastCall()
    expect(url).toBe('/api/auth/register')
    expect(Object.keys(lastBody())).toEqual(['email', 'code', 'password', 'displayName'])
  })

  it('登出走 POST /api/auth/logout，204 无响应体也算成功', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(logout()).resolves.toBeUndefined()

    const { url, init } = lastCall()
    expect(url).toBe('/api/auth/logout')
    expect(init.method).toBe('POST')
  })

  it('非 JSON 错误体不会让解析炸掉，退回状态码派生的兜底文案', async () => {
    fetchMock.mockResolvedValue(
      new Response('后端服务不可达', { status: 502, headers: { 'content-type': 'application/json' } }),
    )

    const error = await login({ email: 'a@example.com', password: 'password1' }).catch(
      (cause: unknown) => cause,
    )

    expect(error).toBeInstanceOf(AuthApiError)
    expect(describeAuthError(error)).toBe('Request failed with status 502')
  })
})
