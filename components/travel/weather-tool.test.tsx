import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TravelApiError, travelApi } from '@/lib/travel/travel-api'
import { WeatherTool } from './weather-tool'

const STORAGE_KEY = 'wanderchain.travel.weather.city'

const beijing = {
  city: 'beijing',
  cityName: 'Beijing',
  temperatureC: 9.0,
  condition: 'Clear',
  windSpeedKph: 5.0,
  observedAt: '2026-11-11T17:15:00Z',
}

const chengdu = {
  city: 'chengdu',
  cityName: 'Chengdu',
  temperatureC: 16.4,
  condition: 'Partly cloudy',
  windSpeedKph: 7.2,
  observedAt: '2026-11-11T17:20:00Z',
}

const unavailable = new TravelApiError(502, 'TRAVEL_WEATHER_UNAVAILABLE', 'x')

function openTrigger() {
  return screen.getByTestId('weather-trigger')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('天气浮层', () => {
  it('首次打开默认北京，四项与观测时间齐全', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'weather').mockResolvedValue(beijing)
    render(<WeatherTool />)

    await user.click(openTrigger())

    const reading = await screen.findByTestId('weather-reading')
    expect(reading).toBeVisible()
    expect(screen.getByLabelText('City')).toHaveValue('beijing')
    expect(reading).toHaveTextContent('Beijing')
    expect(reading).toHaveTextContent('9°C')
    expect(reading).toHaveTextContent('Clear')
    expect(reading).toHaveTextContent('5 km/h')
    expect(reading).toHaveTextContent('17:15 UTC')
    expect(travelApi.weather).toHaveBeenCalledWith('beijing', expect.anything())
  })

  it('城市下拉只有七个平台城市，没有自由输入', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'weather').mockResolvedValue(beijing)
    render(<WeatherTool />)

    await user.click(openTrigger())

    const select = screen.getByLabelText('City')
    expect(select.tagName).toBe('SELECT')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Beijing',
      'Shanghai',
      'Guangzhou',
      'Chengdu',
      "Xi'an",
      'Hangzhou',
      'Sanya',
    ])
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('切换城市后关闭再打开，沿用上次选择', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'weather').mockImplementation(async (city) =>
      city === 'chengdu' ? chengdu : beijing,
    )
    render(<WeatherTool />)

    await user.click(openTrigger())
    await screen.findByTestId('weather-reading')

    await user.selectOptions(screen.getByLabelText('City'), 'chengdu')
    await waitFor(() =>
      expect(screen.getByTestId('weather-reading')).toHaveTextContent('Chengdu'),
    )

    await user.click(screen.getByRole('button', { name: 'Close the weather tool' }))
    expect(screen.getByTestId('weather-panel')).not.toBeVisible()

    await user.click(openTrigger())

    expect(screen.getByLabelText('City')).toHaveValue('chengdu')
    expect(await screen.findByTestId('weather-reading')).toHaveTextContent('Chengdu')
  })

  it('重新挂载时从本地存储恢复城市', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(STORAGE_KEY, 'hangzhou')
    vi.spyOn(travelApi, 'weather').mockResolvedValue({
      ...beijing,
      city: 'hangzhou',
      cityName: 'Hangzhou',
    })
    render(<WeatherTool />)

    await user.click(openTrigger())

    expect(screen.getByLabelText('City')).toHaveValue('hangzhou')
    await waitFor(() =>
      expect(travelApi.weather).toHaveBeenCalledWith('hangzhou', expect.anything()),
    )
  })

  it('存储里是平台外城市时回落北京，不抛错', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(STORAGE_KEY, 'paris')
    vi.spyOn(travelApi, 'weather').mockResolvedValue(beijing)
    render(<WeatherTool />)

    await user.click(openTrigger())

    expect(screen.getByLabelText('City')).toHaveValue('beijing')
    expect(await screen.findByTestId('weather-reading')).toHaveTextContent('Beijing')
  })

  it('切换城市失败时不残留上一个城市的数据', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'weather').mockImplementation(async (city) => {
      if (city === 'chengdu') throw unavailable
      return beijing
    })
    render(<WeatherTool />)

    await user.click(openTrigger())
    expect(await screen.findByTestId('weather-reading')).toHaveTextContent('9°C')

    await user.selectOptions(screen.getByLabelText('City'), 'chengdu')

    const error = await screen.findByTestId('weather-error')
    expect(error).toHaveTextContent('Weather data is unavailable right now.')
    expect(screen.queryByTestId('weather-reading')).not.toBeInTheDocument()
    expect(screen.getByTestId('weather-panel')).not.toHaveTextContent('9°C')
  })

  it('失败后重试成功即恢复结果展示', async () => {
    const user = userEvent.setup()
    vi.spyOn(travelApi, 'weather').mockRejectedValueOnce(unavailable).mockResolvedValue(beijing)
    render(<WeatherTool />)

    await user.click(openTrigger())
    await screen.findByTestId('weather-error')

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByTestId('weather-reading')).toHaveTextContent('Beijing')
    expect(screen.queryByTestId('weather-error')).not.toBeInTheDocument()
  })
})
