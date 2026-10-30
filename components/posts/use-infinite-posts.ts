'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Post, PostFeedResult, PostSortBy } from '@/lib/home/types'

export type InfinitePostsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      items: Post[]
      isLoadingMore: boolean
      hasMore: boolean
      loadMoreError: boolean
    }

export interface UseInfinitePostsOptions {
  sortBy: PostSortBy
  load: (sortBy: PostSortBy, cursor: string | null) => Promise<PostFeedResult<Post>>
}

export function useInfinitePosts({ sortBy, load }: UseInfinitePostsOptions) {
  const [state, setState] = useState<InfinitePostsState>({ status: 'loading' })
  const cursorRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)
  const activeRef = useRef(true)

  const reset = useCallback(() => {
    cursorRef.current = null
    loadingMoreRef.current = false
    setState({ status: 'loading' })
  }, [])

  const loadPage = useCallback(
    async (cursor: string | null) => {
      try {
        const result = await load(sortBy, cursor)
        if (!activeRef.current) {
          return
        }
        cursorRef.current = result.nextCursor
        setState((prev) => {
          const existing = prev.status === 'ready' ? prev.items : []
          return {
            status: 'ready',
            items: cursor ? existing.concat(result.items) : result.items,
            isLoadingMore: false,
            hasMore: result.hasMore,
            loadMoreError: false,
          }
        })
        loadingMoreRef.current = false
      } catch {
        if (!activeRef.current) {
          return
        }
        setState((prev) => {
          if (prev.status === 'ready') {
            return { ...prev, isLoadingMore: false, loadMoreError: true }
          }
          return { status: 'error' }
        })
        loadingMoreRef.current = false
      }
    },
    [load, sortBy],
  )

  useEffect(() => {
    activeRef.current = true
    reset()
    loadPage(null)
    return () => {
      activeRef.current = false
    }
  }, [sortBy, loadPage, reset])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || cursorRef.current === null) {
      return
    }
    loadingMoreRef.current = true
    setState((prev) => {
      if (prev.status !== 'ready') {
        return prev
      }
      return { ...prev, isLoadingMore: true, loadMoreError: false }
    })
    await loadPage(cursorRef.current)
  }, [loadPage])

  const retry = useCallback(() => {
    if (state.status === 'error') {
      setState({ status: 'loading' })
      loadPage(null)
      return
    }
    if (state.status === 'ready' && state.loadMoreError) {
      setState((prev) => {
        if (prev.status !== 'ready') {
          return prev
        }
        return { ...prev, isLoadingMore: true, loadMoreError: false }
      })
      loadPage(cursorRef.current)
    }
  }, [state, loadPage])

  return { state, loadMore, retry }
}
