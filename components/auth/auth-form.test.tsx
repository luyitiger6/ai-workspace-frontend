import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError, AuthNetworkError } from '@/lib/auth/auth-api'
import { AuthForm } from './auth-form'
import type { MeResponse } from '@/lib/contracts/auth'

const { register, login, refresh, replace, query } = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  query: { value: '' },
}))

vi.mock('./auth-provider', () => ({
  useAuth: () => ({ register, login, refresh }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query.value),
}))

const fetchMock = vi.fn()

const CAPTCHA_BODY = { captchaId: '01JCAPTCHA', image: 'data:image/png;base64,AAA' }
const ACCOUNT: MeResponse = {
  publicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', email: 'a@example.com',
  displayName: 'Confirmed account', status: 'active', createdAt: '2026-10-30T00:00:00Z',
}
const TARGET = '/posts/01ARZ3NDEKTSV4RRFFQ69G5FAV'

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

/**
 * 表单自己直接调用的两个端点在这里表态：取图形码与换发邮箱注册码。
 * login / register 走 Provider，由上面的 mock 决定成功还是抛哪种错误码。
 */
function stubAuthRoutes(routes: {
  captcha?: () => Response
  registerCode?: () => Response
} = {}) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input)
    if (url === '/api/auth/captcha') {
      return (routes.captcha ?? (() => jsonResponse(CAPTCHA_BODY)))()
    }
    if (url === '/api/auth/register-code') {
      return (routes.registerCode ?? (() => new Response('', { status: 202 })))()
    }
    throw new TypeError(`unexpected fetch to ${url}`)
  })
}

function urls(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

function fillLogin(values: { email: string; password: string }) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: values.password } })
}

function fillRegister(values: {
  displayName: string
  email: string
  password: string
  confirm: string
  captchaAnswer?: string
}) {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: values.displayName } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: values.password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: values.confirm },
  })
  if (values.captchaAnswer !== undefined) {
    fireEvent.change(screen.getByLabelText('Image code'), {
      target: { value: values.captchaAnswer },
    })
  }
}

