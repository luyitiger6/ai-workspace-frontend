import { formatCount } from '@/lib/home/format'
import styles from './post-card-stats.module.css'

export interface PostCardStatsProps {
  upVoteCount: number
  commentCount: number
  bookmarkCount: number
}

function UpVoteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function PostCardStats({ upVoteCount, commentCount, bookmarkCount }: PostCardStatsProps) {
  return (
    <div className={styles.stats} aria-label="Post interactions">
      <span className={styles.item} aria-label={`${formatCount(upVoteCount)} upvotes`}>
        <UpVoteIcon />
        <span className={styles.value}>{formatCount(upVoteCount)}</span>
      </span>
      <span className={styles.item} aria-label={`${formatCount(commentCount)} comments`}>
        <CommentIcon />
        <span className={styles.value}>{formatCount(commentCount)}</span>
      </span>
      <span className={styles.item} aria-label={`${formatCount(bookmarkCount)} bookmarks`}>
        <BookmarkIcon />
        <span className={styles.value}>{formatCount(bookmarkCount)}</span>
      </span>
    </div>
  )
}
