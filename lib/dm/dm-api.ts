import {
  DM_ENDPOINTS,
  type CreateConversationRequest,
  type DmConversationListResponse,
  type DmConversationResponse,
  type DmMessageListResponse,
  type DmMessageResponse,
  type DmUnreadCountResponse,
  type SendMessageRequest,
} from '@/lib/contracts/dm'

/**
 * 私信数据的唯一调用点（tasks 5.2）。
 *
 * 与 `lib/profile/profile-api.ts` 同一条约定：默认 Mock，设 `NEXT_PUBLIC_DM_MOCK=0`
 * 即切真接口——E2E 与联调用这一环境变量，手动开发与单元测试保持 Mock。
 * Mock 收敛在本文件内，页面与组件只 import `dmApi`，不感知分流。
 *
 * 错误归一化只做一件事：把「没到达后端」与「后端明确的拒绝」分开建模。
 * 业务错误码一律保留原码，文案映射放在 `describeDmError`，页面不自己拼句子。
 */

/** 唯一开关：未设环境变量为 Mock；设 `NEXT_PUBLIC_DM_MOCK=0` 切真接口。 */
export const USE_MOCK_DM = process.env.NEXT_PUBLIC_DM_MOCK !== '0'

/** 视图类型直接取契约，不做恒等转换——后端返回的形状就是页面要用的形状。 */
export type DmPeer = DmConversationResponse['peer']
export type DmConversation = DmConversationResponse
export type DmMessage = DmMessageResponse

/** 消息分页：`hasMore` 只从游标推导，与帖子分页同一口径。 */
export interface DmMessagePage {
  items: DmMessage[]
  nextCursor: string | null
  hasMore: boolean
}

export interface DmStreamHandlers {
  /** 收到一条新消息；重复的 `publicId` 由调用方合并时去重。 */
  onMessage: (message: DmMessage) => void
  /**
   * 连接建立（含首次与断线重连）后触发。
   * 调用方据此重拉首页：既补齐断线期间漏掉的消息，也覆盖「首屏取数之后、连接建立之前」的空窗。
   */
  onOpen?: () => void
}

export class DmApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'DmApiError'
  }
}

export class DmNetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.')
    this.name = 'DmNetworkError'
  }
}

/** 是否因为会话失效被拒：页面据此跳登录，而不是显示一条泛化错误。 */
export function isUnauthenticated(cause: unknown): boolean {
  return cause instanceof DmApiError && cause.code === 'UNAUTHENTICATED'
}

/** 错误码到界面文案的映射。未知码回落到状态码兜底，不臆造文案。 */
export function describeDmError(cause: unknown): string {
  if (cause instanceof DmNetworkError) return cause.message
  if (!(cause instanceof DmApiError)) return 'Something went wrong. Please try again.'
  const messages: Record<string, string> = {
    UNAUTHENTICATED: 'Your session has expired. Log in to continue.',
    DM_SELF_CONVERSATION: 'You cannot start a conversation with yourself.',
    DM_PEER_NOT_FOUND: 'That member could not be found. Check the address and try again.',
    // 非参与者与不存在共用此码，文案也不区分：会话是否存在同样不该泄露（design D8）。
    DM_CONVERSATION_NOT_FOUND: 'This conversation is no longer available.',
    VALIDATION_FAILED: 'The message or the page cursor is not valid.',
    CROSS_SITE_REJECTED: 'The request was rejected because its origin is not trusted.',
  }
  return messages[cause.code] ?? `Request failed with status ${cause.status}. Please try again.`
}

/** 取消异常可来自浏览器/不同执行环境，不依赖 Error 构造器身份。 */
function isAbortError(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new DmNetworkError()
  }
  if (!response.ok) {
    let code = 'UNKNOWN'
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { code?: unknown; message?: unknown } | null
      if (typeof body?.code === 'string') code = body.code
      if (typeof body?.message === 'string') message = body.message
    } catch (cause) {
      if (isAbortError(cause)) throw cause
      // 非 JSON 上游失败保留真实状态码，不虚构业务错误。
    }
    throw new DmApiError(response.status, code, message)
  }
  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new DmApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
}

