/**
 * 景点接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端 `web/attraction/dto/*.java` 的一个 record，
 * 字段名与组件名完全相同，两侧一律 camelCase；interface 名也必须与 record 名相同，
 * 因为 `harness/checks/10-contract-check.ps1` 先比对「接口身份」，再逐字段比对
 * 「名字 + 类型」。后端多一个 record、这里少一个 interface，闸门直接非 0 退出。
 *
 * 类型约定（由闸门按 Java↔TS 映射表强制，不靠人盯）：
 * 1. 时间字段是 ISO-8601 字符串（后端 `Instant` 由 Jackson 序列化而来），不是毫秒数值；
 * 2. 库里可为 NULL、且「缺失」与「空串」语义不同的字段写 `| null`：`rating`（未知评分
 *    不是零分）、`coverUrl`、详情十项文案（没核实到的信息不得伪造）。闸门归一化时
 *    剥掉 `| null` 后与右侧基础类型相等，因此这不算类型不一致，只是把可空性说清楚；
 * 3. `items` 是 `XxxListItemResponse[]`，对应后端 `List<XxxListItemResponse>`；
 * 4. `nameEn` / `nameCn` / `city` / `publishedAt` 不加 `| null`：前三个是 NOT NULL 列，
 *    `publishedAt` 是列表排序键——能出现在响应里的景点恒有发布时刻；`verifiedAt` 同理，
 *    仓储层已把「已核实」写成查询条件，它在这里恒有值；
 * 5. 新增字段必须先改后端 record，再来这里镜像，顺序反过来闸门就会先红一次——这是设计意图。
 *
 * 景点域只有读端点（列表/榜单 + 详情），没有写端点，因此本文件没有请求体类型。
 */

/** 景点列表与榜单的排序维度，取后端 `AttractionSortBy.dbValue()` 的取值。 */
export type AttractionSortBy = 'hot' | 'rating' | 'new'

/** 约束型榜单键，取后端 `AttractionCollection.dbValue()` 的取值。 */
export type AttractionCollection = 'first-trip' | 'no-booking' | 'open-monday'

/** GET /api/attractions 列表中的单项，也是榜单成员。 */
export interface AttractionListItemResponse {
  publicId: string
  nameEn: string
  nameCn: string
  city: string
  coverUrl: string | null
  rating: number | null
  viewCount: number
  publishedAt: string
  freeEntry: boolean
  bookingRequired: boolean
  openOnMonday: boolean
}

/**
 * GET /api/attractions 的响应体。
 *
 * `total` 不是 `items.length`：完整列表时它是不受 `limit` 约束的已发布总数，
 * 榜单时它是该榜的策展成员总数。`total > items.length` 只说明「还有被截掉的条目」，
 * 不说明后面还有多少条。
 */
export interface AttractionListResponse {
  items: AttractionListItemResponse[]
  total: number
}

/** GET /api/attractions/{publicId} 的响应体：列表项 11 个字段 + 详情专属 11 个，扁平不嵌套。 */
export interface AttractionDetailResponse {
  publicId: string
  nameEn: string
  nameCn: string
  city: string
  coverUrl: string | null
  rating: number | null
  viewCount: number
  publishedAt: string
  freeEntry: boolean
  bookingRequired: boolean
  openOnMonday: boolean
  summaryEn: string | null
  contentEn: string | null
  ticketInfoEn: string | null
  openingHoursEn: string | null
  bookingInfoEn: string | null
  paymentInfoEn: string | null
  addressEn: string | null
  addressCn: string | null
  transitEn: string | null
  suggestedDurationEn: string | null
  verifiedAt: string
}

/** 景点端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const ATTRACTION_ENDPOINTS = {
  list: '/api/attractions',
  detail: (publicId: string) => `/api/attractions/${publicId}`,
} as const
