'use client'

import type { PostInteractionStateResponse } from '@/lib/contracts/posts'
import type { AuthStatus } from '@/components/auth/auth-provider'
import type { ReadState } from './use-post-detail'
import styles from './post-interaction-bar.module.css'

interface PostInteractionBarProps {
  authStatus: AuthStatus
  personal: ReadState<PostInteractionStateResponse>
  busy: boolean
  disabled: boolean
  sessionExpired: boolean
  onVote: (direction: 'up' | 'down') => void
  onBookmark: () => void
  onComment: () => void
  onLogin: () => void
  onRetry: () => void
}

function ActionIcon({ kind }: { kind: 'up' | 'down' | 'bookmark' | 'comment' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'up' ? <path d="M12 19V5m-7 7 7-7 7 7" /> : null}
      {kind === 'down' ? <path d="M12 5v14m-7-7 7 7 7-7" /> : null}
      {kind === 'bookmark' ? <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /> : null}
      {kind === 'comment' ? <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" /> : null}
    </svg>
  )
}

/** 未知态不输出 aria-pressed=false，以免冒充服务端确认的“未互动”。 */
export function PostInteractionBar(props: PostInteractionBarProps) {
  const { authStatus, personal, busy, disabled, sessionExpired, onVote, onBookmark, onComment, onLogin, onRetry } = props
  const guest = authStatus === 'guest'
  const known = authStatus === 'user' && personal.status === 'ready' && personal.data !== null && !sessionExpired
  const locked = disabled || busy || authStatus === 'loading'
  const toggleLocked = locked || (!guest && !known)
  const chooseVote = (direction: 'up' | 'down') => guest ? onLogin() : onVote(direction)
  return (
    <section className={styles.bar} aria-label="Post interactions" aria-busy={busy}>
      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={toggleLocked} aria-pressed={known ? personal.data?.voteDirection === 'up' : undefined} onClick={() => chooseVote('up')}>
          <ActionIcon kind="up" /> Upvote
        </button>
        <button type="button" className={styles.action} disabled={toggleLocked} aria-pressed={known ? personal.data?.voteDirection === 'down' : undefined} onClick={() => chooseVote('down')}>
          <ActionIcon kind="down" /> Downvote
        </button>
        <button type="button" className={styles.action} disabled={toggleLocked} aria-pressed={known ? personal.data?.bookmarked : undefined} onClick={() => guest ? onLogin() : onBookmark()}>
          <ActionIcon kind="bookmark" /> Bookmark
        </button>
        <button type="button" className={styles.action} disabled={locked || sessionExpired && !guest} onClick={() => guest ? onLogin() : onComment()}>
          <ActionIcon kind="comment" /> Comment
        </button>
      </div>
      {personal.status === 'loading' ? <p className={styles.note} role="status">Loading your interaction state…</p> : null}
      {personal.status === 'error' ? (
        <div className={styles.error} role="alert">
          <p>{personal.error} Your vote and bookmark state is unknown.</p>
          <button type="button" className="wc-button wc-button--ghost" disabled={locked} onClick={onRetry}>Retry reading my state</button>
        </div>
      ) : null}
      {authStatus === 'user' && personal.status === 'idle' ? (
        <button type="button" className="wc-button wc-button--ghost" disabled={locked} onClick={onRetry}>Read my interaction state</button>
      ) : null}
      {guest ? <p className={styles.note}>Log in to vote, bookmark, or join the conversation.</p> : null}
    </section>
  )
}
