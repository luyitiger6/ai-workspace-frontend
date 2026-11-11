import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TravelApiError, TravelNetworkError, describeTravelError, travelApi } from './travel-api'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

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
  rates: [
    { code: 'JPY', value: 23.713927 },
    { code: 'USD', value: 0.149528 },
    { code: 'EUR', value: 0.1281 },
    { code: 'THB', value: 5.009935 },
    { code: 'HKD', value: 1.1631 },
  ],
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('旅行工具端点层', () => {
  it('天气请求带上城市 slug，响应六字段原样保留', async () => {
    fetchMock.mockResolvedValue(json(weatherBody))

    const reading = await travelApi.weather('beijing')

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/travel/weather?city=beijing')
    expect(init.credentials).toBe('same-origin')
    expect(init.cache).toBe('no-store')
    expect(init.headers).toMatchObject({ accept: 'application/json' })
    expect(reading).toEqual(weatherBody)
  })

  it('城市 slug 作为参数值整体编码，不会拆出额外的查询参数', async () => {
    fetchMock.mockResolvedValue(json(weatherBody))

    await travelApi.weather('beijing&admin=1')

    // 分隔符必须被编码，否则服务端会把后半截当成新参数，查询换了目标
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/travel/weather?city=beijing%26admin%3D1')
  })

  it('汇率响应原样返回，五个币种的顺序不被重排', async () => {
    fetchMock.mockResolvedValue(json(currencyBody))

    const table = await travelApi.currency()

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/travel/currency')
    expect(table.rates.map((rate) => rate.code)).toEqual(['JPY', 'USD', 'EUR', 'THB', 'HKD'])
  })

  it('非 2xx 带业务码时抛 TravelApiError 并保留状态码与错误码', async () => {
    fetchMock.mockResolvedValue(json({ code: 'TRAVEL_CITY_INVALID', message: '城市不在支持范围内' }, 400))

    await expect(travelApi.weather('paris')).rejects.toMatchObject({
      name: 'TravelApiError',
      status: 400,
      code: 'TRAVEL_CITY_INVALID',
    })
  })

  it('上游失败保留 502 与业务码', async () => {
    fetchMock.mockResolvedValue(json({ code: 'TRAVEL_WEATHER_UNAVAILABLE', message: '天气数据源暂时不可用' }, 502))

    await expect(travelApi.weather('beijing')).rejects.toMatchObject({
      status: 502,
      code: 'TRAVEL_WEATHER_UNAVAILABLE',
    })
  })

  it('网络失败归一为 TravelNetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(travelApi.currency()).rejects.toBeInstanceOf(TravelNetworkError)
  })

  it('取消不被吞掉，原样抛给调用方', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    fetchMock.mockRejectedValue(abort)

    await expect(travelApi.currency()).rejects.toBe(abort)
  })

  it('响应体不可解析时抛 INVALID_RESPONSE，不把半个对象交给界面', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))

    await expect(travelApi.currency()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})

describe('旅行工具错误文案', () => {
  it('按错误码映射成人话', () => {
    expect(describeTravelError(new TravelApiError(502, 'TRAVEL_WEATHER_UNAVAILABLE', 'x')))
      .toBe('Weather data is unavailable right now.')
    expect(describeTravelError(new TravelApiError(502, 'TRAVEL_CURRENCY_UNAVAILABLE', 'x')))
      .toBe('Exchange rates are unavailable right now.')
    expect(describeTravelError(new TravelApiError(400, 'TRAVEL_CITY_INVALID', 'x')))
      .toBe('That city is not supported.')
  })

  it('未知错误码与未知异常都给出可展示的兜底文案', () => {
    expect(describeTravelError(new TravelApiError(500, 'SOMETHING_NEW', 'x')))
      .toContain('500')
    expect(describeTravelError(new Error('boom')))
      .toBe('Something went wrong. Please try again.')
    expect(describeTravelError(new TravelNetworkError()))
      .toContain('Cannot reach the server')
  })
})
