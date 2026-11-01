import { describe, expect, it } from 'vitest'
import type { AttractionSummary } from '@/lib/attractions/types'
import { searchContent } from './query'

/**
 * 数据依赖提醒：
 * - 编辑推荐与帖子仍来自 lib/home/mock-data.ts，以下关键词取自那份内容；
 * - 景点来自后端，这里用一组与种子数据同形的夹具代替——搜索模块不认识「数据从哪来」，
 *   只认调用方传进来的这一页景点（与真实接口返回的 `AttractionSummary` 同形）。
 */
const TRUNCATED_POSTS = [
  { keyword: '回民街', key: 'post-12' },
  { keyword: '后海村', key: 'post-13' },
]

const HAN = /\p{Script=Han}/u

function attraction(
  overrides: Partial<AttractionSummary> & Pick<AttractionSummary, 'publicId' | 'nameEn'>,
): AttractionSummary {
  return {
    nameCn: '占位中文名',
    city: 'beijing',
    coverUrl: '',
    rating: 4.8,
    viewCount: 1000,
    publishedAt: '2026-09-01T00:00:00+08:00',
    freeEntry: false,
    bookingRequired: true,
    openOnMonday: true,
    ...overrides,
  }
}

const ATTRACTIONS: readonly AttractionSummary[] = [
  attraction({
    publicId: '01JQATTR000000000000000006',
    nameEn: 'Kuanzhai Alley',
    nameCn: '宽窄巷子',
    city: 'chengdu',
    rating: 4.6,
    viewCount: 18600,
  }),
  attraction({
    publicId: '01JQATTR000000000000000007',
    nameEn: 'Shamian Island',
    nameCn: '沙面岛',
    city: 'guangzhou',
    rating: 4.4,
    viewCount: 9800,
  }),
  attraction({
    publicId: '01JQATTR000000000000000012',
    nameEn: 'Unrated Lookout',
    nameCn: '未评分的观景台',
    city: 'xian',
    rating: null,
    viewCount: 100,
  }),
]

function groupKeys(keyword: string, attractions: readonly AttractionSummary[] = ATTRACTIONS): string[][] {
  return searchContent(keyword, attractions).groups.map((group) => group.items.map((item) => item.key))
}

function kindOrder(keyword: string, attractions: readonly AttractionSummary[] = ATTRACTIONS): string[] {
  return searchContent(keyword, attractions).groups.map((group) => group.kind)
}

