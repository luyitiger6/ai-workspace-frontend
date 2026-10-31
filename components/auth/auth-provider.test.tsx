import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth-provider'

const fetchMock = vi.fn()

const ME_BODY = {
  publicId: '01JACCOUNT',
  email: 'a@example.com',
  displayName: 'Server Name',
  status: 'active',
  createdAt: '2026-10-29T03:00:00Z',
}

const LOGIN_BODY = {
  publicId: '01JACCOUNT',
  email: 'a@example.com',
  displayName: 'Login Response Name',
  expiresAt: '2026-11-05T03:00:00Z',
}

const UNAUTHENTICATED = () =>
  new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: '未认证' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** 按 URL 分派响应：认证链路的每个端点在用例里各自表态。 */
function routeResponses(routes: Record<string, () => Response | Promise<Response>>) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input)
    const handler = routes[url]
    if (!handler) {
      throw new TypeError(`unexpected fetch to ${url}`)
    }
    return handler()
  })
}

function Probe() {
  const { status, user, login, register, logout, refresh } = useAuth()
  const [result, setResult] = useState('pending')
  const report = (account: Awaited<ReturnType<typeof refresh>>) => setResult(JSON.stringify(account))
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="displayName">{user?.displayName ?? ''}</span>
      <span data-testid="result">{result}</span>
      <button
        type="button"
        onClick={() => void login({ email: 'a@example.com', password: 'password1' }).then(report)}
      >
        do-login
      </button>
      <button type="button" onClick={() => void refresh().then(report)}>do-refresh</button>
      <button type="button" onClick={() => void register({ email: 'a@example.com', password: 'password1', displayName: 'Submitted Name', code: '654321' }).then(report)}>do-register</button>
      <button type="button" onClick={() => void logout()}>
        do-logout
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('会话状态来源', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('首帧是加载态，随后由 GET /me 判定为访客', async () => {
    routeResponses({ '/api/auth/me': UNAUTHENTICATED })

    renderProbe()

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    expect(await screen.findByText('guest')).toBeInTheDocument()
    expect(screen.getByTestId('displayName')).toHaveTextContent('')
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['/api/auth/me'])
  })

  it('GET /me 返回账户时进入已登录态并展示 displayName', async () => {
    routeResponses({ '/api/auth/me': () => jsonResponse(ME_BODY) })

    renderProbe()

    expect(await screen.findByText('user')).toBeInTheDocument()
    expect(screen.getByTestId('displayName')).toHaveTextContent('Server Name')
  })

  it('GET /me 网络失败归为访客态，不抛未捕获异常', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    try {
      renderProbe()

      expect(await screen.findByText('guest')).toBeInTheDocument()
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('登录成功后重新拉 /me：界面显示服务端认定的账户，而不是登录响应里的近似值', async () => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/login': () => jsonResponse(LOGIN_BODY),
    })
    // 首次探测时还没有会话
    fetchMock.mockResolvedValueOnce(UNAUTHENTICATED())

    renderProbe()
    expect(await screen.findByText('guest')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'do-login' }))

    expect(await screen.findByText('user')).toBeInTheDocument()
    expect(screen.getByTestId('displayName')).toHaveTextContent('Server Name')
    expect(screen.getByTestId('displayName')).not.toHaveTextContent('Login Response Name')
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/auth/me',
      '/api/auth/login',
      '/api/auth/me',
    ])
  })

  it('登录请求体带 credentials，令牌不出现在任何前端状态里', async () => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/login': () => jsonResponse(LOGIN_BODY),
    })
    fetchMock.mockResolvedValueOnce(UNAUTHENTICATED())

    renderProbe()
    fireEvent.click(await screen.findByRole('button', { name: 'do-login' }))
    await screen.findByText('user')

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'a@example.com',
      password: 'password1',
    })
  })

  it('登出调用后端端点并回到访客态', async () => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/logout': () => new Response(null, { status: 204 }),
    })

    renderProbe()
    expect(await screen.findByText('user')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'do-logout' }))

    expect(await screen.findByText('guest')).toBeInTheDocument()
    expect(screen.getByTestId('displayName')).toHaveTextContent('')
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/logout')).toBe(true)
  })

  it('登出接口返回 500 仍回到访客态，且不产生未处理的 rejection', async () => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/logout': () => jsonResponse({ code: 'INTERNAL', message: 'boom' }, 500),
    })
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    try {
      renderProbe()
      expect(await screen.findByText('user')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'do-logout' }))

      expect(await screen.findByText('guest')).toBeInTheDocument()
      expect(screen.getByTestId('displayName')).toHaveTextContent('')
      // 未捕获的 rejection 要等微任务队列排空才会浮上来。
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('登出请求因网络错误失败同样回到访客态', async () => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/logout': () => {
        throw new TypeError('fetch failed')
      },
    })

    renderProbe()
    expect(await screen.findByText('user')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'do-logout' }))

    expect(await screen.findByText('guest')).toBeInTheDocument()
    expect(screen.getByTestId('displayName')).toHaveTextContent('')
  })

  it('整个认证流程不往浏览器可读存储写任何东西', async () => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/login': () => jsonResponse(LOGIN_BODY),
    })
    fetchMock.mockResolvedValueOnce(UNAUTHENTICATED())

    renderProbe()
    fireEvent.click(await screen.findByRole('button', { name: 'do-login' }))
    await screen.findByText('user')

    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it.each(['login', 'register'] as const)('%s 返回的确认结果来自 /me，而不是写响应', async (mode) => {
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      [`/api/auth/${mode}`]: () => jsonResponse(LOGIN_BODY, mode === 'register' ? 201 : 200),
    })
    fetchMock.mockResolvedValueOnce(UNAUTHENTICATED())
    renderProbe()
    await screen.findByText('guest')
    fireEvent.click(screen.getByRole('button', { name: `do-${mode}` }))
    await vi.waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent(JSON.stringify(ME_BODY)))
    expect(screen.getByTestId('status')).toHaveTextContent('user')
    expect(screen.getByTestId('displayName')).toHaveTextContent('Server Name')
  })

  it.each([
    ['login', '401'], ['register', '401'], ['login', '500'], ['register', '500'],
    ['login', 'network'], ['register', 'network'],
  ] as const)('%s 写成功但 /me %s 时返回 null；重试只读 /me', async (mode, failure) => {
    let confirmed = false
    routeResponses({
      '/api/auth/me': () => {
        if (confirmed) return jsonResponse(ME_BODY)
        if (failure === 'network') throw new TypeError('offline')
        return failure === '401' ? UNAUTHENTICATED() : jsonResponse({ code: 'INTERNAL' }, 500)
      },
      [`/api/auth/${mode}`]: () => jsonResponse(LOGIN_BODY, mode === 'register' ? 201 : 200),
    })
    fetchMock.mockResolvedValueOnce(UNAUTHENTICATED())
    renderProbe()
    await screen.findByText('guest')
    fireEvent.click(screen.getByRole('button', { name: `do-${mode}` }))
    await vi.waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('null'))
    expect(screen.getByTestId('status')).toHaveTextContent('guest')
    expect(screen.getByTestId('displayName')).toHaveTextContent('')
    confirmed = true
    fireEvent.click(screen.getByRole('button', { name: 'do-refresh' }))
    await screen.findByText('user')
    expect(screen.getByTestId('result')).toHaveTextContent(JSON.stringify(ME_BODY))
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/auth/me', `/api/auth/${mode}`, '/api/auth/me', '/api/auth/me',
    ])
  })

  it('新会话确认后迟到的初始 /me 不覆盖账户', async () => {
    let finish!: (response: Response) => void
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/login': () => jsonResponse(LOGIN_BODY),
    })
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve }))
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'do-login' }))
    await screen.findByText('user')
    await act(async () => finish(UNAUTHENTICATED()))
    expect(screen.getByTestId('status')).toHaveTextContent('user')
    expect(screen.getByTestId('displayName')).toHaveTextContent('Server Name')
  })

  it('较新的 refresh 优先，登出后迟到读取不恢复账户', async () => {
    let finishOld!: (response: Response) => void
    let finishLogoutRead!: (response: Response) => void
    routeResponses({
      '/api/auth/me': () => jsonResponse(ME_BODY),
      '/api/auth/logout': () => new Response(null, { status: 204 }),
    })
    renderProbe()
    await screen.findByText('user')
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { finishOld = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'do-refresh' }))
    fireEvent.click(screen.getByRole('button', { name: 'do-refresh' }))
    await screen.findByText('user')
    await act(async () => finishOld(jsonResponse({ ...ME_BODY, displayName: 'Old account' })))
    expect(screen.getByTestId('displayName')).toHaveTextContent('Server Name')
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { finishLogoutRead = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'do-refresh' }))
    fireEvent.click(screen.getByRole('button', { name: 'do-logout' }))
    await screen.findByText('guest')
    await act(async () => finishLogoutRead(jsonResponse(ME_BODY)))
    expect(screen.getByTestId('status')).toHaveTextContent('guest')
    expect(screen.getByTestId('displayName')).toHaveTextContent('')
    expect(screen.getByTestId('result')).toHaveTextContent('null')
  })
})
