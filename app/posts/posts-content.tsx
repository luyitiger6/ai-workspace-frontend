'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { PostList } from '@/components/posts/post-list'
import { SortTabs } from '@/components/posts/sort-tabs'
import { useInfinitePosts } from '@/components/posts/use-infinite-posts'
import { mockRepository } from '@/lib/home/repository'
import type { PostSortBy } from '@/lib/home/types'
import styles from './page.module.css'

const DEFAULT_SORT_BY: PostSortBy = 'latest'

function parseSortBy(raw: string | null): PostSortBy {
  if (raw === 'latest' || raw === 'hottest' || raw === 'mostDiscussed') {
    return raw
  }
  return DEFAULT_SORT_BY
}

export function PostsContent() {
  const searchParams = useSearchParams()
  const sortBy = parseSortBy(searchParams.get('sortBy'))

  const load = useMemo(
    () => (currentSortBy: PostSortBy, cursor: string | null) =>
      mockRepository.feedPosts(currentSortBy, cursor),
    [],
  )

  const { state, loadMore, retry } = useInfinitePosts({ sortBy, load })

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <div className={styles.head}>
          <div>
            <p className="wc-eyebrow">Community</p>
            <h1 className={styles.title}>All posts</h1>
          </div>
          <SortTabs active={sortBy} />
        </div>

        {state.status === 'loading' ? (
          <div className={styles.loading} role="status">
            <p>Loading posts…</p>
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className={styles.error} role="alert">
            <p>Posts could not load. Please try again.</p>
            <button type="button" className="wc-button wc-button--primary" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <PostList
            items={state.items}
            isLoadingMore={state.isLoadingMore}
            hasMore={state.hasMore}
            loadMoreError={state.loadMoreError}
            onLoadMore={loadMore}
            onRetry={retry}
          />
        ) : null}
      </div>
    </main>
  )
}
