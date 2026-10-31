'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthStatus } from '@/components/auth/auth-provider'
import type { CommentResponse } from '@/lib/contracts/posts'
import { formatDate } from '@/lib/home/format'
import type { CommentsData, ReadState } from './use-post-detail'
import styles from './post-comments.module.css'

interface PostCommentsProps {
  state: ReadState<CommentsData>
  authStatus: AuthStatus
  accountPublicId: string | null
  busy: boolean
  loadingMore: boolean
  readOnly: boolean
  disabled: boolean
  sessionExpired: boolean
  onLoadMore: () => void
  onRetry: () => void
  onReload: () => void
  onReply: (comment: CommentResponse) => void
  onLogin: () => void
  onDelete: (comment: CommentResponse) => Promise<'success' | 'failed' | 'ignored'>
  children?: ReactNode
}

export function PostComments(props: PostCommentsProps) {
  const { state, authStatus, accountPublicId, busy, loadingMore, readOnly, disabled, sessionExpired, onLoadMore, onRetry, onReload, onReply, onLogin, onDelete, children } = props
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const deletingRef = useRef(false)
  const items = state.data?.items ?? []
  const byId = new Map(items.map(item => [item.publicId, item]))
  const writesLocked = disabled || busy || authStatus === 'loading' || sessionExpired && authStatus !== 'guest'

  useEffect(() => { if (confirmId) cancelRef.current?.focus() }, [confirmId])
  const restoreFocus = () => requestAnimationFrame(() => {
    if (openerRef.current?.isConnected && !openerRef.current.disabled) openerRef.current.focus()
    else sectionRef.current?.focus()
  })
  const cancelDelete = () => {
    if (deletingRef.current) return
    setConfirmId(null)
    restoreFocus()
  }
  const confirmDelete = async (comment: CommentResponse) => {
    if (deletingRef.current || writesLocked) return
    deletingRef.current = true
    try {
      const result = await onDelete(comment)
      if (!sectionRef.current) return
      setConfirmId(null)
      if (result === 'success') requestAnimationFrame(() => sectionRef.current?.focus())
      else restoreFocus()
    } finally { deletingRef.current = false }
  }

  return (
    <section ref={sectionRef} id="post-comments" tabIndex={-1} className={styles.section} aria-labelledby="post-comments-title" aria-busy={state.status === 'loading'}>
      <h2 id="post-comments-title">Comments</h2>
      {children}
      {state.status === 'idle' || state.status === 'loading' && !state.data ? <p role="status">Loading comments…</p> : null}
      {state.status === 'ready' && items.length === 0 && state.data?.nextCursor === null ? <p className={styles.note}>No comments yet.</p> : null}
      {state.stale ? <p className={styles.note} role="status">Comments pending refresh.</p> : null}
      {state.status === 'error' ? (
        <div className={styles.error} role="alert">
          <p>{state.error}</p>
          <div className={styles.actions}>
            <button type="button" className="wc-button wc-button--ghost" disabled={busy} onClick={onRetry}>Retry reading comments</button>
            <button type="button" className="wc-button wc-button--ghost" disabled={busy} onClick={onReload}>Reload first page</button>
          </div>
        </div>
      ) : null}
      <ol className={styles.list}>
        {items.map(comment => {
          const parent = comment.parentPublicId ? byId.get(comment.parentPublicId) : undefined
          const own = authStatus === 'user' && accountPublicId === comment.authorPublicId
          const confirming = confirmId === comment.publicId
          return (
            <li key={comment.publicId} id={`comment-${comment.publicId}`} tabIndex={-1} className={`${styles.comment}${comment.parentPublicId ? ` ${styles.reply}` : ''}`}>
              <details className={styles.author}>
                <summary>Author ID: {comment.authorPublicId.slice(0, 6)}…{comment.authorPublicId.slice(-4)}</summary>
                <p>{comment.authorPublicId}</p>
              </details>
              <p className={styles.note}>Created <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time></p>
              {comment.parentPublicId ? (
                <div className={styles.context}>
                  <p>In reply to comment ID: {comment.parentPublicId}</p>
                  {parent ? (
                    <>
                      <p className={styles.preview}>{parent.content}</p>
                      <a href={`#comment-${parent.publicId}`} className={styles.parentLink} onClick={() => document.getElementById(`comment-${parent.publicId}`)?.focus()}>Go to parent comment</a>
                    </>
                  ) : <p>Parent context is unavailable. It may not be loaded or may no longer be available.</p>}
                </div>
              ) : null}
              <p className={styles.content}>{comment.content}</p>
              {!readOnly ? (
                <div className={styles.actions}>
                  {comment.parentPublicId === null ? <button type="button" className="wc-button wc-button--ghost" disabled={writesLocked} onClick={() => authStatus === 'guest' ? onLogin() : onReply(comment)}>Reply</button> : null}
                  {own ? <button type="button" className={`wc-button wc-button--ghost ${styles.delete}`} disabled={writesLocked} onClick={event => { openerRef.current = event.currentTarget; setConfirmId(comment.publicId) }}>Delete</button> : null}
                </div>
              ) : null}
              {confirming && !readOnly && own ? (
                <div className={styles.confirm} role="group" aria-labelledby={`delete-prompt-${comment.publicId}`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancelDelete() } }}>
                  <p id={`delete-prompt-${comment.publicId}`}>Delete this comment? Its replies will remain.</p>
                  <div className={styles.actions}>
                    <button type="button" className={`wc-button wc-button--ghost ${styles.delete}`} disabled={writesLocked} onClick={() => void confirmDelete(comment)}>Confirm delete</button>
                    <button ref={cancelRef} type="button" className="wc-button wc-button--ghost" disabled={busy} onClick={cancelDelete}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      {loadingMore ? <p role="status">Loading more comments…</p> : null}
      {state.data?.nextCursor !== null && state.data ? (
        <button type="button" className="wc-button wc-button--ghost" disabled={busy || state.status === 'loading' || state.status === 'error'} onClick={onLoadMore}>Load more comments</button>
      ) : null}
      {state.status === 'ready' && state.data?.nextCursor === null && items.length > 0 ? <p className={styles.note}>You have reached the end of the comments.</p> : null}
    </section>
  )
}
