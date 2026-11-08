import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AuthorCardEntry } from '@/lib/profile/types'
import type { PostSummary } from '@/lib/posts/types'
import { PostCard } from './post-card'

function makePost(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    publicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    title: 'A sample post',
    tags: ['Walking', 'Old town'],
    authorPublicId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    status: 'published',
    coverImage: 'https://example.com/cover.jpg',
    commentCount: 12,
    upVoteCount: 56,
    bookmarkCount: 8,
    createdAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

function readyCard(displayName = 'Ada'): AuthorCardEntry {
  return {
    status: 'ready',
    card: { publicId: '01ARZ3NDEKTSV4RRFFQ69G5FAW', displayName, avatarUrl: '' },
  }
}

describe('PostCard', () => {
  it('渲染真实标题、接口顺序标签、作者昵称、创建时间和统计', () => {
    render(<PostCard post={makePost()} authorCard={readyCard()} />)

    expect(screen.getByRole('heading', { name: 'A sample post' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Post tags' })).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['Walking', 'Old town'])
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Created', { exact: false })).toHaveTextContent('Created Oct 11')
    expect(document.querySelector('time')).toHaveAttribute('datetime', makePost().createdAt)
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('作者区三态：请求中占位、已返回昵称、缺失文案', () => {
    const { container, rerender } = render(<PostCard post={makePost()} />)
    expect(container.querySelector('details')).toBeNull()
    expect(screen.queryByText(/Author/)).not.toBeInTheDocument()

    rerender(<PostCard post={makePost()} authorCard={readyCard('Miles')} />)
    expect(screen.getByText('Miles')).toBeInTheDocument()

    rerender(<PostCard post={makePost()} authorCard={{ status: 'missing', card: null }} />)
    expect(screen.getByText('Author unavailable')).toBeInTheDocument()
  })

  it('任何状态下都不渲染 26 位对外标识', () => {
    const { rerender } = render(<PostCard post={makePost()} />)
    expect(screen.queryByText(/Author ID/)).not.toBeInTheDocument()
    expect(screen.queryByText(makePost().authorPublicId)).not.toBeInTheDocument()

    rerender(<PostCard post={makePost()} authorCard={readyCard()} />)
    expect(screen.queryByText(/Author ID/)).not.toBeInTheDocument()
    expect(screen.queryByText(makePost().authorPublicId)).not.toBeInTheDocument()

    rerender(<PostCard post={makePost()} authorCard={{ status: 'missing', card: null }} />)
    expect(screen.queryByText(/Author ID/)).not.toBeInTheDocument()
    expect(screen.queryByText(makePost().authorPublicId)).not.toBeInTheDocument()
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

  it('标题链接只使用 publicId，排序仅保留合法 UI 词', () => {
    const { rerender } = render(<PostCard post={makePost()} sortBy="mostDiscussed" />)
    expect(screen.getByRole('link', { name: 'A sample post' })).toHaveAttribute('href', `/posts/${makePost().publicId}?sortBy=mostDiscussed`)
    rerender(<PostCard post={makePost()} />)
    expect(screen.getByRole('link', { name: 'A sample post' })).toHaveAttribute('href', `/posts/${makePost().publicId}`)
  })

  it('昵称指向用户页，href 只拼公开标识', () => {
    render(<PostCard post={makePost()} authorCard={readyCard('Ada')} />)

    expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', `/users/${readyCard().card!.publicId}`)
  })

  it('请求中与名片缺失都不生成用户页链接', () => {
    const { rerender } = render(<PostCard post={makePost()} />)
    // 骨架是 aria-hidden 的，无障碍树里只剩标题一个链接。
    expect(screen.queryAllByRole('link')).toHaveLength(1)

    rerender(<PostCard post={makePost()} authorCard={{ status: 'missing', card: null }} />)
    expect(screen.queryByRole('link', { name: 'Author unavailable' })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(1)
  })

  it('没有摘要、姓名、城市、浏览数或假发布时间', () => {
    const polluted = { ...makePost(), id: 99, titleEn: 'Mock title', summaryEn: 'Fake summary',
      authorEn: 'Fake author', city: 'chengdu', viewCount: 12345, publishedAt: '2000-01-01' }
    render(<PostCard post={polluted} />)
    for (const text of ['Mock title', 'Fake summary', 'Fake author', 'chengdu', '12,345', '2000', 'Published']) {
      expect(screen.queryByText(text, { exact: false })).not.toBeInTheDocument()
    }
  })

  it('封面为空或加载失败后无破图，链接保持可用', () => {
    const { container, rerender } = render(<PostCard post={makePost()} />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('No cover image')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'A sample post' })).toBeInTheDocument()
    rerender(<PostCard post={makePost({ coverImage: '' })} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('接口更新封面后可以加载新图，不遗留旧失败状态', () => {
    const { container, rerender } = render(<PostCard post={makePost()} />)
    fireEvent.error(container.querySelector('img')!)
    rerender(<PostCard post={makePost({ coverImage: 'https://example.com/new.jpg' })} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/new.jpg')
  })
})
