import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import { travelApi } from '@/lib/travel/travel-api'
import { SiteHeader } from './site-header'

const fetchMock = vi.fn()

const weatherBody = {
  city: 'beijing',
  cityName: 'Beijing',
  temperatureC: 9.0,
  condition: 'Clear',
  windSpeedKph: 5.0,
  observedAt: '2026-11-11T17:15:00Z',
}

const currencyBody = {
  base: 'CNY',
  updatedAt: '2026-11-11T00:02:01Z',
  rates: [{ code: 'JPY', value: 23.7139 }],
}

beforeEach(() => {
  window.localStorage.clear()
  // 顶栏的账号区依赖会话：未登录既是最简单的初始态，也让 MessageBadge 不发请求
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'x' }), { status: 401 }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

function renderHeader() {
  return render(
    <AuthProvider>
      <AiAssistantProvider>
        <SiteHeader />
      </AiAssistantProvider>
    </AuthProvider>,
  )
}

describe('头部旅行工具入口', () => {
  it('两个图标入口都在工具栏里，各自有可读名称', () => {
    renderHeader()

    expect(screen.getByRole('button', { name: 'Weather' })).toHaveAttribute(
      'data-testid',
      'weather-trigger',
    )
    expect(screen.getByRole('button', { name: 'Exchange rates' })).toHaveAttribute(
      'data-testid',
      'currency-trigger',
    )
    // 图标入口不带可读文字，名称必须来自 aria-label，否则窄屏收起后就成了无名按钮
    expect(screen.getByTestId('weather-trigger')).not.toHaveTextContent('Weather')
    expect(screen.getByTestId('currency-trigger')).not.toHaveTextContent('Exchange rates')
  })

  it('点击天气图标展开天气浮层，不展开汇率浮层', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'weather').mockResolvedValue(weatherBody)
    renderHeader()

    await user.click(screen.getByTestId('weather-trigger'))

    expect(screen.getByTestId('weather-panel')).toBeVisible()
    expect(screen.getByTestId('currency-panel')).not.toBeVisible()
    expect(await screen.findByTestId('weather-reading')).toHaveTextContent('Beijing')
  })

  it('点击汇率图标展开汇率浮层', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'currency').mockResolvedValue(currencyBody)
    renderHeader()

    await user.click(screen.getByTestId('currency-trigger'))

    expect(screen.getByTestId('currency-panel')).toBeVisible()
    expect(screen.getByTestId('weather-panel')).not.toBeVisible()
    expect(await screen.findByTestId('currency-rates')).toHaveTextContent('23.71')
  })
})
