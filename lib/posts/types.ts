import type { PostResponse, PostStatus, PostSummaryResponse } from '@/lib/contracts/posts'

/** URL 和 UI 词表，独立于后端排序词表与首页 Mock 类型。 */
export type PostSortBy = 'latest' | 'hottest' | 'mostDiscussed'

export interface PostSummary {
  publicId: string
  title: string
  coverImage: string
  tags: string[]
  status: PostStatus
  authorPublicId: string
  createdAt: string
  commentCount: number
  upVoteCount: number
  bookmarkCount: number
}

export interface PostDetail extends PostSummary {
  content: string
  updatedAt: string
}

export interface PostPage {
  items: PostSummary[]
  nextCursor: string | null
  hasMore: boolean
}

/** 显式选择真实字段，不补假摘要、显示名或发布时间。 */
export function toPostSummary(dto: PostSummaryResponse): PostSummary {
  return {
    publicId: dto.publicId,
    title: dto.title,
    coverImage: dto.coverImage ?? '',
    tags: dto.tags,
    status: dto.status,
    authorPublicId: dto.authorPublicId,
    createdAt: dto.createdAt,
    commentCount: dto.commentCount,
    upVoteCount: dto.upVoteCount,
    bookmarkCount: dto.bookmarkCount,
  }
}

export function toPostDetail(dto: PostResponse): PostDetail {
  return { ...toPostSummary(dto), content: dto.content, updatedAt: dto.updatedAt }
}