beforeEach(() => {
  register.mockReset()
  login.mockReset()
  replace.mockReset()
  refresh.mockReset()
  query.value = ''
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  stubAuthRoutes()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('登录表单', () => {
  it('凭证正确直接登录，全程不请求图形码端点', async () => {
    login.mockResolvedValue(ACCOUNT)

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'password1' })
    expect(urls()).toEqual([])
    expect(screen.queryByLabelText('Image code')).not.toBeInTheDocument()
  })

  it('密码提示按字节表述，并附汉字换算示例', () => {
    render(<AuthForm mode="login" />)

    const placeholder = screen.getByLabelText('Password').getAttribute('placeholder') ?? ''
    expect(placeholder).toContain('8-72 bytes')
    expect(placeholder).toContain('about 3-24 Chinese characters')
    // 8 是字节下限，不是字符下限：把下限说成 8 个字符就会误导中文用户。
    expect(placeholder).not.toContain('8 characters')
  })

  it('收到 CAPTCHA_INVALID 才取图形码，重试请求体带上图形码字段', async () => {
    login
      .mockRejectedValueOnce(new AuthApiError('CAPTCHA_INVALID', '图形验证码错误或已过期', 400, null))
      .mockResolvedValueOnce(ACCOUNT)

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'wrong123' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByLabelText('Image code')).toBeInTheDocument()
    expect(screen.getByAltText('Image verification challenge')).toBeInTheDocument()
    expect(urls()).toEqual(['/api/auth/captcha'])

    fireEvent.change(screen.getByLabelText('Image code'), { target: { value: 'a1b2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(login).toHaveBeenLastCalledWith({
      email: 'a@example.com',
      password: 'wrong123',
      captchaId: '01JCAPTCHA',
      captchaAnswer: 'a1b2',
    })
  })

  it('已展示图形码后，429、401 与网络错误都不换码', async () => {
    login
      .mockRejectedValueOnce(
        new AuthApiError('CAPTCHA_INVALID', '图形验证码错误或已过期', 400, null),
      )
      .mockRejectedValueOnce(new AuthApiError('RATE_LIMITED', '请求过于频繁', 429, 30))
      .mockRejectedValueOnce(new AuthApiError('UNAUTHENTICATED', '未认证', 401, null))
      .mockRejectedValueOnce(new AuthNetworkError())

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await screen.findByLabelText('Image code')

    fireEvent.change(screen.getByLabelText('Image code'), { target: { value: 'a1b2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('30 seconds'))

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('The email or password is incorrect.'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server'),
    )

    // 这三次失败都没走到图形码校验，码没有被消费就不该换。
    expect(urls().filter((url) => url === '/api/auth/captcha')).toHaveLength(1)
    expect(screen.getByLabelText('Image code')).toHaveValue('a1b2')
  })

  it('换码失败时原始失败原因与刷新失败提示同时可见', async () => {
    let captchaCalls = 0
    stubAuthRoutes({
      captcha: () => {
        captchaCalls += 1
        return captchaCalls === 1
          ? jsonResponse(CAPTCHA_BODY)
          : jsonResponse({ code: 'INTERNAL', message: 'boom' }, 500)
      },
    })
    login
      .mockRejectedValueOnce(
        new AuthApiError('CAPTCHA_INVALID', '图形验证码错误或已过期', 400, null),
      )
      .mockRejectedValueOnce(
        new AuthApiError('CAPTCHA_INVALID', '图形验证码错误或已过期', 400, null),
      )

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await screen.findByLabelText('Image code')

    fireEvent.change(screen.getByLabelText('Image code'), { target: { value: 'zzzz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Image code refresh failed. Please refresh it manually.'),
    ).toBeInTheDocument()
    // 两条信息并存：换码失败不能把登录失败的原因顶掉。
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The image verification answer is incorrect or has expired.',
    )
    // 换码失败也就没换掉码，用户已输入的答案仍然对得上那张图。
    expect(screen.getByLabelText('Image code')).toHaveValue('zzzz')
  })

  it('限流展示 Retry-After 的秒数，且不自动重试', async () => {
    login.mockRejectedValue(new AuthApiError('RATE_LIMITED', '请求过于频繁，请稍后再试', 429, 45))

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('45 seconds')
    expect(login).toHaveBeenCalledTimes(1)
    expect(urls()).toEqual([])
  })

  it('两个 403 文案不同：邮箱未验证与来源不可信不共用一句话', async () => {
    login.mockRejectedValueOnce(new AuthApiError('EMAIL_UNVERIFIED', '邮箱尚未验证', 403, null))
    const { unmount } = render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const unverifiedText = (await screen.findByRole('alert')).textContent

    unmount()
    login.mockRejectedValueOnce(new AuthApiError('CROSS_SITE_REJECTED', '请求来源不可信', 403, null))
    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const crossSiteText = (await screen.findByRole('alert')).textContent

    expect(unverifiedText).toContain('not been verified')
    expect(crossSiteText).toContain('origin is not trusted')
    expect(unverifiedText).not.toBe(crossSiteText)
  })

  it('401 只给一句统一的凭证错误提示，不区分邮箱是否存在', async () => {
    login.mockRejectedValue(new AuthApiError('UNAUTHENTICATED', '未认证', 401, null))

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'nobody@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email or password is incorrect.',
    )
  })

  it('登录失败后不跳转，按钮恢复可点', async () => {
    login.mockRejectedValue(new AuthApiError('UNAUTHENTICATED', '未认证', 401, null))

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await screen.findByRole('alert')

    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })
})

describe('注册表单', () => {
  it('进入注册页就取一张图形码，第一步按钮是换发邮箱码', async () => {
    render(<AuthForm mode="register" />)

    expect(await screen.findByLabelText('Image code')).toBeInTheDocument()
    expect(urls()).toEqual(['/api/auth/captcha'])
    expect(screen.getByRole('button', { name: 'Send email code' })).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument()
  })

  it('两次密码不一致时不发任何请求', () => {
    render(<AuthForm mode="register" />)

    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password2',
      captchaAnswer: 'a1b2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    expect(screen.getByRole('alert')).toHaveTextContent('The two passwords do not match')
    expect(register).not.toHaveBeenCalled()
    expect(urls()).toEqual(['/api/auth/captcha'])
  })

  it('第一步成功换发邮箱码后进入第二步，注册码端点只发一次', async () => {
    register.mockResolvedValue(ACCOUNT)

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')

    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'a1b2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    expect(await screen.findByLabelText('Email code')).toBeInTheDocument()
    expect(screen.getByText(/Step 2 of 2/)).toBeInTheDocument()
    expect(urls().filter((url) => url === '/api/auth/register-code')).toHaveLength(1)
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === '/api/auth/register-code')!
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      email: 'road@wanderchain.dev',
      captchaId: '01JCAPTCHA',
      captchaAnswer: 'a1b2',
    })
    expect(register).not.toHaveBeenCalled()
  })

  it('第二步提交注册，请求体四个字段取自契约，成功后离开注册页', async () => {
    register.mockResolvedValue(ACCOUNT)

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')
    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'a1b2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    fireEvent.change(await screen.findByLabelText('Email code'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and log in' }))

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(register).toHaveBeenCalledWith({
      email: 'road@wanderchain.dev',
      code: '654321',
      password: 'password1',
      displayName: 'Road Tester',
    })
  })

  it('图形码答错时停在第一步，不提交注册，并换一张新码', async () => {
    stubAuthRoutes({
      registerCode: () => jsonResponse({ code: 'CAPTCHA_INVALID', message: '图形验证码错误或已过期' }, 400),
    })

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')
    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'zzzz',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The image verification answer is incorrect or has expired.',
    )
    expect(screen.queryByLabelText('Email code')).not.toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
    // 进页面取一张、答错后再取一张：图形码是一次性的，旧码必须作废。
    expect(urls().filter((url) => url === '/api/auth/captcha')).toHaveLength(2)
    // 新码到位后，上一张的答案必须清空。
    expect(screen.getByLabelText('Image code')).toHaveValue('')
  })

  it('换发注册码被限流时展示等待秒数，且不重复发请求', async () => {
    stubAuthRoutes({
      registerCode: () =>
        jsonResponse({ code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }, 429, {
          'retry-after': '60',
        }),
    })

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')
    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'a1b2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('60 seconds')
    expect(urls().filter((url) => url === '/api/auth/register-code')).toHaveLength(1)
    expect(screen.queryByLabelText('Email code')).not.toBeInTheDocument()
    // 限流在图形码校验之前就拒了，这张码没被消费，不该换。
    expect(urls().filter((url) => url === '/api/auth/captcha')).toHaveLength(1)
  })

  it('注册第一步遇网络错误不换码，保留已输入的答案', async () => {
    stubAuthRoutes({
      registerCode: () => {
        throw new TypeError('fetch failed')
      },
    })

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')
    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'a1b2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
    expect(urls().filter((url) => url === '/api/auth/captcha')).toHaveLength(1)
    expect(screen.getByLabelText('Image code')).toHaveValue('a1b2')
    expect(screen.queryByLabelText('Email code')).not.toBeInTheDocument()
  })

  it('注册第一步换码失败时保留原始原因与已输入的答案', async () => {
    let captchaCalls = 0
    stubAuthRoutes({
      captcha: () => {
        captchaCalls += 1
        return captchaCalls === 1
          ? jsonResponse(CAPTCHA_BODY)
          : jsonResponse({ code: 'INTERNAL', message: 'boom' }, 500)
      },
      registerCode: () =>
        jsonResponse({ code: 'CAPTCHA_INVALID', message: '图形验证码错误或已过期' }, 400),
    })

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')
    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'zzzz',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))

    expect(
      await screen.findByText('Image code refresh failed. Please refresh it manually.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The image verification answer is incorrect or has expired.',
    )
    expect(screen.getByLabelText('Image code')).toHaveValue('zzzz')
    expect(screen.queryByLabelText('Email code')).not.toBeInTheDocument()
  })

  it('手动刷新失败也提示，刷新成功后提示消失', async () => {
    let captchaCalls = 0
    stubAuthRoutes({
      captcha: () => {
        captchaCalls += 1
        if (captchaCalls === 2) {
          return jsonResponse({ code: 'INTERNAL', message: 'boom' }, 500)
        }
        return jsonResponse(CAPTCHA_BODY)
      },
    })

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(
      await screen.findByText('Image code refresh failed. Please refresh it manually.'),
    ).toBeInTheDocument()
    // 刷新是用户主动发起的动作，它的失败不该写成那次提交的失败原因。
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await vi.waitFor(() =>
      expect(
        screen.queryByText('Image code refresh failed. Please refresh it manually.'),
      ).not.toBeInTheDocument(),
    )
  })

  it('提交中按钮禁用且文案为 Working…', async () => {
    let finish: () => void = () => undefined
    register.mockReturnValue(
      new Promise<MeResponse>((resolve) => {
        finish = () => resolve(ACCOUNT)
      }),
    )

    render(<AuthForm mode="register" />)
    await screen.findByLabelText('Image code')
    fillRegister({
      displayName: 'Road Tester',
      email: 'road@wanderchain.dev',
      password: 'password1',
      confirm: 'password1',
      captchaAnswer: 'a1b2',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
    fireEvent.change(await screen.findByLabelText('Email code'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and log in' }))

    const pendingButton = await screen.findByRole('button', { name: 'Working…' })
    expect(pendingButton).toBeDisabled()

    await act(async () => {
      finish()
    })
  })
})

describe('安全回跳与认证写后确认', () => {
  it.each(['login', 'register'] as const)('%s 互转只保留合法详情目标', async (mode) => {
    query.value = new URLSearchParams({ next: TARGET }).toString()
    render(<AuthForm mode={mode} />)
    const link = screen.getByRole('link', { name: mode === 'login' ? 'Create one' : 'Log in' })
    const href = new URL(link.getAttribute('href')!, 'http://localhost')
    expect(href.pathname).toBe(mode === 'login' ? '/register' : '/login')
    expect(href.searchParams.get('next')).toBe(TARGET)
    if (mode === 'register') await screen.findByLabelText('Image code')
  })

  it.each([
    ['合法目标', TARGET, TARGET],
    ['外链', 'https://evil.test', '/'],
    ['协议相对', '//evil.test', '/'],
    ['反斜杠', '\\evil.test', '/'],
    ['重复编码', encodeURIComponent(TARGET), '/'],
    ['带查询', TARGET + '?account=other', '/'],
    ['非法标识', '/posts/not-an-id', '/'],
  ])('%s 只在确认账户后导航', async (_name, next, expected) => {
    query.value = new URLSearchParams({ next }).toString()
    login.mockResolvedValue(ACCOUNT)
    render(<AuthForm mode="login" />)
    const href = screen.getByRole('link', { name: 'Create one' }).getAttribute('href')!
    if (expected === '/') expect(href).toBe('/register')
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(expected))
    expect(login).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
    expect(urls()).toEqual([])
  })

  it.each(['login', 'register'] as const)('%s 写成功但未确认时只重试读取，不重发写入', async (mode) => {
    query.value = new URLSearchParams({ next: TARGET }).toString()
    login.mockResolvedValue(null)
    register.mockResolvedValue(null)
    refresh.mockResolvedValueOnce(null).mockResolvedValueOnce(ACCOUNT)
    render(<AuthForm mode={mode} />)
    if (mode === 'register') {
      await screen.findByLabelText('Image code')
      fillRegister({ displayName: 'Road Tester', email: 'a@example.com', password: 'password1', confirm: 'password1', captchaAnswer: 'a1b2' })
      fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
      fireEvent.change(await screen.findByLabelText('Email code'), { target: { value: '654321' } })
    } else {
      fillLogin({ email: 'a@example.com', password: 'password1' })
    }
    fireEvent.click(screen.getByRole('button', { name: mode === 'login' ? 'Log in' : 'Sign up and log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('session could not be confirmed')
    expect(replace).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry session check' }))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Retry session check' })).toBeEnabled()
    expect(replace).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry session check' }))
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(TARGET))
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(mode === 'login' ? login : register).toHaveBeenCalledTimes(1)
    expect(mode === 'login' ? register : login).not.toHaveBeenCalled()
    expect(urls().filter(url => url === '/api/auth/register-code')).toHaveLength(mode === 'register' ? 1 : 0)
  })

  it('等待写入或会话重试期间连续 submit 只发一次', async () => {
    let finishLogin!: (account: MeResponse | null) => void
    let finishRefresh!: (account: MeResponse | null) => void
    login.mockReturnValue(new Promise(resolve => { finishLogin = resolve }))
    refresh.mockReturnValue(new Promise(resolve => { finishRefresh = resolve }))
    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    const form = screen.getByRole('button', { name: 'Log in' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(login).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    await act(async () => finishLogin(null))
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(refresh).toHaveBeenCalledTimes(1)
    await act(async () => finishRefresh(ACCOUNT))
    expect(login).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/')
  })
})
