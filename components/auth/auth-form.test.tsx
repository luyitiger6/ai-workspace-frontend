import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@/lib/auth/auth-api'
import { AuthForm } from './auth-form'

const { register, login, replace } = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('./auth-provider', () => ({
  useAuth: () => ({ register, login }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

const fetchMock = vi.fn()

const CAPTCHA_BODY = { captchaId: '01JCAPTCHA', image: 'data:image/png;base64,AAA' }

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
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  stubAuthRoutes()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('登录表单', () => {
  it('凭证正确直接登录，全程不请求图形码端点', async () => {
    login.mockResolvedValue(undefined)

    render(<AuthForm mode="login" />)
    fillLogin({ email: 'a@example.com', password: 'password1' })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'password1' })
    expect(urls()).toEqual([])
    expect(screen.queryByLabelText('Image code')).not.toBeInTheDocument()
  })

  it('密码提示的下限是 8 而不是 6', () => {
    render(<AuthForm mode="login" />)

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'placeholder',
      'At least 8 characters (up to 72)',
    )
  })

  it('收到 CAPTCHA_INVALID 才取图形码，重试请求体带上图形码字段', async () => {
    login
      .mockRejectedValueOnce(new AuthApiError('CAPTCHA_INVALID', '图形验证码错误或已过期', 400, null))
      .mockResolvedValueOnce(undefined)

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
    register.mockResolvedValue(undefined)

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
    register.mockResolvedValue(undefined)

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
  })

  it('提交中按钮禁用且文案为 Working…', async () => {
    let finish: () => void = () => undefined
    register.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
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
