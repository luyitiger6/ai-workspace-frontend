import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dmApi } from '@/lib/dm/dm-api'
import { MessageBadge } from './message-badge'

const authMock = vi.hoisted(() => ({
  value: { status: 'user' as 'loading' | 'guest' | 'user', expireSession: vi.fn() },
}))

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => authMock.value }))

describe('MessageBadge', () => {
  beforeEach(() => {
    authMock.value = { status: 'user', expireSession: vi.fn() }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('已登录：读取未读总数并显示角标', async () => {
    const unreadSpy = vi.spyOn(dmApi, 'unreadCount').mockResolvedValue(3)

    render(<MessageBadge />)

    const link = screen.getByRole('link', { name: /Messages/ })
    expect(link).toHaveAttribute('href', '/messages')
    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('unread')).toHaveClass('wc-visually-hidden')
    expect(unreadSpy).toHaveBeenCalledTimes(1)
  })

  it('未读数超过 99 显示 99+', async () => {
    vi.spyOn(dmApi, 'unreadCount').mockResolvedValue(120)

    render(<MessageBadge />)

    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('未登录：不渲染入口也不发请求', () => {
    authMock.value = { status: 'guest', expireSession: vi.fn() }
    const unreadSpy = vi.spyOn(dmApi, 'unreadCount')

    render(<MessageBadge />)

    expect(screen.queryByRole('link', { name: /Messages/ })).not.toBeInTheDocument()
    expect(unreadSpy).not.toHaveBeenCalled()
  })

  it('窗口重新获得焦点时刷新一次，不做轮询', async () => {
    const unreadSpy = vi.spyOn(dmApi, 'unreadCount').mockResolvedValueOnce(3).mockResolvedValue(5)

    render(<MessageBadge />)
    expect(await screen.findByText('3')).toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    expect(unreadSpy).toHaveBeenCalledTimes(2)
  })
})
