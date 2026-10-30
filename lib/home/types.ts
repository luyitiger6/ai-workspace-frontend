/** 首页共享契约：未来真实 API 的响应形状必须与此一致，切换数据源时只替换仓储实现。 */

export type CitySlug =
  | 'all'
  | 'beijing'
  | 'shanghai'
  | 'guangzhou'
  | 'chengdu'
  | 'xian'
  | 'hangzhou'
  | 'sanya'

export type ContentStatus = 'published' | 'draft' | 'removed'

export type PostSortBy = 'latest' | 'hottest' | 'mostDiscussed'

export interface PostFeedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface EditorPick {
  id: number
  title: string
  titleEn: string
  summary: string
  summaryEn: string
  city: CitySlug
  coverUrl: string
  editor: string
  editorEn: string
  sortOrder: number
}

export interface Post {
  id: number
  title: string
  titleEn: string
  summaryEn: string
  author: string
  authorEn: string
  city: CitySlug
  status: ContentStatus
  coverUrl: string
  commentCount: number
  viewCount: number
  upVoteCount: number
  bookmarkCount: number
  publishedAt: string
}

export interface Attraction {
  id: number
  name: string
  nameEn: string
  city: CitySlug
  coverUrl: string
  rating: number
  viewCount: number
  status: ContentStatus
  publishedAt: string
}

export interface ListQuery {
  city: CitySlug
}

export interface ListResult<T> {
  items: T[]
  total: number
}
