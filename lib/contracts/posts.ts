/**
 * 帖子接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端的一个 DTO（`web/post/dto/*.java` 与
 * `web/post/interaction/dto/*.java`），字段名与 record 组件名完全相同，两侧一律 camelCase。
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

/** 帖子列表排序维度，与后端 `PostSortBy.dbValue()` 一致。 */
export type PostSortBy = 'publishedAt' | 'upVoteCount' | 'commentCount'

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
  commentCount: number
  upVoteCount: number
  bookmarkCount: number
}

/** GET /api/posts 的响应体。 */
export interface PostFeedResponse {
  items: PostSummaryResponse[]
  nextCursor: string | null
}

/** POST /api/posts/{publicId}/comments 的请求体。 */
export interface CommentCreateRequest {
  content: string
  parentPublicId: string | null
}

/** GET /api/posts/{publicId}/comments 列表中的单项，也是创建评论的响应体。 */
export interface CommentResponse {
  publicId: string
  postPublicId: string
  parentPublicId: string | null
  authorPublicId: string
  content: string
  createdAt: string
  updatedAt: string
}

/** GET /api/posts/{publicId}/comments 的响应体。 */
export interface CommentListResponse {
  items: CommentResponse[]
  nextCursor: string | null
}

/** POST /api/posts/{publicId}/votes 的请求体。 */
export interface VoteCreateRequest {
  direction: 'up' | 'down'
}

/** POST /api/posts/{publicId}/votes 的响应体。 */
export interface VoteResponse {
  publicId: string
  postPublicId: string
  authorPublicId: string
  direction: 'up' | 'down'
  createdAt: string
  updatedAt: string
}

/** POST /api/posts/{publicId}/bookmarks 的响应体。 */
export interface BookmarkResponse {
  publicId: string
  postPublicId: string
  authorPublicId: string
  createdAt: string
  updatedAt: string
}

/** 帖子端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const POST_ENDPOINTS = {
  create: '/api/posts',
  feed: '/api/posts',
  detail: (publicId: string) => `/api/posts/${publicId}`,
  update: (publicId: string) => `/api/posts/${publicId}`,
  delete: (publicId: string) => `/api/posts/${publicId}`,
  comments: (publicId: string) => `/api/posts/${publicId}/comments`,
  comment: (publicId: string, commentPublicId: string) => `/api/posts/${publicId}/comments/${commentPublicId}`,
  votes: (publicId: string) => `/api/posts/${publicId}/votes`,
  bookmarks: (publicId: string) => `/api/posts/${publicId}/bookmarks`,
} as const
