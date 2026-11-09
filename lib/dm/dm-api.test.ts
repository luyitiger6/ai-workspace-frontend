import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 真接口分支：在模块加载前把开关翻成 '0'，与 E2E 走的是同一条路径。
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_DM_MOCK = '0'
})

import {
  describeDmError,
  DmApiError,
  DmNetworkError,
  dmApi,
  isUnauthenticated,
  USE_MOCK_DM,
  type DmMessage,
  type DmStreamHandlers,
} from './dm-api'

const fetchMock = vi.fn()
const CONV = '01CONV00000000000000000001'
const PEER = '01PEER00000000000000000001'
const peer = { publicId: PEER, displayName: 'Lin', avatarUrl: '' }
const conversation = {
  publicId: CONV,
  peer,
  messageCount: 2,
  unreadCount: 1,
  lastMessagePreview: '你好',
  lastMessageAt: '2026-11-09T01:00:00Z',
  createdAt: '2026-11-09T00:00:00Z',
}
const message: DmMessage = {
  publicId: '01MSG000000000000000000001',
  senderPublicId: PEER,
  content: '你好',
  createdAt: '2026-11-09T01:00:00Z',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function lastRequest() {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  expect(path).toMatch(/^\/api\/dm/)
  expect(init.credentials).toBe('same-origin')
  expect(init.cache).toBe('no-store')
  expect(init.headers).toMatchObject({ accept: 'application/json' })
  return { path, init }
}

describe('真实私信端点层', () => {
  it('开关默认 Mock，设 0 后走真接口', () => {
    expect(USE_MOCK_DM).toBe(false)
  })

  it('会话列表读取 items，signal 原样传递', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValueOnce(json({ items: [conversation] }))
    expect(await dmApi.conversations(signal)).toEqual([conversation])
    expect(lastRequest()).toMatchObject({ path: '/api/dm/conversations', init: { signal } })
  })

  it('发起会话是 POST /api/dm/conversations，请求体只含 peerPublicId', async () => {
    fetchMock.mockResolvedValueOnce(json(conversation, 201))
    expect(await dmApi.create(PEER)).toEqual(conversation)
    const { path, init } = lastRequest()
    expect(path).toBe('/api/dm/conversations')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ peerPublicId: PEER })
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
  })

  it('消息分页：首页不带游标，游标原样回传不重建，hasMore 只从游标推导', async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [message], nextCursor: null }))
    const first = await dmApi.messages(CONV)
    const firstQuery = new URL(lastRequest().path, 'http://localhost').searchParams
    expect(firstQuery.get('limit')).toBe('20')
    expect(firstQuery.has('cursor')).toBe(false)
    expect(first).toMatchObject({ nextCursor: null, hasMore: false })
    expect(first.items).toEqual([message])

    const cursor = 'opaque+/=%中文'
    const signal = new AbortController().signal
    fetchMock.mockResolvedValueOnce(json({ items: [], nextCursor: cursor }))
    const second = await dmApi.messages(CONV, cursor, signal)
    expect(new URL(lastRequest().path, 'http://localhost').searchParams.get('cursor')).toBe(cursor)
    expect(lastRequest().init.signal).toBe(signal)
    expect(second.hasMore).toBe(true)
  })

  it('发送消息是 POST 到该会话消息路径，原文进请求体', async () => {
    fetchMock.mockResolvedValueOnce(json(message, 201))
    expect(await dmApi.send(CONV, ' 你好\n世界 ')).toEqual(message)
    const { path, init } = lastRequest()
    expect(path).toBe(`/api/dm/conversations/${CONV}/messages`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ content: ' 你好\n世界 ' })
  })

  it('标记已读是 POST 且没有请求体，返回更新后的会话摘要', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...conversation, unreadCount: 0 }))
    expect((await dmApi.markRead(CONV)).unreadCount).toBe(0)
    const { path, init } = lastRequest()
    expect(path).toBe(`/api/dm/conversations/${CONV}/read`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })

  it('未读总数只取 count 字段', async () => {
    fetchMock.mockResolvedValueOnce(json({ count: 7 }))
    expect(await dmApi.unreadCount()).toBe(7)
    expect(lastRequest().path).toBe('/api/dm/unread-count')
  })

  it.each([
    [404, 'DM_CONVERSATION_NOT_FOUND'],
    [404, 'DM_PEER_NOT_FOUND'],
    [400, 'DM_SELF_CONVERSATION'],
    [400, 'VALIDATION_FAILED'],
    [401, 'UNAUTHENTICATED'],
    [403, 'CROSS_SITE_REJECTED'],
  ])('HTTP %s / %s 不冒充成功且不自动重放', async (status, code) => {
    fetchMock.mockResolvedValue(json({ code, message: 'refused' }, status))
    await expect(dmApi.messages(CONV)).rejects.toMatchObject({ status, code })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const text = describeDmError(new DmApiError(status, code, 'refused'))
    expect(text).not.toBe('refused')
    expect(text).not.toContain('email or password')
  })

  it('四种拒绝各有各的文案，不混成一句', () => {
    const text = (code: string) => describeDmError(new DmApiError(400, code, 'raw'))
    expect(text('DM_SELF_CONVERSATION')).toContain('yourself')
    expect(text('DM_PEER_NOT_FOUND')).toContain('member')
    expect(text('DM_CONVERSATION_NOT_FOUND')).toContain('conversation')
    expect(text('VALIDATION_FAILED')).toContain('message')
    expect(text('UNAUTHENTICATED')).toContain('Log in')
    expect(text('SOMETHING_NEW')).toContain('status 400')
    expect(describeDmError(new Error('boom'))).toContain('Something went wrong')
    expect(isUnauthenticated(new DmApiError(401, 'UNAUTHENTICATED', 'x'))).toBe(true)
    expect(isUnauthenticated(new DmApiError(404, 'DM_CONVERSATION_NOT_FOUND', 'x'))).toBe(false)
  })

  it('网络失败归一为 DmNetworkError，文案可展示', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    const failure = await dmApi.conversations().catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(DmNetworkError)
    expect(describeDmError(failure)).toContain('Cannot reach the server')
    expect(isUnauthenticated(failure)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('非 JSON 502、null 错误体与成功非 JSON 均可控', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
    await expect(dmApi.conversations()).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' })
    fetchMock.mockResolvedValueOnce(json(null, 503))
    await expect(dmApi.conversations()).rejects.toMatchObject({ status: 503, code: 'UNKNOWN' })
    fetchMock.mockResolvedValueOnce(new Response('not JSON', { status: 200 }))
    await expect(dmApi.conversations()).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' })
  })

  it('AbortError 保持取消语义', async () => {
    const aborted = new DOMException('aborted', 'AbortError')
    fetchMock.mockRejectedValueOnce(aborted)
    await expect(dmApi.conversations()).rejects.toBe(aborted)
  })
})

