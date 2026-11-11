import {
  TRAVEL_ENDPOINTS,
  type CurrencyResponse,
  type WeatherResponse,
} from '@/lib/contracts/travel'

/**
 * 旅行工具的两个取数口（spec「汇率读取失败的表现」「天气读取失败的表现」）。
 *
 * 错误被归成两类而不是一个：网络没通与上游没给数据，界面给的提示不同
 * （前者建议检查连接，后者只是这次没拿到），但两者都会落到同一个失败态与重试入口。
 *
 * 不缓存、不重试：缓存由服务端负责（额度护栏在那里），前端重试由用户手动触发——
 * 自动重试会把一次上游抖动变成一串无人知晓的请求。
 */
export class TravelApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'TravelApiError'
  }
}

export class TravelNetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.')
    this.name = 'TravelNetworkError'
  }
}

/** 旅行工具业务文案不复用景点与帖子业务的提示。 */
export function describeTravelError(cause: unknown): string {
  if (cause instanceof TravelNetworkError) return cause.message
  if (!(cause instanceof TravelApiError)) return 'Something went wrong. Please try again.'
  const messages: Record<string, string> = {
    TRAVEL_CITY_INVALID: 'That city is not supported.',
    TRAVEL_WEATHER_UNAVAILABLE: 'Weather data is unavailable right now.',
    TRAVEL_CURRENCY_UNAVAILABLE: 'Exchange rates are unavailable right now.',
  }
  return messages[cause.code] ?? `Request failed with status ${cause.status}. Please try again.`
}

/** 取消异常可来自浏览器或不同执行环境，不依赖 Error 构造器身份。 */
function isAbortError(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError'
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (cause) {
    // 取消仍是取消，由上下文代次决定忽略；网络失败不自动重试。
    if (isAbortError(cause)) throw cause
    throw new TravelNetworkError()
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
    throw new TravelApiError(response.status, code, message)
  }
  try {
    return await response.json() as T
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new TravelApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
}

export const travelApi = {
  weather(city: string, signal?: AbortSignal): Promise<WeatherResponse> {
    return request<WeatherResponse>(
      `${TRAVEL_ENDPOINTS.weather}?city=${encodeURIComponent(city)}`,
      signal,
    )
  },
  currency(signal?: AbortSignal): Promise<CurrencyResponse> {
    return request<CurrencyResponse>(TRAVEL_ENDPOINTS.currency, signal)
  },
}
