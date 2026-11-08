'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatDate } from '@/lib/home/format'
import { firstCharacter } from '@/lib/profile/profile-input'
import type { AuthorCardEntry } from '@/lib/profile/types'
import type { PostSortBy, PostSummary } from '@/lib/posts/types'
import { PostCardStats } from './post-card-stats'
import styles from './post-card.module.css'

export interface PostCardProps {
  post: PostSummary
  sortBy?: PostSortBy
  authorCard?: AuthorCardEntry
}

function PersonGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5Z"
      />
    </svg>
  )
}

function AuthorArea({ entry }: { entry?: AuthorCardEntry }) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)

  if (!entry || entry.status === 'pending') {
    return (
      <div className={styles.author} aria-hidden="true">
        <span className={styles.authorAvatar} />
        <span className={styles.authorBar} />
      </div>
    )
  }

  if (entry.status === 'ready' && entry.card) {
    const { card } = entry
    const showImage = card.avatarUrl !== '' && failedAvatarUrl !== card.avatarUrl
    return (
      <div className={styles.author}>
        {showImage ? (
          <img
            className={styles.authorAvatar}
            src={card.avatarUrl}
            alt=""
            loading="lazy"
            onError={() => setFailedAvatarUrl(card.avatarUrl)}
          />
        ) : (
          <span className={styles.authorInitial} aria-hidden="true">
            {firstCharacter(card.displayName)}
          </span>
        )}
        <span className={styles.authorName}>{card.displayName}</span>
      </div>
    )
  }

  return (
    <div className={styles.author}>
      <PersonGlyph className={styles.authorGlyph} />
      <span className={styles.authorUnavailable}>Author unavailable</span>
    </div>
  )
}

export function PostCard({ post, sortBy, authorCard }: PostCardProps) {
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
        <AuthorArea entry={authorCard} />
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
