import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AttractionsApiError,
  AttractionsNetworkError,
  attractionsApi,
  describeAttractionsError,
  isAttractionNotFound,
} from './attractions-api'

const fetchMock = vi.fn()
const ID = '01JQATTR000000000000000001'
const item = {
  publicId: ID, nameEn: 'Forbidden City', nameCn: '故宫', city: 'beijing',
  coverUrl: 'https://img.example/fg.jpg', rating: 4.8, viewCount: 12800,
  publishedAt: '2026-08-01T00:00:00Z', freeEntry: false, bookingRequired: true, openOnMonday: false,
}
const detail = {
  ...item, summaryEn: 'The imperial palace.', contentEn: null, ticketInfoEn: 'CNY 60',
  openingHoursEn: null, bookingInfoEn: null, paymentInfoEn: null, addressEn: null,
  addressCn: '北京市东城区景山前街4号', transitEn: null, suggestedDurationEn: '3 hours',
  verifiedAt: '2026-08-02T00:00:00Z',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

function lastRequest() {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  expect(path).toMatch(/^\/api\/attractions/)
  expect(init.credentials).toBe('same-origin')
  expect(init.cache).toBe('no-store')
  expect(init.headers).toMatchObject({ accept: 'application/json' })
  return { path, init }
}

describe('真实景点端点层', () => {
  it('默认列表不带任何查询参数，列表项只保留 11 个字段且 total 不取 items.length', async () => {
    fetchMock.mockResolvedValue(json({ items: [item], total: 12 }))
    const page = await attractionsApi.listAttractions()

    expect(lastRequest().path).toBe('/api/attractions')
    expect(page.total).toBe(12)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toEqual({
      publicId: ID, nameEn: 'Forbidden City', nameCn: '故宫', city: 'beijing',
      coverUrl: item.coverUrl, rating: 4.8, viewCount: 12800,
      publishedAt: item.publishedAt, freeEntry: false, bookingRequired: true, openOnMonday: false,
    })
    for (const detailOnly of [
      'summaryEn', 'contentEn', 'ticketInfoEn', 'openingHoursEn', 'bookingInfoEn',
      'paymentInfoEn', 'addressEn', 'addressCn', 'transitEn', 'suggestedDurationEn', 'verifiedAt',
    ]) {
      expect(page.items[0]).not.toHaveProperty(detailOnly)
    }
  })

  it('城市、排序、榜单与条数逐项落到查询串，all 与空城市都不带 city', async () => {
    // 同一次用例内多次调用，每次都必须给新的 Response：body 只能读一次。
    fetchMock.mockImplementation(async () => json({ items: [], total: 0 }))
    await attractionsApi.listAttractions({ city: 'chengdu', sortBy: 'rating', collection: 'no-booking', limit: 3 })
    let query = new URL(lastRequest().path, 'http://localhost').searchParams
    expect(query.get('city')).toBe('chengdu')
    expect(query.get('sortBy')).toBe('rating')
    expect(query.get('collection')).toBe('no-booking')
    expect(query.get('limit')).toBe('3')

    for (const city of ['all', null, undefined] as const) {
      await attractionsApi.listAttractions({ city })
      query = new URL(lastRequest().path, 'http://localhost').searchParams
      expect(query.has('city')).toBe(false)
      expect(query.has('sortBy')).toBe(false)
      expect(query.has('collection')).toBe(false)
      expect(query.has('limit')).toBe(false)
    }
  })

  it('首页热门口固定 hot 排序、5 条上限并透传城市与 signal', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue(json({ items: [item], total: 7 }))
    const page = await attractionsApi.listHotAttractions({ city: 'beijing' }, undefined, signal)

    const { path, init } = lastRequest()
    const query = new URL(path, 'http://localhost').searchParams
    expect(query.get('city')).toBe('beijing')
    expect(query.get('sortBy')).toBe('hot')
    expect(query.get('limit')).toBe('5')
    expect(init.signal).toBe(signal)
    expect(page.total).toBe(7)
  })

  it('详情保留可空文案为 null 而不补空串，signal 原样传递', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue(json(detail))
    const attraction = await attractionsApi.detail(ID, signal)

    expect(lastRequest()).toMatchObject({ path: `/api/attractions/${ID}`, init: { signal } })
    expect(Object.keys(attraction)).toHaveLength(22)
    expect(attraction.verifiedAt).toBe(detail.verifiedAt)
    expect(attraction.addressCn).toBe('北京市东城区景山前街4号')
    expect(attraction.suggestedDurationEn).toBe('3 hours')
    for (const missing of ['contentEn', 'openingHoursEn', 'bookingInfoEn', 'paymentInfoEn', 'addressEn', 'transitEn']) {
      expect(attraction).toHaveProperty(missing, null)
    }
  })

  it('详情 404 可区分于榜单参数错误，且都不冒充成功、不自动重放', async () => {
    fetchMock.mockResolvedValue(json({ code: 'ATTRACTION_NOT_FOUND', message: '景点不存在' }, 404))
    const notFound = await attractionsApi.detail(ID).catch((cause: unknown) => cause)
    expect(notFound).toBeInstanceOf(AttractionsApiError)
    expect(isAttractionNotFound(notFound)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(describeAttractionsError(notFound)).not.toContain('景点不存在')

    fetchMock.mockResolvedValue(json({ code: 'ATTRACTION_COLLECTION_INVALID', message: '榜单键不合法' }, 400))
    const invalid = await attractionsApi.listAttractions({ collection: 'open-monday' }).catch((cause: unknown) => cause)
    expect(invalid).toMatchObject({ status: 400, code: 'ATTRACTION_COLLECTION_INVALID' })
    expect(isAttractionNotFound(invalid)).toBe(false)
    expect(describeAttractionsError(invalid)).toBe('That collection does not exist.')
    expect(isAttractionNotFound(new AttractionsNetworkError())).toBe(false)
  })

  it('网络失败归一为网络错误且只请求一次', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    const cause = await attractionsApi.listAttractions().catch((error: unknown) => error)
    expect(cause).toBeInstanceOf(AttractionsNetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(describeAttractionsError(cause)).toContain('Cannot reach the server')
  })

  it('非 JSON 502、null 错误体与成功非 JSON 均可控', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
    await expect(attractionsApi.detail(ID)).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' })
    fetchMock.mockResolvedValueOnce(json(null, 503))
    await expect(attractionsApi.listAttractions()).rejects.toMatchObject({ status: 503, code: 'UNKNOWN' })
    fetchMock.mockResolvedValueOnce(new Response('not JSON', { status: 200 }))
    await expect(attractionsApi.detail(ID)).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' })
  })

  it.each([
    new DOMException('aborted', 'AbortError'),
    { name: 'AbortError', message: '跨环境取消' },
  ])('AbortError 保持取消语义 %s', async (aborted) => {
    fetchMock.mockRejectedValueOnce(aborted)
    await expect(attractionsApi.detail(ID)).rejects.toBe(aborted)
  })

  it.each([200, 404])('响应体读取中取消不转换成 JSON/HTTP 错误 %s', async (status) => {
    const aborted = new DOMException('body aborted', 'AbortError')
    const response = new Response(null, { status })
    vi.spyOn(response, 'json').mockRejectedValueOnce(aborted)
    fetchMock.mockResolvedValueOnce(response)
    await expect(attractionsApi.detail(ID)).rejects.toBe(aborted)
  })

  it.each([null, undefined, 'AbortError', { name: 'TypeError' }])('其它拒绝值仍是网络失败 %s', async (cause) => {
    fetchMock.mockRejectedValueOnce(cause)
    await expect(attractionsApi.listAttractions()).rejects.toBeInstanceOf(AttractionsNetworkError)
  })
})
