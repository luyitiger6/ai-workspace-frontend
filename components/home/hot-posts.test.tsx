import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '@/lib/home/repository'
import type { ListResult, Post } from '@/lib/home/types'
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

  it('取数期间展示 role="status" 加载提示，完成后消失', async () => {
    let resolveData: (value: ListResult<Post>) => void = () => undefined
    const pending = new Promise<ListResult<Post>>((resolve) => {
      resolveData = resolve
    })
    vi.spyOn(mockRepository, 'listHotPosts').mockReturnValueOnce(pending)

    render(<HotPosts city="all" />)

    expect(screen.getByRole('status')).toHaveTextContent("Measuring this week's buzz…")

    await act(async () => {
      resolveData({ items: [], total: 0 })
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('不展示草稿与已删除帖子', async () => {
    render(<HotPosts city="all" />)

    await screen.findAllByRole('listitem')

    expect(screen.queryByText('The last half hour before the Forbidden City closes')).not.toBeInTheDocument()
    expect(screen.queryByText('A removed old post')).not.toBeInTheDocument()
  })

  it('选中城市时只展示该城市帖子', async () => {
    render(<HotPosts city="chengdu" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(screen.getByText('Chengdu rain, falling into a cup of tea')).toBeInTheDocument()
    expect(
      screen.getByText('Two days around Chengdu: old towns and bamboo groves'),
    ).toBeInTheDocument()
    expect(screen.queryByText('The Bund: wind from dusk into the night')).not.toBeInTheDocument()
  })

  it('先发的慢请求后返回时不覆盖新城市结果', async () => {
    let resolveSlow: (value: ListResult<Post>) => void = () => undefined
    const slow = new Promise<ListResult<Post>>((resolve) => {
      resolveSlow = resolve
    })
    const spy = vi.spyOn(mockRepository, 'listHotPosts')
    spy.mockReturnValueOnce(slow)

    const { rerender } = render(<HotPosts city="all" />)
    rerender(<HotPosts city="chengdu" />)

    expect(
      await screen.findByText('Chengdu rain, falling into a cup of tea'),
    ).toBeInTheDocument()

    const stale: Post = {
      id: 901,
      title: '旧城市残留帖',
      titleEn: 'A stale post from the previous city',
      author: '旧',
      authorEn: 'Stale',
      city: 'shanghai',
      status: 'published',
      commentCount: 1,
      viewCount: 1,
      publishedAt: '2026-10-01T00:00:00+08:00',
    }

    await act(async () => {
      resolveSlow({ items: [stale], total: 1 })
    })

    expect(screen.queryByText('A stale post from the previous city')).not.toBeInTheDocument()
    expect(screen.getByText('Chengdu rain, falling into a cup of tea')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
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
