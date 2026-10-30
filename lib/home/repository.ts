import { ATTRACTIONS, EDITOR_PICKS, POSTS } from './mock-data'
import type {
  Attraction,
  EditorPick,
  ListQuery,
  ListResult,
  Post,
  PostFeedResult,
  PostSortBy,
} from './types'

export const EDITOR_PICKS_LIMIT = 6
export const HOT_POSTS_LIMIT = 10
export const HOT_ATTRACTIONS_LIMIT = 5
export const POST_FEED_LIMIT = 8

/** 数据源契约：真实 API 接入时只需要另一个实现，组件与测试不动。 */
export interface HomeRepository {
  listEditorPicks(query: ListQuery): Promise<ListResult<EditorPick>>
  listHotPosts(query: ListQuery): Promise<ListResult<Post>>
  listHotAttractions(query: ListQuery): Promise<ListResult<Attraction>>
  feedPosts(sortBy: PostSortBy, cursor: string | null): Promise<PostFeedResult<Post>>
}

function matchesCity(item: { city: string }, query: ListQuery): boolean {
  return query.city === 'all' || item.city === 'all' || item.city === query.city
}

function toTime(value: string): number {
  return new Date(value).getTime()
}

function bySortOrder(a: EditorPick, b: EditorPick): number {
  return a.sortOrder - b.sortOrder || a.id - b.id
}

function byComments(a: Post, b: Post): number {
  return (
    b.commentCount - a.commentCount ||
    b.viewCount - a.viewCount ||
    toTime(b.publishedAt) - toTime(a.publishedAt) ||
    a.id - b.id
  )
}

function byViews(a: Attraction, b: Attraction): number {
  return (
    b.viewCount - a.viewCount ||
    toTime(b.publishedAt) - toTime(a.publishedAt) ||
    a.id - b.id
  )
}

function byLatest(a: Post, b: Post): number {
  return toTime(b.publishedAt) - toTime(a.publishedAt) || a.id - b.id
}

function byHottest(a: Post, b: Post): number {
  return (
    b.upVoteCount - a.upVoteCount ||
    b.viewCount - a.viewCount ||
    toTime(b.publishedAt) - toTime(a.publishedAt) ||
    a.id - b.id
  )
}

function byMostDiscussed(a: Post, b: Post): number {
  return (
    b.commentCount - a.commentCount ||
    b.viewCount - a.viewCount ||
    toTime(b.publishedAt) - toTime(a.publishedAt) ||
    a.id - b.id
  )
}

const SORT_COMPARATORS: Record<PostSortBy, (a: Post, b: Post) => number> = {
  latest: byLatest,
  hottest: byHottest,
  mostDiscussed: byMostDiscussed,
}

/** total 是截断前的匹配总数，items 是本次返回的窗口。 */
function paginate<T>(matched: T[], limit: number): ListResult<T> {
  return { items: matched.slice(0, limit), total: matched.length }
}

interface FeedCursor {
  sortBy: PostSortBy
  offset: number
}

function encodeCursor(cursor: FeedCursor): string {
  return btoa(JSON.stringify(cursor))
}

function decodeCursor(raw: string): FeedCursor {
  try {
    const parsed = JSON.parse(atob(raw))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.offset === 'number' &&
      (parsed.sortBy === 'latest' || parsed.sortBy === 'hottest' || parsed.sortBy === 'mostDiscussed')
    ) {
      return parsed as FeedCursor
    }
  } catch {
    // fall through to throw
  }
  throw new Error('Invalid cursor')
}

function feedCursor(cursor: string | null, expectedSortBy: PostSortBy): number {
  if (!cursor) {
    return 0
  }
  const decoded = decodeCursor(cursor)
  if (decoded.sortBy !== expectedSortBy) {
    throw new Error('Cursor sort mismatch')
  }
  return decoded.offset
}

export const mockRepository: HomeRepository = {
  async listEditorPicks(query) {
    const matched = EDITOR_PICKS.filter((pick) => matchesCity(pick, query)).sort(bySortOrder)
    return paginate(matched, EDITOR_PICKS_LIMIT)
  },

  async listHotPosts(query) {
    const matched = POSTS.filter(
      (post) => post.status === 'published' && matchesCity(post, query),
    ).sort(byComments)
    return paginate(matched, HOT_POSTS_LIMIT)
  },

  async listHotAttractions(query) {
    const matched = ATTRACTIONS.filter(
      (item) => item.status === 'published' && matchesCity(item, query),
    ).sort(byViews)
    return paginate(matched, HOT_ATTRACTIONS_LIMIT)
  },

  async feedPosts(sortBy, cursor) {
    const offset = feedCursor(cursor, sortBy)
    const matched = POSTS.filter((post) => post.status === 'published').sort(SORT_COMPARATORS[sortBy])
    const items = matched.slice(offset, offset + POST_FEED_LIMIT)
    const nextOffset = offset + items.length
    const hasMore = nextOffset < matched.length
    return {
      items,
      nextCursor: hasMore ? encodeCursor({ sortBy, offset: nextOffset }) : null,
      hasMore,
    }
  },
}
