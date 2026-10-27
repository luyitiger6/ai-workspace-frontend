import { describe, expect, it } from 'vitest'
import { searchContent } from './query'

/**
 * 数据依赖提醒：以下关键词都取自 lib/home/mock-data.ts 的当前内容。
 * 中英关键词成对出现，用来钉住「同一份数据的中英字段都能被检索到」。
 */
const TRUNCATED_POSTS = [
  { keyword: '回民街', id: 12 },
  { keyword: '后海村', id: 13 },
]
const TRUNCATED_ATTRACTION = { keyword: '沙面岛', id: 7 }

const HAN = /\p{Script=Han}/u

function groupIds(keyword: string): number[][] {
  return searchContent(keyword).groups.map((group) => group.items.map((item) => item.id))
}

function kindOrder(keyword: string): string[] {
  return searchContent(keyword).groups.map((group) => group.kind)
}

describe('站内检索', () => {
  it('空关键词不产生任何结果', () => {
    for (const raw of ['', '   ', '\n']) {
      const outcome = searchContent(raw)
      expect(outcome.total).toBe(0)
      expect(outcome.groups).toEqual([])
      expect(outcome.query).toBe('')
    }
  })

  it('能看到被首页上限截断的帖子', () => {
    // 已发布帖子 12 条，首页只取评论数前 10 条；这两条被截断在首页之外
    for (const { keyword, id } of TRUNCATED_POSTS) {
      const postGroup = searchContent(keyword).groups.find((group) => group.kind === 'post')
      expect(postGroup?.items.map((item) => item.id), `关键词「${keyword}」应当命中被首页截断的帖子`).toContain(id)
    }
  })

  it('能看到被首页上限截断的景点', () => {
    // 已发布景点 7 个，首页只取浏览量前 5 个
    const outcome = searchContent(TRUNCATED_ATTRACTION.keyword)
    const attractionGroup = outcome.groups.find((group) => group.kind === 'attraction')
    expect(attractionGroup?.items.map((item) => item.id)).toEqual([TRUNCATED_ATTRACTION.id])
  })

  it('草稿与已删除的内容不出现', () => {
    // 草稿帖子 id1「在故宫闭馆前的最后半小时」；「闭馆前」也会命中编辑推荐摘要，故取更独特的片段
    expect(searchContent('最后半小时').total).toBe(0)
    // 草稿景点「未开放的观景台」、已下线景点「已下线的旧景点」
    expect(searchContent('未开放的观景台').total).toBe(0)
    expect(searchContent('已下线的旧景点').total).toBe(0)
    // 英文侧同样不可见：草稿景点 nameEn
    expect(searchContent('viewing deck not yet open').total).toBe(0)
  })

  it('城市中文名命中三类内容', () => {
    expect(kindOrder('成都')).toEqual(['editor-pick', 'post', 'attraction'])
    expect(groupIds('成都')).toEqual([[3], [3, 10], [6]])
  })

  it('城市英文名命中三类内容', () => {
    // Chengdu 与 slug 同形，命中经由英文名成立
    expect(kindOrder('chengdu')).toEqual(['editor-pick', 'post', 'attraction'])
    expect(groupIds('chengdu')).toEqual([[3], [3, 10], [6]])
  })

  it('slug 与英文名不同形时不命中', () => {
    // xian 是 slug，英文名 Xi'an 含撇号；slug 不单独参与匹配，故零命中
    expect(searchContent('xian').total).toBe(0)
    expect(searchContent('XIan').total).toBe(0)
  })

  it('忽略大小写与首尾空白', () => {
    const padded = searchContent('  Chengdu  ')
    const plain = searchContent('chengdu')

    expect(padded.query).toBe('Chengdu')
    expect(padded.groups).toEqual(plain.groups)
    expect(padded.total).toEqual(plain.total)
  })

  it('内容字段同时匹配中英文', () => {
    const chinese = searchContent('宽窄巷子')
    const english = searchContent('Kuanzhai Alley')

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
    const editorGroup = searchContent('编辑').groups.find((group) => group.kind === 'editor-pick')
    expect(editorGroup?.items.map((item) => item.id)).toEqual([2, 3, 5, 6])
    expect(editorGroup?.count).toBe(4)
  })

  it('命中条数与总数一致，且每组都带回首页锚点', () => {
    const outcome = searchContent('成都')

    expect(outcome.total).toBe(
      outcome.groups.reduce((sum, group) => sum + group.items.length, 0),
    )
    for (const group of outcome.groups) {
      expect(group.anchorHref).toMatch(/^\/#(editor-picks|hot-posts|hot-attractions)$/)
      expect(group.anchorLabel.length).toBeGreaterThan(0)
    }
  })

  it('条目都带城市英文名与一条类型元信息', () => {
    const outcome = searchContent('成都')

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
      const outcome = searchContent(keyword)
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
