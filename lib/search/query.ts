import { cityName, cityNameEn } from '@/lib/home/cities'
import { formatCount } from '@/lib/home/format'
import { ATTRACTIONS, EDITOR_PICKS, POSTS } from '@/lib/home/mock-data'
import type { Attraction, CitySlug, EditorPick, Post } from '@/lib/home/types'

/**
 * 站内检索：直接扫描 Mock 原始数组，不复用首页仓储。
 * 首页仓储按 HOT_POSTS_LIMIT / HOT_ATTRACTIONS_LIMIT 截断，搜索必须能看到被截断的条目。
 */

export type SearchKind = 'editor-pick' | 'post' | 'attraction'

export interface SearchHit {
  readonly id: number
  readonly title: string
  readonly city: CitySlug
  /** 所属城市英文名；city 为 all 时显示 All cities */
  readonly cityLabel: string
  /** 该类型的补充信息：编辑署名 / 作者与评论数 / 评分与浏览量 */
  readonly meta: string
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
 */
function matchableCity(city: CitySlug): string {
  return city === 'all' ? '' : `${cityName(city)} ${cityNameEn(city)}`
}

function hitCityLabel(city: CitySlug): string {
  return city === 'all' ? 'All cities' : cityNameEn(city)
}

function matches(fields: readonly string[], keyword: string): boolean {
  return fields.some((field) => field.toLowerCase().includes(keyword))
}

function toEditorHit(pick: EditorPick): SearchHit {
  return {
    id: pick.id,
    title: pick.titleEn,
    city: pick.city,
    cityLabel: hitCityLabel(pick.city),
    meta: pick.editorEn,
  }
}

function toPostHit(post: Post): SearchHit {
  return {
    id: post.id,
    title: post.titleEn,
    city: post.city,
    cityLabel: hitCityLabel(post.city),
    meta: `${post.authorEn} · ${post.commentCount} comments`,
  }
}

function toAttractionHit(item: Attraction): SearchHit {
  return {
    id: item.id,
    title: item.nameEn,
    city: item.city,
    cityLabel: hitCityLabel(item.city),
    meta: `Rating ${item.rating.toFixed(1)} · ${formatCount(item.viewCount)} views`,
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
export function searchContent(rawQuery: string): SearchOutcome {
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

  const attractionHits = ATTRACTIONS.filter(
    (item) =>
      item.status === 'published' && matches([item.name, item.nameEn, matchableCity(item.city)], query),
  ).map(toAttractionHit)

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