// ---------------------------------------------------------------------------
// SSE：只验证「解析、回调、取消」三条契约，不依赖真实网络
// ---------------------------------------------------------------------------

class FakeEventSource {
  static last: FakeEventSource | null = null

  readonly url: string
  closed = false
  private listeners = new Map<string, Set<(event: unknown) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.last = this
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string, event: unknown) {
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }
}

describe('会话推送订阅', () => {
  beforeEach(() => {
    FakeEventSource.last = null
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  it('订阅该会话的 stream，解析 message 事件，open 后回调，取消时关闭连接', () => {
    const received: DmMessage[] = []
    let opens = 0
    const handlers: DmStreamHandlers = {
      onMessage: (item) => received.push(item),
      onOpen: () => {
        opens += 1
      },
    }

    const stop = dmApi.stream(CONV, handlers)
    const source = FakeEventSource.last as FakeEventSource
    expect(source.url).toBe(`/api/dm/conversations/${CONV}/stream`)

    source.emit('message', { data: JSON.stringify(message) })
    source.emit('message', { data: 'not json' })
    source.emit('message', { data: JSON.stringify({ publicId: 42 }) })
    source.emit('open', {})
    expect(received).toEqual([message])
    expect(opens).toBe(1)

    stop()
    expect(source.closed).toBe(true)
    source.emit('message', { data: JSON.stringify(message) })
    expect(received).toHaveLength(1)
  })
})
