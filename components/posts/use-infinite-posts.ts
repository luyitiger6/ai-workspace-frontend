'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostPage, PostSortBy, PostSummary } from '@/lib/posts/types'

export type InfinitePostsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      items: PostSummary[]
      isLoadingMore: boolean
      hasMore: boolean
      loadMoreError: boolean
    }

export interface UseInfinitePostsOptions {
  sortBy: PostSortBy
  load: (sortBy: PostSortBy, cursor: string | null, signal: AbortSignal) => Promise<PostPage>
}

export function useInfinitePosts({ sortBy, load }: UseInfinitePostsOptions) {
  const [snapshot, setSnapshot] = useState({ sortBy, load, value: { status: 'loading' } as InfinitePostsState })
  // 在 effect 重置前也不把旧排序的列表交给新一轮渲染。
  const state: InfinitePostsState = snapshot.sortBy === sortBy && snapshot.load === load
    ? snapshot.value : { status: 'loading' }
  const cursorRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)
  const generationRef = useRef(0)
  const contextRef = useRef({ sortBy, load })
  const controllerRef = useRef<AbortController | null>(null)

  const setState = useCallback((update: (prev: InfinitePostsState) => InfinitePostsState) => {
    setSnapshot((prev) => ({ sortBy, load, value: update(prev.value) }))
  }, [sortBy, load])

  const loadPage = useCallback(
    async (cursor: string | null) => {
      if (loadingMoreRef.current || contextRef.current.sortBy !== sortBy || contextRef.current.load !== load) return
      loadingMoreRef.current = true
      const generation = ++generationRef.current
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const isCurrent = () => generationRef.current === generation && !controller.signal.aborted
      setState((prev) => cursor !== null && prev.status === 'ready'
        ? { ...prev, isLoadingMore: true, loadMoreError: false } : { status: 'loading' })
      try {
        const result = await load(sortBy, cursor, controller.signal)
        if (!isCurrent()) return
        cursorRef.current = result.nextCursor
        setState((prev) => {
          const existing = prev.status === 'ready' ? prev.items : []
          return {
            status: 'ready',
            // 保留接口顺序，第一页和跨页都去重，不在 UI 排序或解码游标。
            items: Array.from(new Map((cursor !== null ? existing.concat(result.items) : result.items)
              .map((post) => [post.publicId, post])).values()),
            isLoadingMore: false,
            hasMore: result.nextCursor !== null,
            loadMoreError: false,
          }
        })
      } catch {
        if (!isCurrent()) return
        setState((prev) => {
          if (prev.status === 'ready') {
            return { ...prev, isLoadingMore: false, loadMoreError: true }
          }
          return { status: 'error' }
        })
      } finally {
        // 旧请求的结束不能解除新请求的同步锁。
        if (isCurrent()) loadingMoreRef.current = false
      }
    },
    [load, sortBy, setState],
  )

  useEffect(() => {
    contextRef.current = { sortBy, load }
    cursorRef.current = null
    loadingMoreRef.current = false
    void loadPage(null)
    return () => {
      ++generationRef.current
      controllerRef.current?.abort()
    }
  }, [sortBy, load, loadPage])

  const loadMore = useCallback(async () => {
    if (state.status !== 'ready' || state.loadMoreError || cursorRef.current === null) return
    await loadPage(cursorRef.current)
  }, [state, loadPage])

  const retry = useCallback(async () => {
    if (state.status === 'error') await loadPage(null)
    else if (state.status === 'ready' && state.loadMoreError) await loadPage(cursorRef.current)
  }, [state, loadPage])

  return { state, loadMore, retry }
}
