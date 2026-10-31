import {
  POST_ENDPOINTS,
  type BookmarkResponse,
  type CommentCreateRequest,
  type CommentListResponse,
  type CommentResponse,
  type PostFeedResponse,
  type PostInteractionStateResponse,
  type PostResponse,
  type PostSortBy as HttpSortBy,
  type VoteCreateRequest,
  type VoteResponse,
} from '@/lib/contracts/posts'
import { toPostDetail, toPostSummary, type PostDetail, type PostPage, type PostSortBy } from './types'

export class PostsApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'PostsApiError'
  }
}

export class PostsNetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.')
    this.name = 'PostsNetworkError'
  }
}

/** 帖子业务文案不复用认证登录的凭证错误提示。 */
export function describePostsError(cause: unknown): string {
  if (cause instanceof PostsNetworkError) return cause.message
  if (!(cause instanceof PostsApiError)) return 'Something went wrong. Please try again.'
  const messages: Record<string, string> = {
    UNAUTHENTICATED: 'Your session has expired. Log in to continue.',
    POST_FORBIDDEN: 'You cannot perform this action. The state may have changed.',
    POST_NOT_FOUND: 'The requested post or interaction is no longer available.',
    VALIDATION_FAILED: 'The content or page cursor is not valid.',
    CROSS_SITE_REJECTED: 'The request was rejected because its origin is not trusted.',
  }
  return messages[cause.code] ?? `Request failed with status ${cause.status}. Please try again.`
}

const SORT_MAP: Record<PostSortBy, HttpSortBy> = {
  latest: 'publishedAt', hottest: 'upVoteCount', mostDiscussed: 'commentCount',
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
    // 取消仍是取消，由上下文代次决定忽略；网络写入失败不自动重试。
    if (isAbortError(cause)) throw cause
    throw new PostsNetworkError()
  }
  if (!response.ok) {
    let code = 'UNKNOWN'
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json() as { code?: unknown; message?: unknown } | null
      if (typeof body?.code === 'string') code = body.code
      if (typeof body?.message === 'string') message = body.message
    } catch (cause) {
      if (isAbortError(cause)) throw cause
      // 非 JSON 上游失败保留真实状态码，不虚构业务错误。
    }
    throw new PostsApiError(response.status, code, message)
  }
  if (response.status === 204) return undefined as T
  try {
    return await response.json() as T
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new PostsApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
}

function write(body: CommentCreateRequest | VoteCreateRequest, signal?: AbortSignal): RequestInit {
  return { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

export const postsApi = {
  async feed(sortBy: PostSortBy, cursor: string | null = null, signal?: AbortSignal): Promise<PostPage> {
    const query = new URLSearchParams({ sortBy: SORT_MAP[sortBy], limit: '20' })
    if (cursor !== null) query.set('cursor', cursor)
    const page = await request<PostFeedResponse>(`${POST_ENDPOINTS.feed}?${query}`, { signal })
    return { items: page.items.map(toPostSummary), nextCursor: page.nextCursor, hasMore: page.nextCursor !== null }
  },
  async detail(publicId: string, signal?: AbortSignal): Promise<PostDetail> {
    return toPostDetail(await request<PostResponse>(POST_ENDPOINTS.detail(publicId), { signal }))
  },
  comments(publicId: string, cursor: string | null = null, signal?: AbortSignal): Promise<CommentListResponse> {
    const query = new URLSearchParams({ limit: '20' })
    if (cursor !== null) query.set('cursor', cursor)
    return request(`${POST_ENDPOINTS.comments(publicId)}?${query}`, { signal })
  },
  readMyInteractions(publicId: string, signal?: AbortSignal): Promise<PostInteractionStateResponse> {
    return request(POST_ENDPOINTS.myInteractions(publicId), { signal })
  },
  createComment(publicId: string, input: CommentCreateRequest, signal?: AbortSignal): Promise<CommentResponse> {
    return request(POST_ENDPOINTS.comments(publicId), write(input, signal))
  },
  deleteComment(publicId: string, commentId: string, signal?: AbortSignal): Promise<void> {
    return request(POST_ENDPOINTS.comment(publicId, commentId), { method: 'DELETE', signal })
  },
  vote(publicId: string, direction: VoteCreateRequest['direction'], signal?: AbortSignal): Promise<VoteResponse> {
    return request(POST_ENDPOINTS.votes(publicId), write({ direction }, signal))
  },
  cancelVote(publicId: string, signal?: AbortSignal): Promise<void> {
    return request(POST_ENDPOINTS.votes(publicId), { method: 'DELETE', signal })
  },
  bookmark(publicId: string, signal?: AbortSignal): Promise<BookmarkResponse> {
    return request(POST_ENDPOINTS.bookmarks(publicId), { method: 'POST', signal })
  },
  cancelBookmark(publicId: string, signal?: AbortSignal): Promise<void> {
    return request(POST_ENDPOINTS.bookmarks(publicId), { method: 'DELETE', signal })
  },
}
