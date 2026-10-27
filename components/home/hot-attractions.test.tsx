import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '@/lib/home/repository'
import type { Attraction, ListResult } from '@/lib/home/types'
import { HotAttractions } from './hot-attractions'

describe('热门景点区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('最多展示 5 个景点并按浏览量排序', async () => {
    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('The Palace Museum')
    expect(items[1]).toHaveTextContent('The Bund')
    expect(items[4]).toHaveTextContent('Yalong Bay')
  })

  it('封面图按响应式档位出图并延迟加载', async () => {
    render(<HotAttractions city="all" />)

    const covers = await screen.findAllByRole('img', { name: / cover$/ })

    expect(covers).toHaveLength(5)

    for (const cover of covers) {
      const srcset = cover.getAttribute('srcset') ?? ''

      // jsdom 里 next/image 不加载 next.config.ts 的 images 配置，走的是默认 loader，
      // 因此这里只验证属性产出；档位改写规则由 lib/image-loader.test.ts 覆盖，
      // 自定义 loader 的实际接入由浏览器实测确认。
      expect(srcset).toContain('images.unsplash.com')
      expect(srcset.split(',').length).toBeGreaterThan(1)
      expect(cover.getAttribute('sizes')).toBe(
        '(max-width: 480px) calc(100vw - 64px), (max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)',
      )
      expect(cover).toHaveAttribute('loading', 'lazy')
      expect(cover).toHaveAttribute('decoding', 'async')
    }
  })

  it('取数期间展示 role="status" 加载提示，完成后消失', async () => {
    let resolveData: (value: ListResult<Attraction>) => void = () => undefined
    const pending = new Promise<ListResult<Attraction>>((resolve) => {
      resolveData = resolve
    })
    vi.spyOn(mockRepository, 'listHotAttractions').mockReturnValueOnce(pending)

    render(<HotAttractions city="all" />)

    expect(screen.getByRole('status')).toHaveTextContent('Gathering attraction data…')

    await act(async () => {
      resolveData({ items: [], total: 0 })
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('不展示草稿与已删除景点', async () => {
    render(<HotAttractions city="all" />)

    await screen.findAllByRole('listitem')

    expect(screen.queryByText('A viewing deck not yet open')).not.toBeInTheDocument()
    expect(screen.queryByText('A retired old attraction')).not.toBeInTheDocument()
  })

  it('没有景点时展示空态', async () => {
    vi.spyOn(mockRepository, 'listHotAttractions').mockResolvedValueOnce({ items: [], total: 0 })

    render(<HotAttractions city="sanya" />)

    expect(await screen.findByText(/Browse attractions in Sanya/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(mockRepository, 'listHotAttractions').mockRejectedValueOnce(
      new Error('mock failure'),
    )

    render(<HotAttractions city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Popular attractions could not load')
  })

  it('只展示所选城市的景点', async () => {
    render(<HotAttractions city="beijing" />)

    const items = await screen.findAllByRole('listitem')

    expect(items.length).toBeGreaterThan(0)
    expect(screen.getByText('The Palace Museum')).toBeInTheDocument()
    expect(screen.queryByText('The Bund')).not.toBeInTheDocument()
  })

  it('先发的慢请求后返回时不覆盖新城市结果', async () => {
    let resolveSlow: (value: ListResult<Attraction>) => void = () => undefined
    const slow = new Promise<ListResult<Attraction>>((resolve) => {
      resolveSlow = resolve
    })
    const spy = vi.spyOn(mockRepository, 'listHotAttractions')
    spy.mockReturnValueOnce(slow)

    const { rerender } = render(<HotAttractions city="all" />)
    rerender(<HotAttractions city="beijing" />)

    expect(await screen.findByText('The Palace Museum')).toBeInTheDocument()

    const stale: Attraction = {
      id: 901,
      name: '旧城市残留景点',
      nameEn: 'A stale attraction from the previous city',
      city: 'shanghai',
      coverUrl: 'https://images.unsplash.com/placeholder',
      rating: 4.9,
      viewCount: 1,
      status: 'published',
      publishedAt: '2026-10-01T00:00:00+08:00',
    }

    await act(async () => {
      resolveSlow({ items: [stale], total: 1 })
    })

    expect(
      screen.queryByText('A stale attraction from the previous city'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('The Palace Museum')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('元信息按城市 · 评分拼接', async () => {
    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelectorAll('p')[0]).toHaveTextContent('Beijing · Rating 4.8')
  })

  it('浏览数按千分位格式化', async () => {
    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelectorAll('p')[1]).toHaveTextContent('32,000 views')
  })

  it('city 变化触发重新取数', async () => {
    const spy = vi.spyOn(mockRepository, 'listHotAttractions')

    const { rerender } = render(<HotAttractions city="all" />)

    await screen.findAllByRole('listitem')
    expect(spy).toHaveBeenLastCalledWith({ city: 'all' })

    rerender(<HotAttractions city="beijing" />)

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ city: 'beijing' }))
  })
})
