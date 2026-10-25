import { describe, expect, it } from 'vitest'
import {
  EDITOR_PICKS_LIMIT,
  HOT_ATTRACTIONS_LIMIT,
  HOT_POSTS_LIMIT,
  mockRepository,
} from './repository'

describe('首页 Mock 仓储', () => {
  it('编辑推荐按 sortOrder 升序、并列按 id 升序', async () => {
    const { items } = await mockRepository.listEditorPicks({ city: 'all' })

    expect(items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('编辑推荐最多返回契约上限条数', async () => {
    const { items } = await mockRepository.listEditorPicks({ city: 'all' })

    expect(items).toHaveLength(EDITOR_PICKS_LIMIT)
  })

  it('编辑推荐按城市过滤并保留全城通用卡片', async () => {
    const { items } = await mockRepository.listEditorPicks({ city: 'beijing' })

    expect(items.map((item) => item.id)).toEqual([1, 4])
  })

  it('热门帖子最多返回 10 条已发布内容', async () => {
    const { items, total } = await mockRepository.listHotPosts({ city: 'all' })

    expect(items).toHaveLength(HOT_POSTS_LIMIT)
    expect(total).toBe(12)
  })

  it('热门帖子按评论数、浏览数、发布时间依次降序', async () => {
    const { items } = await mockRepository.listHotPosts({ city: 'all' })

    expect(items[0].id).toBe(3)
    expect(items[1].id).toBe(2)
    expect(items[0].commentCount).toBe(items[1].commentCount)
    expect(items[0].viewCount).toBeGreaterThan(items[1].viewCount)
  })

  it('热门帖子不包含草稿与已删除内容', async () => {
    const { items } = await mockRepository.listHotPosts({ city: 'all' })
    const titles = items.map((item) => item.title)

    expect(titles).not.toContain('在故宫闭馆前的最后半小时')
    expect(titles).not.toContain('已删除的旧帖')
  })

  it('热门景点最多返回 5 个已发布内容并按浏览量降序', async () => {
    const { items, total } = await mockRepository.listHotAttractions({ city: 'all' })

    expect(items).toHaveLength(HOT_ATTRACTIONS_LIMIT)
    expect(total).toBe(7)
    expect(items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5])
    expect(items.map((item) => item.name)).not.toContain('未开放的观景台')
  })

  it('同一查询重复调用返回完全一致的结果', async () => {
    const first = await mockRepository.listHotPosts({ city: 'shanghai' })
    const second = await mockRepository.listHotPosts({ city: 'shanghai' })

    expect(second).toEqual(first)
  })
})
