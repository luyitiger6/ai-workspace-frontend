import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Post } from '@/lib/home/types'
import { PostCard } from './post-card'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    title: '示例标题',
    titleEn: 'A sample post',
    summaryEn: 'This is a short summary of the sample post.',
    author: '作者',
    authorEn: 'Author Name',
    city: 'chengdu',
    status: 'published',
    coverUrl: 'https://example.com/cover.jpg',
    commentCount: 12,
    viewCount: 3400,
    upVoteCount: 56,
    bookmarkCount: 8,
    publishedAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

describe('PostCard', () => {
  it('渲染标题、摘要、作者、发布日期与互动统计', () => {
    render(<PostCard post={makePost()} />)

    expect(screen.getByRole('heading', { name: 'A sample post' })).toBeInTheDocument()
    expect(screen.getByText('This is a short summary of the sample post.')).toBeInTheDocument()
    expect(screen.getByText(/Author Name/)).toBeInTheDocument()
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('零互动时仍展示图标与 0', () => {
    render(
      <PostCard
        post={makePost({ upVoteCount: 0, commentCount: 0, bookmarkCount: 0 })}
      />,
    )

    expect(screen.getAllByText('0')).toHaveLength(3)
  })

  it('封面图带 alt 为空字符串且懒加载', () => {
    const { container } = render(<PostCard post={makePost()} />)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('loading', 'lazy')
  })
})
