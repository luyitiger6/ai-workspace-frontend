'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { PostList } from '@/components/posts/post-list'
import { SortTabs } from '@/components/posts/sort-tabs'
import { useAuthorCards } from '@/components/posts/use-author-cards'
import { useInfinitePosts } from '@/components/posts/use-infinite-posts'
import { postsApi } from '@/lib/posts/posts-api'
import type { PostSortBy } from '@/lib/posts/types'
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
  const auth = useAuth()
  const sortBy = parseSortBy(searchParams.get('sortBy'))

  const { state, loadMore, retry } = useInfinitePosts({ sortBy, load: postsApi.feed })
  const authorIds = state.status === 'ready' ? state.items.map((post) => post.authorPublicId) : []
  const authorCards = useAuthorCards(authorIds)

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <div className={styles.head}>
          <div>
            <p className="wc-eyebrow">Community</p>
            <h1 className={styles.title}>All posts</h1>
          </div>
          <div className={styles.headActions}>
            <div className={styles.writeEntry}>
              <Link href="/posts/new" className="wc-button wc-button--primary">Write a post</Link>
              {auth.status === 'guest' ? <p className={styles.note}>Log in first to publish.</p> : null}
            </div>
            <SortTabs active={sortBy} />
          </div>
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
            sortBy={sortBy}
            authorCards={authorCards}
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
