import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { attractionsApi, type AttractionListQuery } from '@/lib/attractions/attractions-api'
import type { AttractionPage, AttractionSummary } from '@/lib/attractions/types'
import type { AttractionCollection } from '@/lib/contracts/attractions'
import type { CitySlug } from '@/lib/home/types'
import { CollectionBlock } from './collection-block'
import { COLLECTIONS } from './collections'

const COVER = 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d'

function attraction(
  overrides: Partial<AttractionSummary> & Pick<AttractionSummary, 'publicId' | 'nameEn'>,
): AttractionSummary {
  return {
    nameCn: '占位中文名',
    city: 'beijing',
    coverUrl: COVER,
    rating: 4.7,
    viewCount: 1000,
    publishedAt: '2026-09-01T00:00:00+08:00',
    freeEntry: false,
    bookingRequired: false,
    openOnMonday: true,
    ...overrides,
  }
}

/** 三个榜单各给一条互不相同的条目，断言时能据此分辨「哪一榜渲染了谁」。 */
const PICKS: Record<AttractionCollection, AttractionSummary> = {
  'first-trip': attraction({ publicId: '01JQATTR000000000000000001', nameEn: 'Forbidden City' }),
  'no-booking': attraction({
    publicId: '01JQATTR000000000000000006',
    nameEn: 'Shamian Island',
    city: 'guangzhou',
    freeEntry: true,
  }),
  'open-monday': attraction({ publicId: '01JQATTR000000000000000011', nameEn: 'West Lake', city: 'hangzhou' }),
}

function pageOf(items: AttractionSummary[]): AttractionPage {
  return { items, total: items.length }
}

/** 每个榜单按自己的 `collection` 拿到对应那一页，模拟后端策展。 */
function respondPerCollection() {
  return vi
    .spyOn(attractionsApi, 'listAttractions')
    .mockImplementation(async (query: AttractionListQuery = {}) =>
      pageOf(query.collection ? [PICKS[query.collection]] : []),
    )
}

function shortlists(city: CitySlug) {
  return COLLECTIONS.map((collection) => (
    <CollectionBlock
      key={collection.key}
      collection={collection.key}
      title={collection.title}
      blurb={collection.blurb}
      city={city}
    />
  ))
}

describe('景点榜单区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('三个榜单按固定顺序渲染，各带自己的 collection 标记', async () => {
    respondPerCollection()

    render(<>{shortlists('all')}</>)

    const blocks = await screen.findAllByRole('region')
    expect(blocks.map((block) => block.getAttribute('data-collection'))).toEqual([
      'first-trip',
      'no-booking',
      'open-monday',
    ])
  })

  it('榜单名是固定英文串，不随城市变化', async () => {
    respondPerCollection()

    render(<>{shortlists('chengdu')}</>)

    expect(await screen.findByRole('heading', { name: 'First time in China' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No booking needed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Open on Mondays' })).toBeInTheDocument()
    // 榜单名里不出现城市，城市只出现在说明与空态里。
    for (const heading of screen.getAllByRole('heading', { level: 2 })) {
      expect(heading).not.toHaveTextContent('Chengdu')
    }
  })

  it('每个榜单按自己的 collection 取数并透传当前城市', async () => {
    const spy = respondPerCollection()

    render(<>{shortlists('chengdu')}</>)

    await screen.findAllByRole('listitem')

    expect(spy.mock.calls.map((call) => call[0])).toEqual([
      { city: 'chengdu', collection: 'first-trip' },
      { city: 'chengdu', collection: 'no-booking' },
      { city: 'chengdu', collection: 'open-monday' },
    ])
  })

  it('榜单成员按后端返回顺序渲染，卡片整卡链接到详情页', async () => {
    respondPerCollection()

    render(<>{shortlists('all')}</>)

    const firstPick = await screen.findByRole('link', { name: /Forbidden City/ })
    expect(firstPick).toHaveAttribute('href', '/attractions/01JQATTR000000000000000001')
    expect(screen.getByRole('link', { name: /Shamian Island/ })).toHaveAttribute(
      'href',
      '/attractions/01JQATTR000000000000000006',
    )
  })

  it('卡片的约束徽标只由后端布尔事实决定', async () => {
    respondPerCollection()

    render(<>{shortlists('all')}</>)

    const noBooking = (await screen.findByRole('heading', { name: 'No booking needed' })).closest(
      'section',
    ) as HTMLElement
    const card = within(noBooking).getByRole('link', { name: /Shamian Island/ })

    // 免预约榜里的成员也必须显示同一条事实，不能按榜单另造一套说法：
    // 三条徽标全由布尔事实推导，顺序固定，不会出现「Booking needed」这类矛盾说法。
    expect(within(card).getAllByRole('listitem').map((badge) => badge.textContent)).toEqual([
      'Free entry',
      'No booking needed',
      'Open on Mondays',
    ])
  })

  it('某一榜失败只影响自己，其它榜照常渲染', async () => {
    vi.spyOn(attractionsApi, 'listAttractions').mockImplementation(async (query: AttractionListQuery = {}) => {
      if (query.collection === 'no-booking') throw new Error('upstream down')
      return pageOf(query.collection ? [PICKS[query.collection]] : [])
    })

    render(<>{shortlists('all')}</>)

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent('No booking needed could not load')

    // 失败的榜不残留条目，另外两榜条目照常在。
    expect(screen.getByRole('link', { name: /Forbidden City/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /West Lake/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Shamian Island/ })).not.toBeInTheDocument()
  })

  it('榜单为空时显示含城市的空态', async () => {
    vi.spyOn(attractionsApi, 'listAttractions').mockResolvedValue(pageOf([]))

    render(<>{shortlists('sanya')}</>)

    expect(await screen.findAllByText('No picks on this shortlist in Sanya yet.')).toHaveLength(3)
  })

  it('城市切换后三个榜单都重新取数', async () => {
    const spy = respondPerCollection()

    const { rerender } = render(<>{shortlists('all')}</>)
    await screen.findAllByRole('listitem')
    expect(spy).toHaveBeenCalledTimes(3)

    rerender(<>{shortlists('xian')}</>)

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(6))
    expect(spy.mock.calls.slice(3).map((call) => call[0]?.city)).toEqual(['xian', 'xian', 'xian'])
  })
})
