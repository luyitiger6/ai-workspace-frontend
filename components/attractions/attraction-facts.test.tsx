import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AttractionDetail } from '@/lib/attractions/types'
import { AttractionFacts } from './attraction-facts'

const MISSING = 'Not confirmed yet.'

/** 默认全缺：真实种子 12 条详情字段都齐，占位分支只能靠这里的夹具覆盖。 */
function detail(overrides: Partial<AttractionDetail> = {}): AttractionDetail {
  return {
    publicId: '01JQATTR000000000000000011',
    nameEn: 'West Lake',
    nameCn: '西湖',
    city: 'hangzhou',
    coverUrl: '',
    rating: 4.9,
    viewCount: 16700,
    publishedAt: '2026-09-01T00:00:00+08:00',
    freeEntry: true,
    bookingRequired: false,
    openOnMonday: true,
    summaryEn: null,
    contentEn: null,
    ticketInfoEn: null,
    openingHoursEn: null,
    bookingInfoEn: null,
    paymentInfoEn: null,
    addressEn: null,
    addressCn: null,
    transitEn: null,
    suggestedDurationEn: null,
    verifiedAt: '2026-09-12T00:00:00+08:00',
    ...overrides,
  }
}

function terms(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('dt')).map((node) => node.textContent)
}

function values(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('dd')).map((node) => node.textContent)
}

describe('景点事实卡', () => {
  it('八项事实按固定顺序渲染', () => {
    const { container } = render(<AttractionFacts detail={detail()} />)

    expect(terms(container)).toEqual([
      'Tickets',
      'Opening hours',
      'Booking',
      'Payment',
      'Address',
      'Address in Chinese',
      'Getting there',
      'Suggested visit',
    ])
  })

  it('字段全缺时逐项占位，不中断整卡', () => {
    const { container } = render(<AttractionFacts detail={detail()} />)

    expect(screen.getAllByText(MISSING)).toHaveLength(8)
    expect(values(container)).toHaveLength(8)
  })

  it('有值的项原样输出，不翻译也不加工', () => {
    const { container } = render(
      <AttractionFacts
        detail={detail({
          ticketInfoEn: 'Free of charge',
          openingHoursEn: 'Daily 08:00-17:00',
          bookingInfoEn: 'No reservation required',
          paymentInfoEn: 'Cash and mobile payment',
          addressEn: '1 Hubin Road, Hangzhou',
          addressCn: '杭州市上城区湖滨路1号',
          transitEn: 'Metro Line 1, Longxiangqiao station',
          suggestedDurationEn: 'Half a day',
        })}
      />,
    )

    expect(values(container)).toEqual([
      'Free of charge',
      'Daily 08:00-17:00',
      'No reservation required',
      'Cash and mobile payment',
      '1 Hubin Road, Hangzhou',
      // 中文地址是唯一允许出现中文字符的位置，后面紧跟用途注记。
      '杭州市上城区湖滨路1号Show this to a taxi driver.',
      'Metro Line 1, Longxiangqiao station',
      'Half a day',
    ])
  })

  it('中文地址的用途注记只随该项出现一次', () => {
    const { container } = render(<AttractionFacts detail={detail({ addressCn: '杭州市上城区湖滨路1号' })} />)

    const items = Array.from(container.querySelectorAll('div'))
    const withNote = items.filter((item) => item.textContent?.includes('Show this to a taxi driver.'))

    expect(withNote).toHaveLength(1)
    expect(withNote[0].textContent).toContain('Address in Chinese')
  })

  it('单项缺失只影响该项，其余保留', () => {
    const { container } = render(
      <AttractionFacts detail={detail({ ticketInfoEn: 'Free of charge', addressCn: '杭州市上城区湖滨路1号' })} />,
    )

    expect(screen.getAllByText(MISSING)).toHaveLength(6)
    expect(values(container)[0]).toBe('Free of charge')
    expect(values(container)[5]).toBe('杭州市上城区湖滨路1号Show this to a taxi driver.')
    expect(values(container)[1]).toBe(MISSING)
  })
})