function post(body: unknown, signal?: AbortSignal): RequestInit {
  return { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

// ---------------------------------------------------------------------------
// 真接口实现（联调与 E2E 启用）
// ---------------------------------------------------------------------------

async function fetchConversationsReal(signal?: AbortSignal): Promise<DmConversation[]> {
  const page = await request<DmConversationListResponse>(DM_ENDPOINTS.conversations, { signal })
  return page.items
}

async function createConversationReal(peerPublicId: string, signal?: AbortSignal): Promise<DmConversation> {
  const body: CreateConversationRequest = { peerPublicId }
  // 首次发起 201、重复发起 200，两者响应体同形；前端不区分状态码。
  return request<DmConversationResponse>(DM_ENDPOINTS.conversations, post(body, signal))
}

async function fetchMessagesReal(
  publicId: string,
  cursor: string | null = null,
  signal?: AbortSignal,
): Promise<DmMessagePage> {
  const query = new URLSearchParams({ limit: '20' })
  if (cursor !== null) query.set('cursor', cursor)
  const page = await request<DmMessageListResponse>(`${DM_ENDPOINTS.messages(publicId)}?${query}`, { signal })
  return { items: page.items, nextCursor: page.nextCursor, hasMore: page.nextCursor !== null }
}

async function sendMessageReal(publicId: string, content: string, signal?: AbortSignal): Promise<DmMessage> {
  const body: SendMessageRequest = { content }
  // 与读取同一路径，方法不同：GET 取分页，POST 追加一条。
  return request<DmMessageResponse>(DM_ENDPOINTS.messages(publicId), post(body, signal))
}

async function markReadReal(publicId: string, signal?: AbortSignal): Promise<DmConversation> {
  return request<DmConversationResponse>(DM_ENDPOINTS.markRead(publicId), { method: 'POST', signal })
}

async function fetchUnreadCountReal(signal?: AbortSignal): Promise<number> {
  return (await request<DmUnreadCountResponse>(DM_ENDPOINTS.unreadCount, { signal })).count
}

/**
 * 真接口的 SSE 订阅（design D7）。
 *
 * `EventSource` 自己负责断线重连，这里不写重试逻辑，只把「连上了」转成一次 `onOpen`：
 * 重连期间漏掉的消息不靠事件流补，靠调用方重新拉首页补齐。
 * 返回的函数负责摘监听并关闭连接。
 */
function openStreamReal(publicId: string, handlers: DmStreamHandlers): () => void {
  const source = new EventSource(DM_ENDPOINTS.stream(publicId))
  const onMessage = (event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data) as DmMessage
      if (typeof message?.publicId === 'string') handlers.onMessage(message)
    } catch {
      // 载荷不是约定的 JSON：忽略这一条，不因为一次坏事件拆掉连接。
    }
  }
  const onOpen = () => handlers.onOpen?.()
  source.addEventListener('message', onMessage as EventListener)
  source.addEventListener('open', onOpen)
  return () => {
    source.removeEventListener('message', onMessage as EventListener)
    source.removeEventListener('open', onOpen)
    source.close()
  }
}

// ---------------------------------------------------------------------------
// Mock 实现（本阶段启用）：进程内可变状态，够页面走通「新建 → 发送 → 列表」全流程
// ---------------------------------------------------------------------------

/** Mock 会话里「我」的公开标识。一对一里除对方就是自己，页面据此判断气泡归属。 */
export const MOCK_SELF_PUBLIC_ID = '01MOCKDM0000000000000000SEL'

const MOCK_PAGE_SIZE = 20

interface MockConversation {
  publicId: string
  peer: DmPeer
  createdAt: string
  /** 按时间升序存放，返回时反转成后端那套「最新在前」。 */
  messages: DmMessage[]
  /** 已读到的消息条数：只有它之后的对方消息才算未读，与后端按位置重算同一口径。 */
  readCount: number
}

let mockConversations: MockConversation[] = []
let mockSequence = 0

/** 仅测试用：把 Mock 状态清回初始空列表，避免用例之间互相污染。 */
export function resetMockDm(): void {
  mockConversations = []
  mockSequence = 0
}

function nextMockId(prefix: string): string {
  mockSequence += 1
  return `mock-${prefix}-${mockSequence}`
}

function mockUnread(conversation: MockConversation): number {
  return conversation.messages
    .slice(conversation.readCount)
    .filter((message) => message.senderPublicId !== MOCK_SELF_PUBLIC_ID).length
}

/** 摘要与后端同一套投影：没有消息就没有预览，`lastMessageAt` 回落到创建时间。 */
function mockSummary(conversation: MockConversation): DmConversation {
  const last = conversation.messages.at(-1)
  return {
    publicId: conversation.publicId,
    peer: conversation.peer,
    messageCount: conversation.messages.length,
    unreadCount: mockUnread(conversation),
    lastMessagePreview: last ? Array.from(last.content).slice(0, 50).join('') : null,
    lastMessageAt: last ? last.createdAt : conversation.createdAt,
    createdAt: conversation.createdAt,
  }
}

function mockDisplayName(publicId: string): string {
  return `Member ${publicId.slice(-4)}`
}

async function mockFetchConversations(): Promise<DmConversation[]> {
  // 活跃度倒序：有消息按最后一条时间，没消息按创建时间，与后端排序一致。
  return [...mockConversations]
    .sort((a, b) => (mockSummary(b).lastMessageAt ?? '').localeCompare(mockSummary(a).lastMessageAt ?? ''))
    .map(mockSummary)
}