describe('站内检索', () => {
  it('空关键词不产生任何结果', () => {
    for (const raw of ['', '   ', '\n']) {
      const outcome = searchContent(raw, ATTRACTIONS)
      expect(outcome.total).toBe(0)
      expect(outcome.groups).toEqual([])
      expect(outcome.query).toBe('')
    }
  })

  it('能看到被首页上限截断的帖子', () => {
    // 已发布帖子 12 条，首页只取评论数前 10 条；这两条被截断在首页之外
    for (const { keyword, key } of TRUNCATED_POSTS) {
      const postGroup = searchContent(keyword, ATTRACTIONS).groups.find((group) => group.kind === 'post')
      expect(postGroup?.items.map((item) => item.key), `关键词「${keyword}」应当命中被首页截断的帖子`).toContain(key)
    }
  })

  it('景点分组只来自调用方传入的后端列表', () => {
    const attractionGroup = searchContent('沙面岛', ATTRACTIONS).groups.find(
      (group) => group.kind === 'attraction',
    )
    expect(attractionGroup?.items.map((item) => item.key)).toEqual([
      'attraction-01JQATTR000000000000000007',
    ])

    // 后端不可达时页面传入空数组：景点分组降级缺席，编辑推荐与帖子照常搜。
    const degraded = searchContent('沙面岛', [])
    expect(degraded.total).toBe(0)
    expect(degraded.groups).toEqual([])
  })

  it('景点条目的链接指向详情页，其余条目不带链接', () => {
    const outcome = searchContent('成都', ATTRACTIONS)

    const attractionGroup = outcome.groups.find((group) => group.kind === 'attraction')
    expect(attractionGroup?.items.map((item) => item.href)).toEqual([
      '/attractions/01JQATTR000000000000000006',
    ])

    for (const group of outcome.groups.filter((entry) => entry.kind !== 'attraction')) {
      for (const item of group.items) {
        expect(item.href).toBeUndefined()
      }
    }
  })

  it('景点评分缺失时元信息不写成零分', () => {
    const attractionGroup = searchContent('lookout', ATTRACTIONS).groups.find(
      (group) => group.kind === 'attraction',
    )

    expect(attractionGroup?.items[0].meta).toBe('Not rated yet · 100 views')
  })

  it('草稿帖子不出现', () => {
    // 草稿帖子 id1「在故宫闭馆前的最后半小时」；「闭馆前」也会命中编辑推荐摘要，故取更独特的片段
    expect(searchContent('最后半小时', ATTRACTIONS).total).toBe(0)
  })

  it('城市中文名命中三类内容', () => {
    expect(kindOrder('成都')).toEqual(['editor-pick', 'post', 'attraction'])
    expect(groupKeys('成都')).toEqual([
      ['editor-pick-3'],
      ['post-3', 'post-10'],
      ['attraction-01JQATTR000000000000000006'],
    ])
  })

  it('城市英文名命中三类内容', () => {
    // Chengdu 与 slug 同形，命中经由英文名成立
    expect(kindOrder('chengdu')).toEqual(['editor-pick', 'post', 'attraction'])
    expect(groupKeys('chengdu')).toEqual(groupKeys('成都'))
  })

  it('slug 与英文名不同形时不命中', () => {
    // xian 是 slug，英文名 Xi'an 含撇号；slug 不单独参与匹配，故零命中
    expect(searchContent('xian', ATTRACTIONS).total).toBe(0)
    expect(searchContent('XIan', ATTRACTIONS).total).toBe(0)
  })

  it('忽略大小写与首尾空白', () => {
    const padded = searchContent('  Chengdu  ', ATTRACTIONS)
    const plain = searchContent('chengdu', ATTRACTIONS)

    expect(padded.query).toBe('Chengdu')
    expect(padded.groups).toEqual(plain.groups)
    expect(padded.total).toEqual(plain.total)
  })

  it('内容字段同时匹配中英文', () => {
    const chinese = searchContent('宽窄巷子', ATTRACTIONS)
    const english = searchContent('Kuanzhai Alley', ATTRACTIONS)

    expect(chinese.total).toBeGreaterThan(0)
    expect(english.groups).toEqual(chinese.groups)
  })

  it('分组顺序固定为编辑推荐、帖子、景点', () => {
    expect(kindOrder('成都')).toEqual(['editor-pick', 'post', 'attraction'])
    // 只有一类命中时也不补空分组
    expect(kindOrder('沙面岛')).toEqual(['attraction'])
  })

  it('组内保持数据源顺序', () => {
    // 「编辑」命中 4 条编辑推荐，数据源顺序为 id 2、3、5、6
    const editorGroup = searchContent('编辑', ATTRACTIONS).groups.find(
      (group) => group.kind === 'editor-pick',
    )
    expect(editorGroup?.items.map((item) => item.key)).toEqual([
      'editor-pick-2',
      'editor-pick-3',
      'editor-pick-5',
      'editor-pick-6',
    ])
    expect(editorGroup?.count).toBe(4)
  })

  it('命中条数与总数一致，且每组都带回首页锚点', () => {
    const outcome = searchContent('成都', ATTRACTIONS)

    expect(outcome.total).toBe(
      outcome.groups.reduce((sum, group) => sum + group.items.length, 0),
    )
    for (const group of outcome.groups) {
      expect(group.anchorHref).toMatch(/^\/#(editor-picks|hot-posts|hot-attractions)$/)
      expect(group.anchorLabel.length).toBeGreaterThan(0)
    }
  })

  it('条目 key 跨分组唯一', () => {
    const keys = searchContent('成都', ATTRACTIONS).groups.flatMap((group) =>
      group.items.map((item) => item.key),
    )

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('条目都带城市英文名与一条类型元信息', () => {
    const outcome = searchContent('成都', ATTRACTIONS)

    for (const group of outcome.groups) {
      for (const item of group.items) {
        expect(item.cityLabel).not.toBe('')
        expect(item.cityLabel).not.toBe(item.city)
        expect(item.meta).not.toBe('')
      }
    }
  })

  it('输出文案全为英文', () => {
    for (const keyword of ['成都', '编辑', '沙面岛']) {
      const outcome = searchContent(keyword, ATTRACTIONS)
      for (const group of outcome.groups) {
        expect(HAN.test(group.heading), `分组标题含中文：${group.heading}`).toBe(false)
        expect(HAN.test(group.anchorLabel), `锚点文案含中文：${group.anchorLabel}`).toBe(false)
        for (const item of group.items) {
          expect(HAN.test(item.title), `条目标题含中文：${item.title}`).toBe(false)
          expect(HAN.test(item.cityLabel), `城市名含中文：${item.cityLabel}`).toBe(false)
          expect(HAN.test(item.meta), `元信息含中文：${item.meta}`).toBe(false)
        }
      }
    }
  })
})
