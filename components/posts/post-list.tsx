'use client'

import { useEffect, useRef } from 'react'
import type { PostSortBy, PostSummary } from '@/lib/posts/types'
import { PostCard } from './post-card'
import { PostCardSkeleton } from './post-card-skeleton'
import styles from './post-list.module.css'

export interface PostListProps {
  items: PostSummary[]
  sortBy: PostSortBy
  isLoadingMore: boolean
  hasMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
  onRetry: () => void
}

export function PostList({
  items,
  sortBy,
  isLoadingMore,
  hasMore,
  loadMoreError,
  onLoadMore,
  onRetry,
}: PostListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !isLoadingMore && hasMore && !loadMoreError) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [isLoadingMore, hasMore, loadMoreError, onLoadMore])

  if (items.length === 0 && !isLoadingMore && !hasMore && !loadMoreError) {
    return (
      <div className={styles.empty}>
        <p>No posts yet.</p>
        <p className={styles.emptyHint}>Be the first to share a route.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <ul className={styles.list} aria-label="Post feed">
        {items.map((post) => (
          <li key={post.publicId}>
            <PostCard post={post} sortBy={sortBy} />
          </li>
        ))}
        {isLoadingMore
          ? Array.from({ length: 3 }).map((_, index) => (
              <li key={`skeleton-${index}`}>
                <PostCardSkeleton />
              </li>
            ))
          : null}
      </ul>

      {loadMoreError ? (
        <div className={styles.retry} role="alert">
          <p>Could not load more posts.</p>
          <button type="button" className="wc-button wc-button--ghost" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {hasMore && !loadMoreError ? (
        <div ref={sentinelRef} className={styles.sentinel} data-testid="post-feed-sentinel" />
      ) : null}

      {!hasMore && items.length > 0 ? (
        <p className={styles.end} role="status">
          You have reached the end.
        </p>
      ) : null}
    </div>
  )
}
