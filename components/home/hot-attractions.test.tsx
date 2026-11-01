import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attractionsApi } from '@/lib/attractions/attractions-api'
import type { AttractionPage, AttractionSummary } from '@/lib/attractions/types'
import { HotAttractions } from './hot-attractions'

const COVER = 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d'

function attraction(
  overrides: Partial<AttractionSummary> & Pick<AttractionSummary, 'publicId' | 'nameEn'>,
): AttractionSummary {
  return {
    nameCn: '占位中文名',
    city: 'beijing',
    coverUrl: COVER,
    rating: 4.8,
    viewCount: 1000,
    publishedAt: '2026-09-01T00:00:00+08:00',
    freeEntry: false,
    bookingRequired: true,
    openOnMonday: true,
    ...overrides,
  }
}

/** 顺序就是后端 hot 排序的返回顺序：区块只渲染，不重排。 */
const HOT: AttractionSummary[] = [
  attraction({
    publicId: '01JQATTR000000000000000005',
    nameEn: 'The Palace Museum',
    city: 'beijing',
    rating: 4.8,
    viewCount: 32000,
  }),
  attraction({
    publicId: '01JQATTR000000000000000003',
    nameEn: 'The Bund',
    city: 'shanghai',
    rating: 4.7,
    viewCount: 28400,
  }),
  attraction({
    publicId: '01JQATTR000000000000000011',
    nameEn: 'West Lake',
    city: 'hangzhou',
    rating: 4.9,
    viewCount: 26100,
  }),
  attraction({
    publicId: '01JQATTR000000000000000007',
    nameEn: 'Chengdu Panda Base',
    city: 'chengdu',
    rating: 4.8,
    viewCount: 21500,
  }),
  attraction({
    publicId: '01JQATTR000000000000000009',
    nameEn: 'Yalong Bay',
    city: 'sanya',
    rating: 4.6,
    viewCount: 19800,
  }),
]

function pageOf(items: AttractionSummary[]): AttractionPage {
  return { items, total: items.length }
}

/** 默认每次取数都拿到给定的一页；个别用例再用 mockReturnValueOnce 覆盖。 */
function respondWith(items: AttractionSummary[]) {
  return vi.spyOn(attractionsApi, 'listHotAttractions').mockResolvedValue(pageOf(items))
}

describe('热门景点区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('最多展示 5 个景点并保持后端返回顺序', async () => {
    respondWith(HOT)

    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('The Palace Museum')
    expect(items[1]).toHaveTextContent('The Bund')
    expect(items[4]).toHaveTextContent('Yalong Bay')
  })

  it('每张卡片整卡链接到详情页', async () => {
    respondWith(HOT)

    render(<HotAttractions city="all" />)

    const links = await screen.findAllByRole('link')

    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      HOT.map((item) => `/attractions/${item.publicId}`),
    )
  })

  it('封面图按响应式档位出图并延迟加载', async () => {
    respondWith(HOT)

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

  it('景区没有封面时渲染占位而不是空图', async () => {
    respondWith([attraction({ publicId: '01JQATTR0000000000000000N1', nameEn: 'No Cover Ridge', coverUrl: '' })])

    render(<HotAttractions city="all" />)

    expect(
      await screen.findByRole('img', { name: 'No Cover Ridge has no cover image' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: / cover$/ })).not.toBeInTheDocument()
  })

  it('取数期间展示 role="status" 加载提示，完成后消失', async () => {
    let resolveData: (value: AttractionPage) => void = () => undefined
    const pending = new Promise<AttractionPage>((resolve) => {
      resolveData = resolve
    })
    vi.spyOn(attractionsApi, 'listHotAttractions').mockReturnValueOnce(pending)

    render(<HotAttractions city="all" />)

    expect(screen.getByRole('status')).toHaveTextContent('Gathering attraction data…')

    await act(async () => {
      resolveData(pageOf([]))
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('没有景点时展示空态', async () => {
    respondWith([])

    render(<HotAttractions city="sanya" />)

    expect(await screen.findByText(/Browse attractions in Sanya/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(attractionsApi, 'listHotAttractions').mockRejectedValueOnce(new Error('upstream down'))

    render(<HotAttractions city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Popular attractions could not load')
  })

  it('评分缺失时显示 Not rated yet 而不是零分', async () => {
    respondWith([attraction({ publicId: '01JQATTR0000000000000000N2', nameEn: 'Unrated Hill', rating: null })])

    render(<HotAttractions city="all" />)

    expect(await screen.findByText(/Unrated Hill/)).toBeInTheDocument()
    expect(screen.getByText('Beijing · Not rated yet')).toBeInTheDocument()
  })

  it('元信息按城市 · 评分拼接', async () => {
    respondWith(HOT)

    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelectorAll('p')[0]).toHaveTextContent('Beijing · Rating 4.8')
  })

  it('浏览数按千分位格式化', async () => {
    respondWith(HOT)

    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items[0].querySelectorAll('p')[1]).toHaveTextContent('32,000 views')
  })

  it('city 变化触发重新取数', async () => {
    const spy = respondWith(HOT)

    const { rerender } = render(<HotAttractions city="all" />)

    await screen.findAllByRole('listitem')
    expect(spy).toHaveBeenLastCalledWith({ city: 'all' })

    rerender(<HotAttractions city="beijing" />)

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ city: 'beijing' }))
  })

  it('先发的慢请求后返回时不覆盖新城市结果', async () => {
    let resolveSlow: (value: AttractionPage) => void = () => undefined
    const slow = new Promise<AttractionPage>((resolve) => {
      resolveSlow = resolve
    })
    const spy = respondWith([HOT[0]])
    spy.mockReturnValueOnce(slow)

    const { rerender } = render(<HotAttractions city="all" />)
    rerender(<HotAttractions city="beijing" />)

    expect(await screen.findByText('The Palace Museum')).toBeInTheDocument()

    await act(async () => {
      resolveSlow(
        pageOf([attraction({ publicId: '01JQATTR0000000000000000N3', nameEn: 'A stale attraction from the previous city' })]),
      )
    })

    expect(
      screen.queryByText('A stale attraction from the previous city'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('The Palace Museum')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
