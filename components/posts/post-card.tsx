'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatDate } from '@/lib/home/format'
import type { PostSortBy, PostSummary } from '@/lib/posts/types'
import { PostCardStats } from './post-card-stats'
import styles from './post-card.module.css'

export interface PostCardProps {
  post: PostSummary
  sortBy?: PostSortBy
}

export function PostCard({ post, sortBy }: PostCardProps) {
  const [failedCover, setFailedCover] = useState<string | null>(null)
  const href = `/posts/${post.publicId}${sortBy ? `?${new URLSearchParams({ sortBy })}` : ''}`
  return (
    <article className={styles.card} data-testid="post-card">
      <div className={styles.cover}>
        {post.coverImage && failedCover !== post.coverImage ? (
          <img src={post.coverImage} alt="" loading="lazy" onError={() => setFailedCover(post.coverImage)} />
        ) : <p className={styles.coverPlaceholder}>No cover image</p>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}><Link href={href}>{post.title}</Link></h3>
        {post.tags.length > 0 ? (
          <ul className={styles.tags} aria-label="Post tags">
            {post.tags.map((tag, index) => <li key={`${index}-${tag}`}>{tag}</li>)}
          </ul>
        ) : null}
        <details className={styles.author}>
          <summary>Author ID: {post.authorPublicId.slice(0, 6)}…{post.authorPublicId.slice(-4)}</summary>
          <p>{post.authorPublicId}</p>
        </details>
        <p className={styles.meta}>
          Created <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        </p>
        <PostCardStats
          upVoteCount={post.upVoteCount}
          commentCount={post.commentCount}
          bookmarkCount={post.bookmarkCount}
        />
      </div>
    </article>
  )
}
