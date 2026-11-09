import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dmApi,
  type DmConversation,
  type DmMessage,
  type DmStreamHandlers,
} from '@/lib/dm/dm-api'
import { Conversation } from './conversation'

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const authMock = vi.hoisted(() => ({
  value: { status: 'user' as 'loading' | 'guest' | 'user', expireSession: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => authMock.value }))

const CONVERSATION_ID = '01CONV00000000000000000001'
const PEER_ID = '01PEER00000000000000000001'
const SELF_ID = '01SELF00000000000000000001'

function conversation(): DmConversation {
  return {
    publicId: CONVERSATION_ID,
    peer: { publicId: PEER_ID, displayName: 'Ada', avatarUrl: '' },
    messageCount: 1,
    unreadCount: 0,
    lastMessagePreview: 'Hello from Ada',
    lastMessageAt: '2026-11-09T10:00:00+08:00',
    createdAt: '2026-11-08T09:00:00+08:00',
  }
}

function message(publicId: string, content: string, senderPublicId: string, createdAt: string): DmMessage {
  return { publicId, senderPublicId, content, createdAt }
}

/** 捕获页面注册的推送处理器，测试用它驱动推送与重连，而不是真的连 EventSource。 */
function mockStream() {
  let handlers: DmStreamHandlers | null = null
  const stop = vi.fn()
  const streamSpy = vi.spyOn(dmApi, 'stream').mockImplementation((_publicId, incoming) => {
    handlers = incoming
    return stop
  })
  return {
    stop,
    streamSpy,
    /** 订阅发生在 ready 之后的一个 effect 里：等到它真的注册再驱动处理器。 */
    handlers: async () => {
      await waitFor(() => expect(streamSpy).toHaveBeenCalled())
      if (handlers === null) throw new Error('stream was not subscribed')
      return handlers
    },
  }
}

describe('/messages/[publicId] 会话页', () => {
  beforeEach(() => {
    authMock.value = { status: 'user', expireSession: vi.fn() }
    routerMock.push.mockReset()
    routerMock.replace.mockReset()
    vi.spyOn(dmApi, 'markRead').mockResolvedValue(conversation())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('发送成功追加：新消息进入列表并清空输入', async () => {
    const opener = message('01MSG0000000000000000000001', 'Hello from Ada', PEER_ID, '2026-11-09T10:00:00+08:00')
    vi.spyOn(dmApi, 'messages').mockResolvedValue({ items: [opener], nextCursor: null, hasMore: false })
    const sent = message('01MSG0000000000000000000002', 'Hi Ada', SELF_ID, '2026-11-09T10:01:00+08:00')
    const sendSpy = vi.spyOn(dmApi, 'send').mockResolvedValue(sent)
    mockStream()

    render(<Conversation publicId={CONVERSATION_ID} />)
    expect(await screen.findByText('Hello from Ada')).toBeInTheDocument()

    const composer = screen.getByLabelText('Message')
    await userEvent.type(composer, 'Hi Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Hi Ada')).toBeInTheDocument()
    expect(sendSpy).toHaveBeenCalledWith(CONVERSATION_ID, 'Hi Ada')
    await waitFor(() => expect(composer).toHaveValue(''))
  })

  it('进入即标记已读：与会话首页并发发出', async () => {
    const opener = message('01MSG0000000000000000000001', 'Hello from Ada', PEER_ID, '2026-11-09T10:00:00+08:00')
    vi.spyOn(dmApi, 'messages').mockResolvedValue({ items: [opener], nextCursor: null, hasMore: false })
    const markReadSpy = vi.spyOn(dmApi, 'markRead').mockResolvedValue(conversation())
    mockStream()

    render(<Conversation publicId={CONVERSATION_ID} />)
    await screen.findByText('Hello from Ada')

    expect(markReadSpy).toHaveBeenCalledWith(CONVERSATION_ID, expect.any(AbortSignal))
  })

  it('推送去重：同一 publicId 只保留一条，新消息追加', async () => {
    const first = message('01MSG0000000000000000000001', 'First', PEER_ID, '2026-11-09T10:00:00+08:00')
    const second = message('01MSG0000000000000000000002', 'Second', PEER_ID, '2026-11-09T10:01:00+08:00')
    vi.spyOn(dmApi, 'messages').mockResolvedValue({ items: [first], nextCursor: null, hasMore: false })
    const stream = mockStream()

    render(<Conversation publicId={CONVERSATION_ID} />)
    await screen.findByText('First')

    const handlers = await stream.handlers()
    await act(async () => {
      handlers.onMessage(first)
    })
    expect(screen.getAllByText('First')).toHaveLength(1)

    await act(async () => {
      handlers.onMessage(second)
    })
    expect(screen.getAllByText('Second')).toHaveLength(1)
  })

  it('断线重连补齐：onOpen 重拉首页合并，不重复不遗漏', async () => {
    const first = message('01MSG0000000000000000000001', 'First', PEER_ID, '2026-11-09T10:00:00+08:00')
    const second = message('01MSG0000000000000000000002', 'Second', PEER_ID, '2026-11-09T10:01:00+08:00')
    const messagesSpy = vi
      .spyOn(dmApi, 'messages')
      .mockResolvedValueOnce({ items: [first], nextCursor: null, hasMore: false })
      .mockResolvedValue({ items: [second, first], nextCursor: null, hasMore: false })
    const stream = mockStream()

    render(<Conversation publicId={CONVERSATION_ID} />)
    await screen.findByText('First')

    const handlers = await stream.handlers()
    await act(async () => {
      handlers.onOpen?.()
    })

    expect(await screen.findByText('Second')).toBeInTheDocument()
    expect(screen.getAllByText('First')).toHaveLength(1)
    expect(messagesSpy).toHaveBeenCalledTimes(2)
  })

  it('未登录跳转登录页，不拉取会话', async () => {
    authMock.value = { status: 'guest', expireSession: vi.fn() }
    const messagesSpy = vi.spyOn(dmApi, 'messages')

    render(<Conversation publicId={CONVERSATION_ID} />)

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/login'))
    expect(messagesSpy).not.toHaveBeenCalled()
  })
})
