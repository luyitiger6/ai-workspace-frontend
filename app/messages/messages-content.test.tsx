import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dmApi, type DmConversation } from '@/lib/dm/dm-api'
import { MessagesContent } from './messages-content'

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const authMock = vi.hoisted(() => ({
  value: { status: 'user' as 'loading' | 'guest' | 'user', expireSession: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => authMock.value }))

function conversation(overrides: Partial<DmConversation> = {}): DmConversation {
  return {
    publicId: '01CONV00000000000000000001',
    peer: { publicId: '01PEER00000000000000000001', displayName: 'Ada', avatarUrl: '' },
    messageCount: 2,
    unreadCount: 0,
    lastMessagePreview: 'See you at the trailhead',
    lastMessageAt: '2026-11-09T10:00:00+08:00',
    createdAt: '2026-11-08T09:00:00+08:00',
    ...overrides,
  }
}

describe('/messages 会话列表', () => {
  beforeEach(() => {
    authMock.value = { status: 'user', expireSession: vi.fn() }
    routerMock.push.mockReset()
    routerMock.replace.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('空态：显示英文空态且不渲染会话项', async () => {
    vi.spyOn(dmApi, 'conversations').mockResolvedValue([])

    render(<MessagesContent />)

    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('列表渲染：按最近活跃倒序，显示名片、摘要与未读数', async () => {
    const older = conversation({
      publicId: '01CONV00000000000000000002',
      peer: { publicId: '01PEER00000000000000000002', displayName: 'Bo', avatarUrl: '' },
      lastMessagePreview: 'Older thread',
      lastMessageAt: '2026-11-08T10:00:00+08:00',
    })
    const newer = conversation({ unreadCount: 3 })
    vi.spyOn(dmApi, 'conversations').mockResolvedValue([older, newer])
    const streamSpy = vi.spyOn(dmApi, 'stream')

    render(<MessagesContent />)

    const list = await screen.findByRole('list')
    const items = within(list).getAllByRole('link')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveAttribute('href', `/messages/${newer.publicId}`)
    expect(items[1]).toHaveAttribute('href', `/messages/${older.publicId}`)
    expect(within(list).getByText('Ada')).toBeInTheDocument()
    expect(within(list).getByText('See you at the trailhead')).toBeInTheDocument()
    expect(within(list).getByText('3')).toBeInTheDocument()
    expect(within(list).getByText('unread')).toHaveClass('wc-visually-hidden')
    expect(within(list).getByText('Older thread')).toBeInTheDocument()
    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('新建成功跳转：解析用户页地址后创建并进入会话', async () => {
    const created = conversation({ lastMessageAt: null, lastMessagePreview: null })
    const conversationsSpy = vi.spyOn(dmApi, 'conversations').mockResolvedValue([])
    const createSpy = vi.spyOn(dmApi, 'create').mockResolvedValue(created)

    render(<MessagesContent />)
    await screen.findByText('No conversations yet.')

    await userEvent.type(screen.getByLabelText('Start a conversation'), `/users/${created.peer.publicId}`)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith(`/messages/${created.publicId}`))
    expect(createSpy).toHaveBeenCalledWith(created.peer.publicId)
    expect(conversationsSpy).toHaveBeenCalledTimes(1)
  })

  it('无法解析的输入不发请求，就地提示', async () => {
    vi.spyOn(dmApi, 'conversations').mockResolvedValue([])
    const createSpy = vi.spyOn(dmApi, 'create')

    render(<MessagesContent />)
    await screen.findByText('No conversations yet.')

    await userEvent.type(screen.getByLabelText('Start a conversation'), 'not-an-address')
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That doesn't look like a member address.")
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('未登录跳转登录页，不请求会话列表', async () => {
    authMock.value = { status: 'guest', expireSession: vi.fn() }
    const conversationsSpy = vi.spyOn(dmApi, 'conversations')

    render(<MessagesContent />)

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/login'))
    expect(conversationsSpy).not.toHaveBeenCalled()
  })
})
