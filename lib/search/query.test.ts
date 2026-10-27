import { describe, expect, it } from 'vitest'
import { searchContent } from './query'

/** 数据依赖提醒：以下关键词都取自 lib/home/mock-data.ts 的当前内容。 */
const TRUNCATED_POST_KEYWORDS = ['回民街', '后海村']
const TRUNCATED_ATTRACTION_KEYWORD = '沙面岛'

function titles(keyword: string, groupIndex: number): string[] {
  const outcome = searchContent(keyword)
  return outcome.groups[groupIndex]?.items.map((item) => item.title) ?? []
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
    for (const keyword of TRUNCATED_POST_KEYWORDS) {
      const outcome = searchContent(keyword)
      const postTitles = outcome.groups.find((group) => group.kind === 'post')?.items.map((i) => i.title) ?? []
      expect(postTitles.some((title) => title.includes(keyword)), `关键词「${keyword}」应当命中被首页截断的帖子`).toBe(true)
    }
  })

  it('能看到被首页上限截断的景点', () => {
    // 已发布景点 7 个，首页只取浏览量前 5 个
    const outcome = searchContent(TRUNCATED_ATTRACTION_KEYWORD)
    expect(titles(TRUNCATED_ATTRACTION_KEYWORD, 0)).toContain(TRUNCATED_ATTRACTION_KEYWORD)
    expect(outcome.total).toBeGreaterThan(0)
  })

  it('草稿与已删除的内容不出现', () => {
    // 草稿帖子 id1「在故宫闭馆前的最后半小时」；「闭馆前」也会命中编辑推荐摘要，故取更独特的片段
    expect(searchContent('最后半小时').total).toBe(0)
    // 草稿景点「未开放的观景台」、已下线景点「已下线的旧景点」
    expect(searchContent('未开放的观景台').total).toBe(0)
    expect(searchContent('已下线的旧景点').total).toBe(0)
  })

  it('城市中文名能命中三类内容', () => {
    const outcome = searchContent('成都')

    expect(outcome.groups.map((group) => group.kind)).toEqual([
      'editor-pick',
      'post',
      'attraction',
    ])
    expect(outcome.groups[0].items.map((item) => item.title)).toEqual(['人民公园的一杯盖碗茶'])
    expect(outcome.groups[1].items.map((item) => item.id)).toEqual([3, 10])
    expect(outcome.groups[2].items.map((item) => item.title)).toEqual(['宽窄巷子'])
  })

  it('城市 slug 不作为匹配依据', () => {
    expect(searchContent('chengdu').total).toBe(0)
    expect(searchContent('Chengdu').total).toBe(0)
  })

  it('忽略大小写与首尾空白', () => {
    const padded = searchContent('  成都  ')
    const plain = searchContent('成都')

    expect(padded.query).toBe('成都')
    expect(padded.groups).toEqual(plain.groups)
    expect(padded.total).toEqual(plain.total)

    // Mock 数据全为中文，大小写归一化只体现在 slug 不参与匹配上（见上一条用例）
  })

  it('分组顺序固定为编辑推荐、帖子、景点', () => {
    expect(searchContent('成都').groups.map((group) => group.kind)).toEqual([
      'editor-pick',
      'post',
      'attraction',
    ])
    // 只有一类命中时也不补空分组
    expect(searchContent('沙面岛').groups.map((group) => group.kind)).toEqual(['attraction'])
  })

  it('组内保持数据源顺序', () => {
    // 「编辑」命中 4 条编辑推荐，数据源顺序为 id 2、3、5、6
    const outcome = searchContent('编辑')
    const editorGroup = outcome.groups.find((group) => group.kind === 'editor-pick')
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

  it('条目都带城市中文名与一条类型元信息', () => {
    const outcome = searchContent('成都')

    for (const group of outcome.groups) {
      for (const item of group.items) {
        expect(item.cityLabel).not.toBe('')
        expect(item.cityLabel).not.toBe(item.city)
        expect(item.meta).not.toBe('')
      }
    }
  })
})
