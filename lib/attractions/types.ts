import type { AttractionDetailResponse, AttractionListItemResponse } from '@/lib/contracts/attractions'

/**
 * 景点视图模型：列表项与详情两档，字段与契约同名，不做重命名、不补派生字段。
 *
 * `rating` 保持 `number | null`：后端 `DECIMAL(2,1) NULL` 表达「未知评分」，
 * 归一成 0 会把「没评分」说成「零分」，因此界面需要自己决定缺失时怎么显示。
 * `coverUrl` 则归一成空串（与 `lib/posts/types.ts` 同一处理），调用方据此跳过图片渲染。
 */

export interface AttractionSummary {
  publicId: string
  nameEn: string
  nameCn: string
  city: string
  coverUrl: string
  rating: number | null
  viewCount: number
  publishedAt: string
  freeEntry: boolean
  bookingRequired: boolean
  openOnMonday: boolean
}

export interface AttractionDetail extends AttractionSummary {
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

/** `total` 的口径见契约注释：完整列表是不受 limit 约束的已发布总数，榜单是策展成员数。 */
export interface AttractionPage {
  items: AttractionSummary[]
  total: number
}

/** 显式逐字段搬运，不展开 dto、不夹带详情字段。 */
export function toAttractionSummary(dto: AttractionListItemResponse): AttractionSummary {
  return {
    publicId: dto.publicId,
    nameEn: dto.nameEn,
    nameCn: dto.nameCn,
    city: dto.city,
    coverUrl: dto.coverUrl ?? '',
    rating: dto.rating ?? null,
    viewCount: dto.viewCount,
    publishedAt: dto.publishedAt,
    freeEntry: dto.freeEntry,
    bookingRequired: dto.bookingRequired,
    openOnMonday: dto.openOnMonday,
  }
}

export function toAttractionDetail(dto: AttractionDetailResponse): AttractionDetail {
  return {
    ...toAttractionSummary(dto),
    summaryEn: dto.summaryEn,
    contentEn: dto.contentEn,
    ticketInfoEn: dto.ticketInfoEn,
    openingHoursEn: dto.openingHoursEn,
    bookingInfoEn: dto.bookingInfoEn,
    paymentInfoEn: dto.paymentInfoEn,
    addressEn: dto.addressEn,
    addressCn: dto.addressCn,
    transitEn: dto.transitEn,
    suggestedDurationEn: dto.suggestedDurationEn,
    verifiedAt: dto.verifiedAt,
  }
}
