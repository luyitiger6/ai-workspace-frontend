import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PostPage, PostSortBy, PostSummary } from '@/lib/posts/types'
import { useInfinitePosts } from './use-infinite-posts'

function makePost(id: number): PostSummary {
  return {
    publicId: id.toString().padStart(26, '0'),
    title: `Post ${id}`,
    tags: ['Walking'],
    authorPublicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    status: 'published',
    coverImage: 'https://example.com/cover.jpg',
    commentCount: id,
    upVoteCount: id * 2,
    bookmarkCount: id,
    createdAt: '2026-10-01T10:00:00+08:00',
  }
}

function deferred() {
  let resolve!: (page: PostPage) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<PostPage>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('useInfinitePosts', () => {
  it('首次加载返回第一页', async () => {
    const load = vi.fn().mockResolvedValueOnce({
      items: [makePost(1), makePost(2)],
      nextCursor: 'cursor-1',
      hasMore: true,
    } satisfies PostPage)

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ publicId: makePost(1).publicId }), expect.objectContaining({ publicId: makePost(2).publicId })],
      hasMore: true,
      isLoadingMore: false,
      loadMoreError: false,
    })
  })

  it('loadMore 追加下一页', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        items: [makePost(1)],
        nextCursor: 'cursor-1',
        hasMore: true,
      } satisfies PostPage)
      .mockResolvedValueOnce({
        items: [makePost(2)],
        nextCursor: null,
        hasMore: false,
      } satisfies PostPage)

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(load).toHaveBeenLastCalledWith('latest', 'cursor-1', expect.any(AbortSignal))
    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ publicId: makePost(1).publicId }), expect.objectContaining({ publicId: makePost(2).publicId })],
      hasMore: false,
      isLoadingMore: false,
    })
  })

  it('切换排序后清空列表并重新加载第一页', async () => {
    const load = vi.fn().mockImplementation(async (sortBy: PostSortBy) => ({
      items: sortBy === 'latest' ? [makePost(1)] : [makePost(10)],
      nextCursor: null,
      hasMore: false,
    }))

    const { result, rerender } = renderHook(
      ({ sortBy }: { sortBy: PostSortBy }) => useInfinitePosts({ sortBy, load }),
      { initialProps: { sortBy: 'latest' } },
    )

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ publicId: makePost(1).publicId })],
    })

    rerender({ sortBy: 'hottest' })

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        items: [expect.objectContaining({ publicId: makePost(10).publicId })],
      }),
    )
    expect(load).toHaveBeenLastCalledWith('hottest', null, expect.any(AbortSignal))
  })

  it('首次加载失败可重试', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('error'))

    load.mockResolvedValueOnce({
      items: [makePost(1)],
      nextCursor: null,
      hasMore: false,
    })

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.state.status).toBe('ready')
    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ publicId: makePost(1).publicId })],
    })
  })

  it('分页失败不清空已有数据且可重试', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        items: [makePost(1)],
        nextCursor: 'cursor-1',
        hasMore: true,
      } satisfies PostPage)
      .mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ publicId: makePost(1).publicId })],
      loadMoreError: true,
      isLoadingMore: false,
    })

    load.mockResolvedValueOnce({
      items: [makePost(2)],
      nextCursor: null,
      hasMore: false,
    })

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ publicId: makePost(1).publicId }), expect.objectContaining({ publicId: makePost(2).publicId })],
      loadMoreError: false,
    })
    expect(load.mock.calls.map((call) => call[1])).toEqual([null, 'cursor-1', 'cursor-1'])
  })

  it('旧首载晚于新排序返回时不覆盖列表和游标', async () => {
    const old = deferred()
    const fresh = deferred()
    const load = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    const { result, rerender } = renderHook(
      ({ sortBy }: { sortBy: PostSortBy }) => useInfinitePosts({ sortBy, load }),
      { initialProps: { sortBy: 'latest' } },
    )
    const oldSignal = load.mock.calls[0][2] as AbortSignal
    rerender({ sortBy: 'hottest' })
    expect(result.current.state.status).toBe('loading')
    expect(oldSignal.aborted).toBe(true)
    await act(async () => fresh.resolve({ items: [makePost(10)], nextCursor: null, hasMore: true }))
    await act(async () => old.resolve({ items: [makePost(1)], nextCursor: 'obsolete', hasMore: true }))
    expect(result.current.state).toMatchObject({ items: [makePost(10)], hasMore: false })
    await act(async () => result.current.loadMore())
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('旧分页成功或失败均不污染新排序，也不解开新请求锁', async () => {
    const oldPage = deferred()
    const fresh = deferred()
    const load = vi.fn()
      .mockResolvedValueOnce({ items: [makePost(1)], nextCursor: 'old-cursor', hasMore: true })
      .mockReturnValueOnce(oldPage.promise).mockReturnValueOnce(fresh.promise)
    const { result, rerender } = renderHook(
      ({ sortBy }: { sortBy: PostSortBy }) => useInfinitePosts({ sortBy, load }),
      { initialProps: { sortBy: 'latest' } },
    )
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    let pending!: Promise<void>
    act(() => { pending = result.current.loadMore() })
    const oldSignal = load.mock.calls[1][2] as AbortSignal
    rerender({ sortBy: 'mostDiscussed' })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => { oldPage.reject(new Error('late failure')); await pending })
    expect(result.current.state.status).toBe('loading')
    await act(async () => result.current.retry())
    expect(load).toHaveBeenCalledTimes(3)
    await act(async () => fresh.resolve({ items: [makePost(10)], nextCursor: null, hasMore: false }))
    expect(result.current.state).toMatchObject({ items: [makePost(10)], loadMoreError: false })
  })

  it('同页和跨页重复按 publicId 去重并保持接口顺序', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ items: [makePost(1), makePost(1), makePost(2)], nextCursor: 'opaque+/=', hasMore: false })
      .mockResolvedValueOnce({ items: [makePost(2), makePost(3), makePost(3)], nextCursor: null, hasMore: true })
    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))
    await waitFor(() => expect(result.current.state).toMatchObject({ items: [makePost(1), makePost(2)], hasMore: true }))
    await act(async () => result.current.loadMore())
    expect(load).toHaveBeenLastCalledWith('latest', 'opaque+/=', expect.any(AbortSignal))
    expect(result.current.state).toMatchObject({ items: [makePost(1), makePost(2), makePost(3)], hasMore: false })
  })

  it('连续触发分页只发一次请求', async () => {
    const next = deferred()
    const load = vi.fn()
      .mockResolvedValueOnce({ items: [makePost(1)], nextCursor: 'cursor', hasMore: true })
      .mockReturnValueOnce(next.promise)
    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.loadMore()
      void result.current.loadMore()
      void result.current.loadMore()
    })
    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.state).toMatchObject({ isLoadingMore: true })
    await act(async () => { next.resolve({ items: [makePost(2)], nextCursor: null, hasMore: false }); await pending })
    await act(async () => result.current.loadMore())
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('空列表到底不再请求，不信任冲突的 hasMore', async () => {
    const load = vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: true })
    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))
    await waitFor(() => expect(result.current.state).toMatchObject({ status: 'ready', items: [], hasMore: false }))
    await act(async () => result.current.loadMore())
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('首载连续重试只发一个 GET', async () => {
    const retry = deferred()
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(retry.promise)
    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    let pending!: Promise<void>
    act(() => { pending = result.current.retry(); void result.current.retry() })
    expect(load).toHaveBeenCalledTimes(2)
    await act(async () => { retry.resolve({ items: [], nextCursor: null, hasMore: false }); await pending })
    expect(load.mock.calls.map((call) => call[1])).toEqual([null, null])
  })

  it('卸载取消请求，忽略不遵守取消的迟到响应', async () => {
    const late = deferred()
    const load = vi.fn().mockReturnValueOnce(late.promise)
    const { unmount } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))
    const signal = load.mock.calls[0][2] as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => late.resolve({ items: [makePost(1)], nextCursor: null, hasMore: false }))
    expect(load).toHaveBeenCalledTimes(1)
  })
})
