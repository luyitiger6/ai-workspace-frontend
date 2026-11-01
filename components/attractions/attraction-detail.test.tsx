import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AttractionsApiError, attractionsApi } from '@/lib/attractions/attractions-api'
import type { AttractionDetail as Detail } from '@/lib/attractions/types'
import { AttractionDetail } from './attraction-detail'

const PUBLIC_ID = '01JQATTR000000000000000011'

function detail(overrides: Partial<Detail> = {}): Detail {
  return {
    publicId: PUBLIC_ID,
    nameEn: 'West Lake',
    nameCn: '西湖',
    city: 'hangzhou',
    coverUrl: 'https://images.unsplash.com/photo-1599571234909-29ed5d1321d6',
    rating: 4.9,
    viewCount: 16700,
    publishedAt: '2026-09-01T00:00:00+08:00',
    freeEntry: true,
    bookingRequired: false,
    openOnMonday: true,
    summaryEn: 'A lake that has shaped Hangzhou for a thousand years.',
    contentEn: null,
    ticketInfoEn: 'Free of charge',
    openingHoursEn: 'Daily 08:00-17:00',
    bookingInfoEn: 'No reservation required',
    paymentInfoEn: 'Cash and mobile payment',
    addressEn: '1 Hubin Road, Hangzhou',
    addressCn: '杭州市上城区湖滨路1号',
    transitEn: 'Metro Line 1, Longxiangqiao station',
    suggestedDurationEn: 'Half a day',
    verifiedAt: '2026-09-12T00:00:00+08:00',
    ...overrides,
  }
}

describe('景点详情页', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('首帧显示加载态，返回列表的链接始终在', () => {
    vi.spyOn(attractionsApi, 'detail').mockReturnValue(new Promise(() => {}))

    render(<AttractionDetail publicId={PUBLIC_ID} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading this attraction')
    expect(screen.getByRole('link', { name: '← Back to all attractions' })).toHaveAttribute(
      'href',
      '/attractions',
    )
  })

  it('加载成功后渲染标题、城市与评分、核实月份和事实卡', async () => {
    vi.spyOn(attractionsApi, 'detail').mockResolvedValue(detail())

    render(<AttractionDetail publicId={PUBLIC_ID} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'West Lake' })).toBeInTheDocument()

    // 城市按白名单翻成英文名，评分保留一位小数，浏览量带千分位。
    // 定位串用评分而不是城市：地址项里也含 Hangzhou。
    const meta = screen.getByText(/Rating 4\.9/)
    expect(meta).toHaveTextContent('Rating 4.9')
    expect(meta).toHaveTextContent('16,700 views')

    // 核实时间只到月，并带机器可读的完整日期。
    expect(screen.getByText(/Checked/)).toHaveTextContent('Checked Sep 2026')
    const checked = screen.getByText('Sep 2026')
    expect(checked.tagName).toBe('TIME')
    expect(checked).toHaveAttribute('dateTime', '2026-09-12')

    const facts = screen.getByRole('region', { name: 'What to know before you go' })
    expect(within(facts).getAllByText('Free of charge')).toHaveLength(1)
    expect(within(facts).getAllByText(/taxi driver/)).toHaveLength(1)

    // 摘要存在就渲染；正文为空时不出现「The guide」区块。
    expect(screen.getByText(/shaped Hangzhou/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'The guide' })).not.toBeInTheDocument()
  })

  it('有正文时才渲染 guide 区块', async () => {
    vi.spyOn(attractionsApi, 'detail').mockResolvedValue(
      detail({ contentEn: 'Walk the Su Causeway at dawn before the crowds arrive.' }),
    )

    render(<AttractionDetail publicId={PUBLIC_ID} />)

    const guide = await screen.findByRole('region', { name: 'The guide' })
    expect(within(guide).getByText(/Su Causeway at dawn/)).toBeInTheDocument()
  })

  it('未评分与无封面都退化为可读文案，不显示 0 分或空图', async () => {
    vi.spyOn(attractionsApi, 'detail').mockResolvedValue(detail({ rating: null, coverUrl: '' }))

    render(<AttractionDetail publicId={PUBLIC_ID} />)

    await screen.findByRole('heading', { level: 1, name: 'West Lake' })

    expect(screen.getByText(/Not rated yet/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'West Lake has no cover image' })).toBeInTheDocument()
  })

  it('404 渲染空态而不是错误态，也不提供重试', async () => {
    vi.spyOn(attractionsApi, 'detail').mockRejectedValue(
      new AttractionsApiError(404, 'ATTRACTION_NOT_FOUND', 'not found'),
    )

    render(<AttractionDetail publicId={PUBLIC_ID} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Attraction not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse all attractions' })).toHaveAttribute(
      'href',
      '/attractions',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('请求失败渲染错误态，重试后能拿到正文', async () => {
    const spy = vi
      .spyOn(attractionsApi, 'detail')
      .mockRejectedValueOnce(new AttractionsApiError(500, 'INTERNAL_ERROR', 'boom'))
      .mockResolvedValueOnce(detail())

    render(<AttractionDetail publicId={PUBLIC_ID} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'This attraction could not load' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Request failed with status 500')

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading this attraction' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'West Lake' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith(PUBLIC_ID, expect.any(AbortSignal))
  })
})
