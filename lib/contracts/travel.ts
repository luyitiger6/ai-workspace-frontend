/**
 * 旅行工具接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端 `web/travel/dto/*.java` 的一个 record，
 * 字段名与组件名完全相同，两侧一律 camelCase；interface 名也必须与 record 名相同，
 * 因为 `harness/checks/10-contract-check.ps1` 先比对「接口身份」，再逐字段比对
 * 「名字 + 类型」。后端多一个 record、这里少一个 interface，闸门直接非 0 退出。
 *
 * 类型约定（由闸门按 Java↔TS 映射表强制，不靠人盯）：
 * 1. 时间字段是 ISO-8601 字符串（后端 `Instant` 由 Jackson 序列化而来），不是毫秒数值；
 * 2. 本域没有可空字段：两个上游都要求「缺字段即整体失败」，因此能出现在响应里的
 *    数值与文案恒有值——这正是 spec 里「不得出现空值」那条约束在类型上的体现；
 * 3. `rates` 是 `CurrencyRateResponse[]`，对应后端 `List<CurrencyRateResponse>`，
 *    顺序即展示顺序，前端不得重排；
 * 4. 新增字段必须先改后端 record，再来这里镜像，顺序反过来闸门就会先红一次——这是设计意图。
 *
 * 两个端点都是公开只读，因此本文件没有请求体类型。
 */

/**
 * GET /api/travel/weather 的响应体。
 *
 * `condition` 已经是英文文案而不是天气码：码表属于数据源的语言，翻译留在服务端。
 * `observedAt` 是数据源声明的观测时刻，不是服务端取到响应的时刻——界面上的新鲜度
 * 说明要如实反映这一点。
 */
export interface WeatherResponse {
  city: string
  cityName: string
  temperatureC: number
  condition: string
  windSpeedKph: number
  observedAt: string
}

/** 汇率表里的一行：币种代码与「1 CNY 兑该币种」的数值。 */
export interface CurrencyRateResponse {
  code: string
  value: number
}

/**
 * GET /api/travel/currency 的响应体。
 *
 * `base` 恒为 `CNY`，仍显式返回：界面把它写在「1 CNY =」这一行上，
 * 硬编码在页面里会让「基准币变了」变成一处静默错位的文案。
 * `updatedAt` 是数据源声明的最后更新时刻，数据源每天只更新一次。
 */
export interface CurrencyResponse {
  base: string
  updatedAt: string
  rates: CurrencyRateResponse[]
}

/** 旅行工具端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const TRAVEL_ENDPOINTS = {
  weather: '/api/travel/weather',
  currency: '/api/travel/currency',
} as const
