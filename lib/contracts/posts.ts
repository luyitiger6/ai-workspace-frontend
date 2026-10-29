/**
 * 帖子接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端的一个 DTO（`web/post/dto/*.java`），
 * 字段名与 record 组件名完全相同，两侧一律 camelCase。
 * 一致性不靠人盯：`harness/checks/10-contract-check.ps1` 会解析两侧的字段「名字 + 类型」做双向比对，
 * 后端新增 DTO 而这里没有镜像、这里多写一个后端没有的字段、任何一侧改成蛇形命名、
 * 共有字段两侧类型经 Java↔TS 映射表归一后不一致，闸门都直接非 0 退出。
 *
 * 类型约定（由闸门按 Java↔TS 映射表强制，不靠人盯）：
 * 1. 时间字段是 ISO-8601 字符串（后端 `Instant` 由 Jackson 序列化而来），不是毫秒数值；
 * 2. 状态字段是小写字面量联合（如 `PostStatus`，对应后端 `String`），不是枚举对象；
 * 3. 新增字段必须先改后端 DTO，再来这里镜像，顺序反过来闸门就会先红一次——这是设计意图。
 */

/** 帖子状态，取后端 `PostStatus.dbValue()` 的小写取值。 */
export type PostStatus = 'draft' | 'published'

/** POST /api/posts 的请求体。 */
export interface PostCreateRequest {
  title: string
  content: string
  coverImage: string
  tags: string[]
  status: PostStatus
}

/** PUT /api/posts/{publicId} 的请求体。 */
export interface PostUpdateRequest {
  title: string
  content: string
  coverImage: string
  tags: string[]
  status: PostStatus
}

/** GET /api/posts/{publicId} 的响应体。 */
export interface PostResponse {
  publicId: string
  title: string
  content: string
  coverImage: string
  tags: string[]
  status: PostStatus
  authorPublicId: string
  createdAt: string
  updatedAt: string
}

/** GET /api/posts 列表中的单项。 */
export interface PostSummaryResponse {
  publicId: string
  title: string
  coverImage: string
  tags: string[]
  status: PostStatus
  authorPublicId: string
  createdAt: string
  updatedAt: string
}

/** GET /api/posts 的响应体。 */
export interface PostFeedResponse {
  items: PostSummaryResponse[]
  nextCursor: string | null
}

/** 帖子端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const POST_ENDPOINTS = {
  create: '/api/posts',
  feed: '/api/posts',
  detail: (publicId: string) => `/api/posts/${publicId}`,
  update: (publicId: string) => `/api/posts/${publicId}`,
  delete: (publicId: string) => `/api/posts/${publicId}`,
} as const
