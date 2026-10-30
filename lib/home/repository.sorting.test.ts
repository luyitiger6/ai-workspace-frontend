import { describe, expect, it, vi } from 'vitest'
import type { Attraction, EditorPick, Post } from './types'
import { mockRepository } from './repository'

/**
 * 排序与截断必须由注入数据集验证：真实 Mock 数据的 id 顺序恰好与各排序键同向，
 * 用它断言会变成「代理断言」，排序键写错也能通过。
 */
const data = vi.hoisted(() => {
  const pick = (id: number, city: EditorPick['city'], sortOrder: number): EditorPick => ({
    id,
    title: `pick-${id}`,
    titleEn: `Pick ${id}`,
    summary: 'summary',
    summaryEn: 'summary',
    city,
    coverUrl: 'https://example.com/cover.jpg',
    editor: 'editor',
    editorEn: 'Editor',
    sortOrder,
  })

  const editorPicks: EditorPick[] = [
    pick(1, 'all', 30),
    pick(2, 'beijing', 10),
    pick(3, 'shanghai', 20),
    pick(4, 'guangzhou', 20),
    pick(5, 'chengdu', 10),
    pick(6, 'sanya', 40),
    pick(7, 'xian', 50),
  ]

  const post = (
    id: number,
    city: Post['city'],
    commentCount: number,
    viewCount: number,
    publishedAt: string,
    status: Post['status'] = 'published',
  ): Post => ({
    id,
    title: `post-${id}`,
    titleEn: `Post ${id}`,
    summaryEn: `Summary of post ${id}`,
    author: 'author',
    authorEn: 'Author',
    city,
    status,
    coverUrl: 'https://example.com/cover.jpg',
    commentCount,
    viewCount,
    upVoteCount: 0,
    bookmarkCount: 0,
    publishedAt,
  })

  const posts: Post[] = [
    post(1, 'xian', 5, 100, '2026-10-01T10:00:00+08:00'),
    post(2, 'shanghai', 9, 50, '2026-10-05T10:00:00+08:00'),
    post(3, 'beijing', 9, 200, '2026-10-01T10:00:00+08:00'),
    post(4, 'guangzhou', 9, 200, '2026-10-03T10:00:00+08:00'),
    post(5, 'hangzhou', 9, 200, '2026-10-02T10:00:00+08:00'),
    post(6, 'sanya', 1, 100, '2026-10-01T10:00:00+08:00'),
    post(7, 'xian', 1, 90, 'not-a-date'),
    post(8, 'shanghai', 1, 90, 'also-not-a-date'),
    post(9, 'xian', 9, 200, '2026-10-01T10:00:00+08:00'),
    post(10, 'chengdu', 9, 200, '2026-10-02T10:00:00+08:00'),
    post(11, 'beijing', 1, 70, '2026-10-01T10:00:00+08:00'),
    post(12, 'guangzhou', 1, 60, '2026-10-01T10:00:00+08:00'),
    post(13, 'beijing', 99, 9999, '2026-10-01T10:00:00+08:00', 'draft'),
    post(14, 'beijing', 98, 9999, '2026-10-01T10:00:00+08:00', 'removed'),
  ]

  const attraction = (
    id: number,
    city: Attraction['city'],
    viewCount: number,
    publishedAt: string,
    status: Attraction['status'] = 'published',
  ): Attraction => ({
    id,
    name: `attraction-${id}`,
    nameEn: `Attraction ${id}`,
    city,
    coverUrl: 'https://example.com/cover.jpg',
    rating: 4.5,
    viewCount,
    status,
    publishedAt,
  })

  const attractions: Attraction[] = [
    attraction(1, 'beijing', 900, '2026-09-05T10:00:00+08:00'),
    attraction(2, 'shanghai', 900, '2026-09-05T10:00:00+08:00'),
    attraction(3, 'hangzhou', 900, '2026-09-06T10:00:00+08:00'),
    attraction(4, 'xian', 700, '2026-09-10T10:00:00+08:00'),
    attraction(5, 'chengdu', 500, '2026-09-01T10:00:00+08:00'),
    attraction(6, 'guangzhou', 300, '2026-09-01T10:00:00+08:00'),
    attraction(7, 'beijing', 9999, '2026-09-01T10:00:00+08:00', 'draft'),
    attraction(8, 'shanghai', 9999, '2026-09-01T10:00:00+08:00', 'removed'),
  ]

  return { editorPicks, posts, attractions }
})

vi.mock('./mock-data', () => ({
  EDITOR_PICKS: data.editorPicks,
  POSTS: data.posts,
  ATTRACTIONS: data.attractions,
}))

describe('仓储排序与截断（注入数据集）', () => {
  it('编辑推荐先按 sortOrder 升序、并列按 id 升序', async () => {
    const { items, total } = await mockRepository.listEditorPicks({ city: 'all' })

    expect(items.map((item) => item.id)).toEqual([2, 5, 3, 4, 1, 6])
    expect(total).toBe(7)
  })

  it('城市查询同时命中本城与全城通用内容', async () => {
    const { items, total } = await mockRepository.listEditorPicks({ city: 'beijing' })

    expect(items.map((item) => item.id)).toEqual([2, 1])
    expect(total).toBe(2)
  })

  it('热门帖子按评论、浏览、发布时间降序，并列按 id 升序', async () => {
    const { items, total } = await mockRepository.listHotPosts({ city: 'all' })

    expect(items.map((item) => item.id)).toEqual([4, 5, 10, 3, 9, 2, 1, 6, 7, 8])
    expect(total).toBe(12)
  })

  it('发布时间非法时排序不抛错并回落到 id 升序', async () => {
    const { items } = await mockRepository.listHotPosts({ city: 'all' })
    const invalid = items.filter((item) => Number.isNaN(new Date(item.publishedAt).getTime()))

    expect(invalid.map((item) => item.id)).toEqual([7, 8])
  })

  it('热门景点按浏览、发布时间降序，并列按 id 升序', async () => {
    const { items, total } = await mockRepository.listHotAttractions({ city: 'all' })

    expect(items.map((item) => item.id)).toEqual([3, 1, 2, 4, 5])
    expect(total).toBe(6)
  })

  it('草稿与已删除内容不计入 total', async () => {
    const posts = await mockRepository.listHotPosts({ city: 'all' })
    const attractions = await mockRepository.listHotAttractions({ city: 'all' })

    expect(posts.total).toBe(12)
    expect(attractions.total).toBe(6)
  })

  it('城市没有任何匹配内容时返回严格空结果', async () => {
    await expect(mockRepository.listHotAttractions({ city: 'sanya' })).resolves.toEqual({
      items: [],
      total: 0,
    })
  })

  it('三个返回上限是字面值 6 / 10 / 5', async () => {
    const picks = await mockRepository.listEditorPicks({ city: 'all' })
    const posts = await mockRepository.listHotPosts({ city: 'all' })
    const attractions = await mockRepository.listHotAttractions({ city: 'all' })

    expect(picks.items).toHaveLength(6)
    expect(posts.items).toHaveLength(10)
    expect(attractions.items).toHaveLength(5)
  })
})
