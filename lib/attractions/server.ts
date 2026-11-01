import { backendBaseUrl } from '@/lib/backend-url'
import { ATTRACTION_ENDPOINTS, type AttractionListResponse } from '@/lib/contracts/attractions'

import { toAttractionSummary, type AttractionSummary } from './types'

/** 后端把 limit 钳制在 50：搜索要尽量覆盖全部已发布景点，因此取满上限。 */
const SEARCH_LIMIT = 50

/**
 * 搜索页的景点取数。
 *
 * 服务端渲染时没有页面 origin，`/api/...` 这样的相对路径无法解析（浏览器里才行），
 * 因此这里直连后端地址，而不是复用同源代理。
 *
 * 失败一律返回空数组：搜索页据此让景点分组降级缺席。
 * 一个内容源不可达不该让整页变成错误页，编辑推荐与帖子仍能正常搜。
 */
export async function listAttractionsForSearch(): Promise<AttractionSummary[]> {
  const query = new URLSearchParams({ sortBy: 'hot', limit: String(SEARCH_LIMIT) })

  try {
    const response = await fetch(`${backendBaseUrl()}${ATTRACTION_ENDPOINTS.list}?${query}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      return []
    }
    const page = (await response.json()) as AttractionListResponse
    return page.items.map(toAttractionSummary)
  } catch {
    return []
  }
}
