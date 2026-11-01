import type { AttractionSummary } from '@/lib/attractions/types'
import { cityName, cityNameEn, isCitySlug } from '@/lib/home/cities'
import { formatCount } from '@/lib/home/format'
import { EDITOR_PICKS, POSTS } from '@/lib/home/mock-data'
import type { EditorPick, Post } from '@/lib/home/types'

/**
 * 站内检索：编辑推荐与帖子仍扫描 Mock 原始数组——首页仓储按 HOT_POSTS_LIMIT 截断，
 * 搜索必须能看到被截断的条目；景点改由调用方传入后端列表。
 *
 * 景点不在本模块里取数，本模块因此保持纯同步：服务端 await 一次接口的职责在页面，
 * 单测可以直接拿数据驱动，不需要网络也不依赖渲染环境。
 */

export type SearchKind = 'editor-pick' | 'post' | 'attraction'

export interface SearchHit {
  /** 跨分组唯一，直接用作列表 key。 */
  readonly key: string
  readonly title: string
  readonly city: string
  /** 所属城市英文名；city 为 all 时显示 All cities */
  readonly cityLabel: string
  /** 该类型的补充信息：编辑署名 / 作者与评论数 / 评分与浏览量 */
  readonly meta: string
  /** 只有有详情页的条目才带链接：景点指向 `/attractions/{publicId}`，其余暂无详情页。 */
  readonly href?: string
}

export interface SearchGroup {
  readonly kind: SearchKind
  readonly heading: string
  readonly count: number
  readonly items: readonly SearchHit[]
  /** 回首页对应区块的锚点 */
  readonly anchorHref: string
  readonly anchorLabel: string
}

export interface SearchOutcome {
  /** 去除首尾空白后的关键词，直接用于回显 */
  readonly query: string
  readonly total: number
  /** 只包含有命中的分组，顺序固定为 编辑推荐 → 帖子 → 景点 */
  readonly groups: readonly SearchGroup[]
}

const GROUP_META: readonly Pick<SearchGroup, 'kind' | 'heading' | 'anchorHref' | 'anchorLabel'>[] = [
  {
    kind: 'editor-pick',
    heading: "Editor's picks",
    anchorHref: '/#editor-picks',
    anchorLabel: 'See editor picks on the homepage',
  },
  {
    kind: 'post',
    heading: 'Posts',
    anchorHref: '/#hot-posts',
    anchorLabel: 'See trending posts on the homepage',
  },
  {
    kind: 'attraction',
    heading: 'Attractions',
    anchorHref: '/#hot-attractions',
    anchorLabel: 'See popular attractions on the homepage',
  },
]

/**
 * 城市名要参与匹配：city 字段存的是 slug，用户输入「成都」或「Chengdu」时
 * 分别只有中文名或英文名能对上。slug 本身不参与——英文名与 slug 同形时命中经由英文名成立。
 * all 不参与：全部城市的文案放进匹配串会让「搜全部」命中一条全城通用内容。
 * 白名单外的取值（后端 CHECK 之外）按不含城市名处理，不猜它是哪座城。
 */
function matchableCity(city: string): string {
  return isCitySlug(city) && city !== 'all' ? `${cityName(city)} ${cityNameEn(city)}` : ''
}

/** 白名单外的 slug 原样显示：宁可露出取值，也不冒充「全部城市」。 */
function hitCityLabel(city: string): string {
  return isCitySlug(city) ? cityNameEn(city) : city
}

function matches(fields: readonly string[], keyword: string): boolean {
  return fields.some((field) => field.toLowerCase().includes(keyword))
}

function toEditorHit(pick: EditorPick): SearchHit {
  return {
    key: `editor-pick-${pick.id}`,
    title: pick.titleEn,
    city: pick.city,
    cityLabel: hitCityLabel(pick.city),
    meta: pick.editorEn,
  }
}

function toPostHit(post: Post): SearchHit {
  return {
    key: `post-${post.id}`,
    title: post.titleEn,
    city: post.city,
    cityLabel: hitCityLabel(post.city),
    meta: `${post.authorEn} · ${post.commentCount} comments`,
  }
}

function toAttractionHit(item: AttractionSummary): SearchHit {
  const rating = item.rating === null ? 'Not rated yet' : `Rating ${item.rating.toFixed(1)}`
  return {
    key: `attraction-${item.publicId}`,
    title: item.nameEn,
    city: item.city,
    cityLabel: hitCityLabel(item.city),
    meta: `${rating} · ${formatCount(item.viewCount)} views`,
    href: `/attractions/${item.publicId}`,
  }
}

function group(kind: SearchKind, items: SearchHit[]): SearchGroup {
  const meta = GROUP_META.find((entry) => entry.kind === kind)
  if (!meta) {
    throw new Error(`Unknown search group: ${kind}`)
  }
  return { ...meta, count: items.length, items }
}

/** 关键词归一化为小写并去首尾空白；空关键词不产生任何结果。 */
export function searchContent(
  rawQuery: string,
  attractions: readonly AttractionSummary[],
): SearchOutcome {
  const query = rawQuery.trim().toLowerCase()
  if (query === '') {
    return { query: '', total: 0, groups: [] }
  }

  const editorHits = EDITOR_PICKS.filter((pick) =>
    matches(
      [
        pick.title,
        pick.titleEn,
        pick.summary,
        pick.summaryEn,
        pick.editor,
        pick.editorEn,
        matchableCity(pick.city),
      ],
      query,
    ),
  ).map(toEditorHit)

  const postHits = POSTS.filter(
    (post) =>
      post.status === 'published' &&
      matches(
        [post.title, post.titleEn, post.author, post.authorEn, matchableCity(post.city)],
        query,
      ),
  ).map(toPostHit)

  const attractionHits = attractions
    .filter((item) => matches([item.nameCn, item.nameEn, matchableCity(item.city)], query))
    .map(toAttractionHit)

  const groups: SearchGroup[] = []
  if (editorHits.length > 0) {
    groups.push(group('editor-pick', editorHits))
  }
  if (postHits.length > 0) {
    groups.push(group('post', postHits))
  }
  if (attractionHits.length > 0) {
    groups.push(group('attraction', attractionHits))
  }

  return {
    query: rawQuery.trim(),
    total: editorHits.length + postHits.length + attractionHits.length,
    groups,
  }
}
