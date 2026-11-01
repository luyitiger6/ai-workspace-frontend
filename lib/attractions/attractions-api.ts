import {
  ATTRACTION_ENDPOINTS,
  type AttractionCollection,
  type AttractionDetailResponse,
  type AttractionListResponse,
  type AttractionSortBy,
} from '@/lib/contracts/attractions'
import type { CitySlug } from '@/lib/home/types'
import {
  toAttractionDetail,
  toAttractionSummary,
  type AttractionDetail,
  type AttractionPage,
} from './types'

export class AttractionsApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'AttractionsApiError'
  }
}

export class AttractionsNetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.')
    this.name = 'AttractionsNetworkError'
  }
}

/** 景点业务文案不复用认证与帖子业务的提示。 */
export function describeAttractionsError(cause: unknown): string {
  if (cause instanceof AttractionsNetworkError) return cause.message
  if (!(cause instanceof AttractionsApiError)) return 'Something went wrong. Please try again.'
  const messages: Record<string, string> = {
    ATTRACTION_NOT_FOUND: 'This attraction is not available any more.',
    ATTRACTION_COLLECTION_INVALID: 'That collection does not exist.',
    VALIDATION_FAILED: 'The filter or the page size is not valid.',
  }
  return messages[cause.code] ?? `Request failed with status ${cause.status}. Please try again.`
}

/**
 * 详情 404 是可预期结果——景点下架、未经核实，或 publicId 拼错，
 * 调用方据此渲染空态，而不是把「不存在」显示成「服务出错」。
 */
export function isAttractionNotFound(cause: unknown): boolean {
  return cause instanceof AttractionsApiError
    && (cause.status === 404 || cause.code === 'ATTRACTION_NOT_FOUND')
}

/** 取消异常可来自浏览器或不同执行环境，不依赖 Error 构造器身份。 */
function isAbortError(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch (cause) {
    // 取消仍是取消，由上下文代次决定忽略；网络失败不自动重试。
    if (isAbortError(cause)) throw cause
    throw new AttractionsNetworkError()
  }
  if (!response.ok) {
    let code = 'UNKNOWN'
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json() as { code?: unknown; message?: unknown } | null
      if (typeof body?.code === 'string') code = body.code
      if (typeof body?.message === 'string') message = body.message
    } catch (cause) {
      if (isAbortError(cause)) throw cause
      // 非 JSON 上游失败保留真实状态码，不虚构业务错误码。
    }
    throw new AttractionsApiError(response.status, code, message)
  }
  try {
    return await response.json() as T
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new AttractionsApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
}

/** 列表与榜单共用的查询条件；各项缺省即交给后端默认（hot 排序、20 条、不限城市）。 */
export interface AttractionListQuery {
  city?: CitySlug | null
  sortBy?: AttractionSortBy
  collection?: AttractionCollection
  limit?: number
}

/** `all` 是页面语义而不是数据取值，空值与 `all` 都不带 `city` 参数。 */
function buildQuery(query: AttractionListQuery): string {
  const params = new URLSearchParams()
  if (query.city && query.city !== 'all') params.set('city', query.city)
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.collection) params.set('collection', query.collection)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  const search = params.toString()
  return search ? `?${search}` : ''
}

async function fetchList(query: AttractionListQuery, signal?: AbortSignal): Promise<AttractionPage> {
  const page = await request<AttractionListResponse>(`${ATTRACTION_ENDPOINTS.list}${buildQuery(query)}`, { signal })
  return { items: page.items.map(toAttractionSummary), total: page.total }
}

export const attractionsApi = {
  listAttractions(query: AttractionListQuery = {}, signal?: AbortSignal): Promise<AttractionPage> {
    return fetchList(query, signal)
  },
  /** 首页「热门景点」区块的取数口：hot 排序 + 城市过滤 + 5 条上限（与 Mock 仓储同口径）。 */
  listHotAttractions(query: { city: CitySlug }, limit = 5, signal?: AbortSignal): Promise<AttractionPage> {
    return fetchList({ city: query.city, sortBy: 'hot', limit }, signal)
  },
  async detail(publicId: string, signal?: AbortSignal): Promise<AttractionDetail> {
    return toAttractionDetail(await request<AttractionDetailResponse>(ATTRACTION_ENDPOINTS.detail(publicId), { signal }))
  },
}