async function mockCreateConversation(peerPublicId: string): Promise<DmConversation> {
  const existing = mockConversations.find((conversation) => conversation.peer.publicId === peerPublicId)
  if (existing) return mockSummary(existing)
  if (peerPublicId === MOCK_SELF_PUBLIC_ID) {
    throw new DmApiError(400, 'DM_SELF_CONVERSATION', 'You cannot message yourself.')
  }
  const createdAt = new Date().toISOString()
  const created: MockConversation = {
    publicId: nextMockId('conv'),
    peer: { publicId: peerPublicId, displayName: mockDisplayName(peerPublicId), avatarUrl: '' },
    createdAt,
    messages: [],
    readCount: 0,
  }
  mockConversations = [...mockConversations, created]
  return mockSummary(created)
}

async function mockFetchMessages(publicId: string, cursor: string | null = null): Promise<DmMessagePage> {
  const conversation = mockConversations.find((item) => item.publicId === publicId)
  if (!conversation) throw new DmApiError(404, 'DM_CONVERSATION_NOT_FOUND', 'Conversation not found.')
  const newestFirst = [...conversation.messages].reverse()
  const start = cursor === null ? 0 : Number.parseInt(cursor, 10) || 0
  const items = newestFirst.slice(start, start + MOCK_PAGE_SIZE)
  const next = start + items.length
  const nextCursor = next < newestFirst.length ? String(next) : null
  return { items, nextCursor, hasMore: nextCursor !== null }
}

async function mockSendMessage(publicId: string, content: string): Promise<DmMessage> {
  const conversation = mockConversations.find((item) => item.publicId === publicId)
  if (!conversation) throw new DmApiError(404, 'DM_CONVERSATION_NOT_FOUND', 'Conversation not found.')
  const text = content.trim()
  if (text.length === 0 || Array.from(content).length > 2000) {
    throw new DmApiError(400, 'VALIDATION_FAILED', 'The message is not valid.')
  }
  // 原文入库：只判空与长度，不把用户的换行、缩进或首尾空格改掉。
  const message: DmMessage = {
    publicId: nextMockId('msg'),
    senderPublicId: MOCK_SELF_PUBLIC_ID,
    content,
    createdAt: new Date().toISOString(),
  }
  conversation.messages = [...conversation.messages, message]
  conversation.readCount = conversation.messages.length
  return message
}

async function mockMarkRead(publicId: string): Promise<DmConversation> {
  const conversation = mockConversations.find((item) => item.publicId === publicId)
  if (!conversation) throw new DmApiError(404, 'DM_CONVERSATION_NOT_FOUND', 'Conversation not found.')
  conversation.readCount = conversation.messages.length
  return mockSummary(conversation)
}

async function mockFetchUnreadCount(): Promise<number> {
  return mockConversations.reduce((total, conversation) => total + mockUnread(conversation), 0)
}

/** Mock 没有后端可连，订阅是无操作；页面照常调用，不写 mock 分支。 */
function openStreamMock(): () => void {
  return () => {}
}

// ---------------------------------------------------------------------------
// 唯一出口：页面与组件只 import `dmApi`，不感知 mock / 真接口的分流。
// ---------------------------------------------------------------------------

/**
 * 调用面写成显式接口，而不是让三元表达式推导联合类型：
 * 页面拿到的必须是同一套签名，signal 之类的可选参数不能因分流而消失。
 */
export interface DmApi {
  conversations(signal?: AbortSignal): Promise<DmConversation[]>
  create(peerPublicId: string, signal?: AbortSignal): Promise<DmConversation>
  messages(publicId: string, cursor?: string | null, signal?: AbortSignal): Promise<DmMessagePage>
  send(publicId: string, content: string, signal?: AbortSignal): Promise<DmMessage>
  markRead(publicId: string, signal?: AbortSignal): Promise<DmConversation>
  unreadCount(signal?: AbortSignal): Promise<number>
  /** 订阅会话推送，返回取消函数；Mock 下是无操作。 */
  stream(publicId: string, handlers: DmStreamHandlers): () => void
}

export const dmApi: DmApi = USE_MOCK_DM
  ? {
      conversations: mockFetchConversations,
      create: mockCreateConversation,
      messages: mockFetchMessages,
      send: mockSendMessage,
      markRead: mockMarkRead,
      unreadCount: mockFetchUnreadCount,
      stream: openStreamMock,
    }
  : {
      conversations: fetchConversationsReal,
      create: createConversationReal,
      messages: fetchMessagesReal,
      send: sendMessageReal,
      markRead: markReadReal,
      unreadCount: fetchUnreadCountReal,
      stream: openStreamReal,
    }
