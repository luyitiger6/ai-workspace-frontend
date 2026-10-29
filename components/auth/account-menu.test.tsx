import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './account-menu'
import { AuthProvider } from './auth-provider'

const fetchMock = vi.fn()

const ME_BODY = {
  publicId: '01JACCOUNT',
  email: 'editor@wanderchain.dev',
  displayName: 'Editor Lan',
  status: 'active',
  createdAt: '2026-10-29T03:00:00Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** 登录态由 GET /me 决定；退出后由后端清 cookie，这里让 /me 转而返回 401。 */
function stubMe(body: unknown, status = 200) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input)
    if (url === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }
    return jsonResponse(body, status)
  })
}

function renderMenu() {
  return render(
    <AuthProvider>
      <AccountMenu />
    </AuthProvider>,
  )
}

describe('账号入口', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('会话加载中先占位，不闪出登录入口', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))

    renderMenu()

    expect(screen.getByTestId('account-loading')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in / Sign up' })).not.toBeInTheDocument()
  })

  it('访客看到登录入口', async () => {
    stubMe({ code: 'UNAUTHENTICATED', message: '未认证' }, 401)

    renderMenu()

    expect(await screen.findByRole('link', { name: 'Log in / Sign up' })).toBeInTheDocument()
  })

  it('已登录用户看到后端返回的 displayName', async () => {
    stubMe(ME_BODY)

    renderMenu()

    expect(await screen.findByText('Editor Lan')).toBeInTheDocument()
  })

  it('不展示角色徽章：后端没有角色模型，界面也就不读它', async () => {
    stubMe({ ...ME_BODY, displayName: 'Lan Zhou' })

    const { container } = renderMenu()

    expect(await screen.findByText('Lan Zhou')).toBeInTheDocument()
    // 旧界面在这里会按 role 渲一个 Editor 徽章；后端根本没有角色字段，徽章必须跟着消失。
    expect(container.textContent).not.toContain('Editor')
    expect(container.querySelector('[class*="role"]')).toBeNull()
  })

  it('退出后回到访客态，且确实调用了后端登出端点', async () => {
    stubMe(ME_BODY)
    renderMenu()

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('link', { name: 'Log in / Sign up' })).toBeInTheDocument()
    expect(screen.queryByText('Editor Lan')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/logout')).toBe(true)
  })
})
