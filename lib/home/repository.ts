import { ATTRACTIONS, EDITOR_PICKS, POSTS } from './mock-data'
import type { Attraction, EditorPick, ListQuery, ListResult, Post } from './types'

export const EDITOR_PICKS_LIMIT = 6
export const HOT_POSTS_LIMIT = 10
export const HOT_ATTRACTIONS_LIMIT = 5

/** 数据源契约：真实 API 接入时只需要另一个实现，组件与测试不动。 */
export interface HomeRepository {
  listEditorPicks(query: ListQuery): Promise<ListResult<EditorPick>>
  listHotPosts(query: ListQuery): Promise<ListResult<Post>>
  listHotAttractions(query: ListQuery): Promise<ListResult<Attraction>>
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

/** total 是截断前的匹配总数，items 是本次返回的窗口。 */
function paginate<T>(matched: T[], limit: number): ListResult<T> {
  return { items: matched.slice(0, limit), total: matched.length }
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
}
