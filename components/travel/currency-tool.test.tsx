import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TravelApiError, travelApi } from '@/lib/travel/travel-api'
import { CurrencyTool } from './currency-tool'

const table = {
  base: 'CNY',
  updatedAt: '2026-11-11T00:02:01Z',
  rates: [
    { code: 'JPY', value: 23.7139 },
    { code: 'USD', value: 0.149528 },
    { code: 'EUR', value: 0.1281 },
    { code: 'THB', value: 5.009935 },
    { code: 'HKD', value: 1.1631 },
  ],
}

const unavailable = new TravelApiError(502, 'TRAVEL_CURRENCY_UNAVAILABLE', 'x')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('汇率浮层', () => {
  it('固定五项按服务端顺序展示，并按数量级取两位或四位', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'currency').mockResolvedValue(table)
    render(<CurrencyTool />)

    await user.click(screen.getByTestId('currency-trigger'))

    const rates = await screen.findByTestId('currency-rates')
    const rows = within(rates).getAllByRole('term')
    expect(rows.map((row) => row.textContent)).toEqual([
      'JPYJapanese yen',
      'USDUS dollar',
      'EUREuro',
      'THBThai baht',
      'HKDHong Kong dollar',
    ])

    expect(rates).toHaveTextContent('23.71')
    expect(rates).toHaveTextContent('0.1495')
    expect(rates).toHaveTextContent('0.1281')
    expect(rates).toHaveTextContent('5.01')
    expect(rates).toHaveTextContent('1.16')
    expect(within(rates).getAllByRole('definition')).toHaveLength(5)
  })

  it('展示数据源更新日期，且不出现实时性表述', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'currency').mockResolvedValue(table)
    render(<CurrencyTool />)

    await user.click(screen.getByTestId('currency-trigger'))
    await screen.findByTestId('currency-rates')

    const panel = screen.getByTestId('currency-panel')
    expect(panel).toHaveTextContent('Updated 2026-11-11')
    expect(panel).not.toHaveTextContent(/live|real-time|realtime/i)
  })

  it('署名链接指向数据源，新标签打开且切断 opener', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'currency').mockResolvedValue(table)
    render(<CurrencyTool />)

    await user.click(screen.getByTestId('currency-trigger'))
    await screen.findByTestId('currency-rates')

    const link = screen.getByRole('link', { name: 'ExchangeRate-API' })
    expect(link).toHaveAttribute('href', 'https://www.exchangerate-api.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('失败时只给提示与重试，不展示任何汇率数值', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'currency').mockRejectedValue(unavailable)
    render(<CurrencyTool />)

    await user.click(screen.getByTestId('currency-trigger'))

    const error = await screen.findByTestId('currency-error')
    expect(error).toHaveTextContent('Exchange rates are unavailable right now.')
    expect(screen.queryByTestId('currency-rates')).not.toBeInTheDocument()
    expect(screen.getByTestId('currency-panel')).not.toHaveTextContent('23.71')
  })

  it('重试成功后恢复结果展示', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'currency').mockRejectedValueOnce(unavailable).mockResolvedValue(table)
    render(<CurrencyTool />)

    await user.click(screen.getByTestId('currency-trigger'))
    await screen.findByTestId('currency-error')

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByTestId('currency-rates')).toHaveTextContent('23.71')
    expect(screen.queryByTestId('currency-error')).not.toBeInTheDocument()
  })
})
