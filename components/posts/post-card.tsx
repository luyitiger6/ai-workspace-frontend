import { formatDate } from '@/lib/home/format'
import type { Post } from '@/lib/home/types'
import { PostCardStats } from './post-card-stats'
import styles from './post-card.module.css'

export interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className={styles.card} data-testid="post-card">
      <div className={styles.cover}>
        <img src={post.coverUrl} alt="" loading="lazy" width="600" height="400" />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{post.titleEn}</h3>
        <p className={styles.summary}>{post.summaryEn}</p>
        <p className={styles.meta}>
          {post.authorEn} · {formatDate(post.publishedAt)}
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
