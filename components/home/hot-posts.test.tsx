import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '@/lib/home/repository'
import type { Post } from '@/lib/home/types'
import { HotPosts } from './hot-posts'

describe('热门帖子区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('最多展示 10 条帖子并按热度排序', async () => {
    render(<HotPosts city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(10)
    expect(items[0]).toHaveTextContent('Chengdu rain, falling into a cup of tea')
    expect(items[1]).toHaveTextContent('The Bund: wind from dusk into the night')
  })

  it('不展示草稿与已删除帖子', async () => {
    render(<HotPosts city="all" />)

    await screen.findAllByRole('listitem')

    expect(screen.queryByText('The last half hour before the Forbidden City closes')).not.toBeInTheDocument()
    expect(screen.queryByText('A removed old post')).not.toBeInTheDocument()
  })

  it('没有帖子时展示空态', async () => {
    vi.spyOn(mockRepository, 'listHotPosts').mockResolvedValueOnce({ items: [], total: 0 })

    render(<HotPosts city="beijing" />)

    expect(await screen.findByText(/Be the first to ask in Beijing/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(mockRepository, 'listHotPosts').mockRejectedValueOnce(new Error('mock failure'))

    render(<HotPosts city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Trending posts could not load')
  })

  it('排名按两位补零', async () => {
    render(<HotPosts city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelector('span')).toHaveTextContent('01')
    expect(items[9].querySelector('span')).toHaveTextContent('10')
  })

  it('元信息按作者 · 城市 · 发布日拼接', async () => {
    render(<HotPosts city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelector('div p')).toHaveTextContent('Xiaozhou · Chengdu · Oct 11')
  })

  it('浏览数按千分位格式化', async () => {
    render(<HotPosts city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelectorAll('p')[1]).toHaveTextContent('42 comments · 9,100 views')
  })

  it('计数为 0 时渲染 0 而不是 NaN', async () => {
    const zeroViews: Post = {
      id: 999,
      title: '零评论零浏览的帖子',
      titleEn: 'A post with zero comments and zero views',
      author: '零',
      authorEn: 'Zero',
      city: 'chengdu',
      status: 'published',
      commentCount: 0,
      viewCount: 0,
      publishedAt: '2026-10-01T10:00:00+08:00',
    }
    vi.spyOn(mockRepository, 'listHotPosts').mockResolvedValueOnce({ items: [zeroViews], total: 1 })

    render(<HotPosts city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelectorAll('p')[1]).toHaveTextContent('0 comments · 0 views')
    expect(items[0].textContent).not.toContain('NaN')
  })
})
