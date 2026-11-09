/**
 * 私信接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端 `web/dm/dto/*.java` 的 record，
 * 字段名与 record 组件名完全相同，两侧一律 camelCase。
 * 一致性不靠人盯：`harness/checks/10-contract-check.ps1` 会解析两侧的字段「名字 + 类型」
 * 做双向比对，并同在飞 change 的 `design.md`「## 契约」表做三方比对。
 *
 * 类型约定（由闸门按 Java↔TS 映射表强制）：
 * 1. 时间字段是 ISO-8601 字符串（后端 `Instant` 由 Jackson 序列化而来），不是毫秒数值；
 * 2. `lastMessagePreview` / `lastMessageAt` / `nextCursor` 在后端可空，这里写成 `string | null`
 *    ——`null` 表示「没有这条投影」，不用空串假装有；闸门会把 `| null` 归一成 `string` 再比。
 *
 * SSE 端点（`/stream`）不在「## 契约」表内：它的响应是 `text/event-stream`，没有 JSON 形状可比对；
 * 事件载荷就是下面这个 `DmMessageResponse`（design D7）。
 */

/** 会话对方的名片。与 profile 名片刻意是两份 DTO，字段漂移由 10 号闸门分别拦住（design D6）。 */
export interface DmPeerResponse {
  publicId: string
  displayName: string
  avatarUrl: string
}

/** 会话摘要：发起、列表项、标记已读三处复用。 */
export interface DmConversationResponse {
  publicId: string
  peer: DmPeerResponse
  messageCount: number
  unreadCount: number
  lastMessagePreview: string | null
  lastMessageAt: string | null
  createdAt: string
}

/** GET /api/dm/conversations 的响应体。 */
export interface DmConversationListResponse {
  items: DmConversationResponse[]
}

/** 单条消息，也是 SSE `message` 事件的载荷。 */
export interface DmMessageResponse {
  publicId: string
  senderPublicId: string
  content: string
  createdAt: string
}

/** GET /api/dm/conversations/{publicId}/messages 的响应体：`nextCursor` 为 null 表示没有更早的消息。 */
export interface DmMessageListResponse {
  items: DmMessageResponse[]
  nextCursor: string | null
}

/** POST /api/dm/conversations 的请求体：`peerPublicId` 是对方公开标识，不是内部 id。 */
export interface CreateConversationRequest {
  peerPublicId: string
}

/** POST /api/dm/conversations/{publicId}/messages 的请求体。 */
export interface SendMessageRequest {
  content: string
}

/** GET /api/dm/unread-count 的响应体：所有会话的未读总数。 */
export interface DmUnreadCountResponse {
  count: number
}

/** 私信端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const DM_ENDPOINTS = {
  conversations: '/api/dm/conversations',
  messages: (publicId: string) => `/api/dm/conversations/${publicId}/messages`,
  markRead: (publicId: string) => `/api/dm/conversations/${publicId}/read`,
  stream: (publicId: string) => `/api/dm/conversations/${publicId}/stream`,
  unreadCount: '/api/dm/unread-count',
} as const
