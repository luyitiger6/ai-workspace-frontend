import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Post, PostFeedResult, PostSortBy } from '@/lib/home/types'
import { useInfinitePosts } from './use-infinite-posts'

function makePost(id: number): Post {
  return {
    id,
    title: `post-${id}`,
    titleEn: `Post ${id}`,
    summaryEn: `Summary ${id}`,
    author: 'author',
    authorEn: 'Author',
    city: 'beijing',
    status: 'published',
    coverUrl: 'https://example.com/cover.jpg',
    commentCount: id,
    viewCount: id * 10,
    upVoteCount: id * 2,
    bookmarkCount: id,
    publishedAt: '2026-10-01T10:00:00+08:00',
  }
}

describe('useInfinitePosts', () => {
  it('首次加载返回第一页', async () => {
    const load = vi.fn().mockResolvedValueOnce({
      items: [makePost(1), makePost(2)],
      nextCursor: 'cursor-1',
      hasMore: true,
    } satisfies PostFeedResult<Post>)

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
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
      } satisfies PostFeedResult<Post>)
      .mockResolvedValueOnce({
        items: [makePost(2)],
        nextCursor: 'cursor-2',
        hasMore: false,
      } satisfies PostFeedResult<Post>)

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(load).toHaveBeenLastCalledWith('latest', 'cursor-1')
    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
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
      items: [expect.objectContaining({ id: 1 })],
    })

    rerender({ sortBy: 'hottest' })

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        items: [expect.objectContaining({ id: 10 })],
      }),
    )
    expect(load).toHaveBeenLastCalledWith('hottest', null)
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
      items: [expect.objectContaining({ id: 1 })],
    })
  })

  it('分页失败不清空已有数据且可重试', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        items: [makePost(1)],
        nextCursor: 'cursor-1',
        hasMore: true,
      } satisfies PostFeedResult<Post>)
      .mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useInfinitePosts({ sortBy: 'latest', load }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.state).toMatchObject({
      status: 'ready',
      items: [expect.objectContaining({ id: 1 })],
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
      items: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
      loadMoreError: false,
    })
  })
})
