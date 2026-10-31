'use client'

import Link from 'next/link'
import { useState } from 'react'
import { authHref } from '@/lib/auth/return-to'
import { formatDate } from '@/lib/home/format'
import type { PostSortBy } from '@/lib/posts/types'
import { CommentComposer } from './comment-composer'
import { PostComments } from './post-comments'
import { PostCardStats } from './post-card-stats'
import { PostInteractionBar } from './post-interaction-bar'
import { usePostDetail } from './use-post-detail'
import styles from './post-detail.module.css'

export function PostDetail({ publicId, sortBy }: { publicId: string; sortBy?: PostSortBy }) {
  const detail = usePostDetail(publicId)
  const { auth, view } = detail
  const [failedCover, setFailedCover] = useState<string | null>(null)
  const [loginRequested, setLoginRequested] = useState(false)
  const post = view.detail.data
  const backHref = sortBy ? `/posts?${new URLSearchParams({ sortBy })}` : '/posts'
  const next = `/posts/${publicId}`
  const loading = auth.status === 'loading' || view.detail.status === 'idle' || view.detail.status === 'loading' && !post
  const showLogin = loginRequested && auth.status === 'guest' || view.sessionExpired
  const requestLogin = () => {
    setLoginRequested(true)
    requestAnimationFrame(() => {
      const guide = document.getElementById('post-login-guide')
      guide?.focus()
      guide?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
  }
  const readOnly = post?.status === 'draft'
  const focusComments = () => {
    const target = document.getElementById('comment-content') ?? document.getElementById('post-comments')
    target?.focus()
    target?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <Link href={backHref} className={styles.back}>← Back to all posts</Link>
        {loading ? <div className={styles.notice} role="status" aria-busy="true">Loading post…</div> : null}
        {!loading && view.detail.status === 'not-found' ? (
          <div className={styles.notice}>
            <h1>Post not found</h1>
            <p>This post is not available.</p>
            {view.sessionExpired ? <button type="button" className="wc-button wc-button--ghost" onClick={() => void detail.recheckSession()}>Recheck session</button> : null}
          </div>
        ) : null}
        {!loading && view.detail.status === 'error' && !post ? (
          <div className={styles.notice} role="alert">
            <h1>Post could not load</h1>
            <p>{view.detail.error}</p>
            <button type="button" className="wc-button wc-button--primary" onClick={() => void detail.retryDetail()}>Retry reading post</button>
          </div>
        ) : null}
        {!loading && post ? (
          <article className={styles.post} aria-busy={view.busy}>
            <header className={styles.head}>
              <p className="wc-eyebrow">Community · Post</p>
              <h1 className={styles.title}>{post.title}</h1>
              {readOnly ? <p className={styles.draft} role="status">Draft — only you can read this post. Interactions are unavailable.</p> : null}
              {post.tags.length > 0 ? (
                <ul className={styles.tags} aria-label="Post tags">
                  {post.tags.map((tag, index) => <li key={`${index}-${tag}`}>{tag}</li>)}
                </ul>
              ) : null}
              <details className={styles.author}>
                <summary>Author ID: {post.authorPublicId.slice(0, 6)}…{post.authorPublicId.slice(-4)}</summary>
                <p>{post.authorPublicId}</p>
              </details>
              <p className={styles.meta}>Created <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></p>
            </header>
            <div className={styles.cover}>
              {post.coverImage && failedCover !== post.coverImage ? (
                <img src={post.coverImage} alt="" onError={() => setFailedCover(post.coverImage)} />
              ) : <p className={styles.coverPlaceholder}>No cover image</p>}
            </div>
            <div className={styles.content}>{post.content}</div>
            <div className={styles.statistics}>
              <PostCardStats upVoteCount={post.upVoteCount} commentCount={post.commentCount} bookmarkCount={post.bookmarkCount} />
              {view.detail.stale ? <p className={styles.meta} role="status">Statistics pending refresh.</p> : null}
              {view.detail.status === 'error' ? <p role="alert">{view.detail.error}</p> : null}
              {view.detail.stale ? <button type="button" className="wc-button wc-button--ghost" disabled={view.busy} onClick={() => void detail.retryDetail()}>Refresh server data</button> : null}
            </div>
            {!readOnly ? (
              <PostInteractionBar
                authStatus={auth.status} personal={view.personal} busy={view.busy} disabled={view.detail.stale || view.needsReview}
                sessionExpired={view.sessionExpired} onVote={direction => void detail.toggleVote(direction)}
                onBookmark={() => void detail.toggleBookmark()} onComment={focusComments}
                onLogin={requestLogin} onRetry={detail.retryPersonal}
              />
            ) : null}
            {view.mutation.message ? (
              <div className={styles.notice} role={view.mutation.status === 'error' || view.mutation.status === 'uncertain' ? 'alert' : 'status'}>
                <p>{view.mutation.message}</p>
                {view.mutation.status === 'error' || view.mutation.status === 'uncertain' ? (
                  <button type="button" className="wc-button wc-button--ghost" disabled={view.busy} onClick={() => void detail.retryDetail()}>Check server data</button>
                ) : null}
              </div>
            ) : null}
            {showLogin && !readOnly ? (
              <aside id="post-login-guide" tabIndex={-1} className={styles.login} role="status">
                <p>Log in to continue. Your previous action will not be submitted automatically.</p>
                <div className={styles.links}>
                  <Link className="wc-button wc-button--primary" href={authHref('login', next)}>Log in</Link>
                  <Link className="wc-button wc-button--ghost" href={authHref('register', next)}>Create account</Link>
                  {view.sessionExpired ? <button type="button" className="wc-button wc-button--ghost" disabled={auth.status === 'loading' || view.busy} onClick={() => void detail.recheckSession()}>Recheck session</button> : null}
                </div>
              </aside>
            ) : null}
            <PostComments
              key={view.key} state={view.comments} authStatus={auth.status}
              accountPublicId={auth.status === 'user' ? auth.user?.publicId ?? null : null}
              busy={view.busy} loadingMore={view.loadingMore} readOnly={readOnly} disabled={view.detail.stale || view.needsReview}
              sessionExpired={view.sessionExpired} onLoadMore={detail.loadMoreComments} onRetry={detail.retryComments}
              onReload={detail.reloadComments} onReply={comment => { detail.chooseReply(comment); focusComments() }}
              onLogin={requestLogin} onDelete={detail.deleteComment}
            >
              {!readOnly && (auth.status === 'user' || detail.draft.locked) ? (
                <CommentComposer
                  draft={detail.draft} disabled={auth.status !== 'user' || view.sessionExpired || view.detail.stale || view.needsReview}
                  busy={view.busy} error={view.mutationKind === 'comment' && (view.mutation.status === 'error' || view.mutation.status === 'uncertain') ? view.mutation.message : null}
                  onChange={detail.editContent} onCancelReply={() => detail.chooseReply(null)} onSubmit={detail.submitComment}
                />
              ) : null}
              {!readOnly && auth.status === 'guest' ? <button type="button" className="wc-button wc-button--ghost" onClick={requestLogin}>Log in to comment</button> : null}
            </PostComments>
          </article>
        ) : null}
      </div>
    </main>
  )
}
