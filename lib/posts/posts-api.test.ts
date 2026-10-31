import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describePostsError, PostsApiError, PostsNetworkError, postsApi } from './posts-api'

const fetchMock = vi.fn()
const ID = '01K7POST0000000000000000000'
const summary = {
  publicId: ID, title: 'Real title', coverImage: '', tags: ['travel'], status: 'published',
  authorPublicId: '01K7AUTHOR000000000000000000', createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T01:00:00Z', commentCount: 0, upVoteCount: 0, bookmarkCount: 0,
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

function lastRequest() {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  expect(path).toMatch(/^\/api\/posts/)
  expect(init.credentials).toBe('same-origin')
  expect(init.cache).toBe('no-store')
  expect(init.headers).toMatchObject({ accept: 'application/json' })
  return { path, init }
}

describe('真实帖子端点层', () => {
  it.each([
    ['latest', 'publishedAt'], ['hottest', 'upVoteCount'], ['mostDiscussed', 'commentCount'],
  ] as const)('UI %s 映射 HTTP %s 并适配真实白名单', async (ui, http) => {
    fetchMock.mockResolvedValue(json({ items: [summary], nextCursor: null }))
    const page = await postsApi.feed(ui)
    const { path } = lastRequest()
    const query = new URL(path, 'http://localhost').searchParams
    expect(query.get('sortBy')).toBe(http)
    expect(query.get('limit')).toBe('20')
    expect(query.has('cursor')).toBe(false)
    expect(page.hasMore).toBe(false)
    expect(page.items[0]).toEqual({
      publicId: ID, title: summary.title, coverImage: '', tags: ['travel'], status: 'published',
      authorPublicId: summary.authorPublicId, createdAt: summary.createdAt,
      commentCount: 0, upVoteCount: 0, bookmarkCount: 0,
    })
    expect(page.items[0]).not.toHaveProperty('updatedAt')
    for (const fake of ['id', 'summaryEn', 'authorEn', 'titleEn', 'publishedAt']) {
      expect(page.items[0]).not.toHaveProperty(fake)
    }
  })

  it('cursor 不解码不重建，signal 原样传递，hasMore 只从游标推导', async () => {
    const cursor = 'opaque+/=%中文'
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue(json({ items: [], nextCursor: cursor }))
    expect((await postsApi.feed('latest', cursor, signal)).hasMore).toBe(true)
    expect(new URL(lastRequest().path, 'http://localhost').searchParams.get('cursor')).toBe(cursor)
    expect(lastRequest().init.signal).toBe(signal)
    fetchMock.mockResolvedValue(json({ items: [], nextCursor: null }))
    await postsApi.comments(ID, cursor, signal)
    expect(new URL(lastRequest().path, 'http://localhost').searchParams.get('cursor')).toBe(cursor)
    expect(lastRequest().init.signal).toBe(signal)
  })

  it('详情读取保留正文/统计而无 Mock 兜底，本人读取仅准确两字段', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValueOnce(json({ ...summary, content: '<b>text</b>\n正文' }))
    const detail = await postsApi.detail(ID, signal)
    expect(detail.content).toBe('<b>text</b>\n正文')
    expect(detail.upVoteCount).toBe(0)
    expect(detail.updatedAt).toBe(summary.updatedAt)
    expect(lastRequest().path).toBe(`/api/posts/${ID}`)
    expect(lastRequest().init.signal).toBe(signal)
    for (const direction of [null, 'up', 'down']) {
      fetchMock.mockResolvedValueOnce(json({ voteDirection: direction, bookmarked: direction === 'down' }))
      expect(await postsApi.readMyInteractions(ID)).toEqual({ voteDirection: direction, bookmarked: direction === 'down' })
      expect(lastRequest().path).toBe(`/api/posts/${ID}/interactions/me`)
    }
  })

  it('评论、票向和收藏的 POST 请求及响应保持真实字段', async () => {
    const signal = new AbortController().signal
    const comment = { publicId: 'COMMENT', parentPublicId: null, content: '正文' }
    fetchMock.mockResolvedValueOnce(json(comment, 201))
    expect(await postsApi.createComment(ID, { content: '正文', parentPublicId: null }, signal)).toEqual(comment)
    expect(lastRequest()).toMatchObject({ path: `/api/posts/${ID}/comments`, init: { method: 'POST', signal } })
    expect(JSON.parse(String(lastRequest().init.body))).toEqual({ content: '正文', parentPublicId: null })
    expect(lastRequest().init.headers).toMatchObject({ 'content-type': 'application/json' })
    for (const direction of ['up', 'down'] as const) {
      fetchMock.mockResolvedValueOnce(json({ direction }))
      await postsApi.vote(ID, direction, signal)
      expect(lastRequest()).toMatchObject({ path: `/api/posts/${ID}/votes`, init: { method: 'POST', signal } })
      expect(JSON.parse(String(lastRequest().init.body))).toEqual({ direction })
    }
    fetchMock.mockResolvedValueOnce(json({ publicId: 'BOOKMARK' }, 201))
    await postsApi.bookmark(ID, signal)
    expect(lastRequest()).toMatchObject({ path: `/api/posts/${ID}/bookmarks`, init: { method: 'POST', signal } })
    expect(lastRequest().init.body).toBeUndefined()
  })

  it('三个 DELETE 接受 204 空体，保留方法、路径与 signal', async () => {
    const signal = new AbortController().signal
    for (const [run, path] of [
      [() => postsApi.deleteComment(ID, 'COMMENT', signal), `/api/posts/${ID}/comments/COMMENT`],
      [() => postsApi.cancelVote(ID, signal), `/api/posts/${ID}/votes`],
      [() => postsApi.cancelBookmark(ID, signal), `/api/posts/${ID}/bookmarks`],
    ] as const) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
      expect(await run()).toBeUndefined()
      expect(lastRequest()).toMatchObject({ path, init: { method: 'DELETE', signal } })
      expect(lastRequest().init.body).toBeUndefined()
    }
  })

  it.each([
    [401, 'UNAUTHENTICATED'], [403, 'POST_FORBIDDEN'], [404, 'POST_NOT_FOUND'],
    [400, 'VALIDATION_FAILED'], [403, 'CROSS_SITE_REJECTED'],
  ])('HTTP %s / %s 不冒充成功且不自动重放', async (status, code) => {
    fetchMock.mockResolvedValue(json({ code, message: 'refused' }, status))
    await expect(postsApi.cancelVote(ID)).rejects.toMatchObject({ status, code })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const text = describePostsError(new PostsApiError(status, code, 'refused'))
    expect(text).not.toBe('refused')
    expect(text).not.toContain('email or password')
  })

  it('网络、非 JSON 502、null 错误体与成功非 JSON 均可控', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(postsApi.createComment(ID, { content: 'x', parentPublicId: null })).rejects.toBeInstanceOf(PostsNetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
    await expect(postsApi.detail(ID)).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' })
    fetchMock.mockResolvedValueOnce(json(null, 503))
    await expect(postsApi.detail(ID)).rejects.toMatchObject({ status: 503, code: 'UNKNOWN' })
    fetchMock.mockResolvedValueOnce(new Response('not JSON', { status: 200 }))
    await expect(postsApi.detail(ID)).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' })
  })

  it.each([
    new DOMException('aborted', 'AbortError'),
    { name: 'AbortError', message: '跨环境取消' },
  ])('AbortError 保持取消语义 %s', async (aborted) => {
    fetchMock.mockRejectedValueOnce(aborted)
    await expect(postsApi.detail(ID)).rejects.toBe(aborted)
  })

  it.each([200, 502])('响应体读取中取消不转换成 JSON/HTTP 错误 %s', async (status) => {
    const aborted = new DOMException('body aborted', 'AbortError')
    const response = new Response(null, { status })
    vi.spyOn(response, 'json').mockRejectedValueOnce(aborted)
    fetchMock.mockResolvedValueOnce(response)
    await expect(postsApi.detail(ID)).rejects.toBe(aborted)
  })

  it.each([null, undefined, 'AbortError', { name: 'TypeError' }])('其它拒绝值仍是网络失败 %s', async (cause) => {
    fetchMock.mockRejectedValueOnce(cause)
    await expect(postsApi.detail(ID)).rejects.toBeInstanceOf(PostsNetworkError)
  })
})
