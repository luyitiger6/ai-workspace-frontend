'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { commentValidationError, normalizeCommentContent } from '@/lib/posts/comment-input'
import type { CommentDraft } from './use-post-detail'
import styles from './comment-composer.module.css'

interface CommentComposerProps {
  draft: CommentDraft
  disabled: boolean
  busy: boolean
  error: string | null
  onChange: (content: string) => void
  onCancelReply: () => void
  onSubmit: () => Promise<'success' | 'failed' | 'ignored'>
}

export function CommentComposer({ draft, disabled, busy, error, onChange, onCancelReply, onSubmit }: CommentComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [attempted, setAttempted] = useState(false)
  const length = normalizeCommentContent(draft.content).length
  const validation = !busy && (attempted || length > 2000) ? commentValidationError(draft.content) : null
  const message = validation ?? error
  const replyId = draft.replyTo?.publicId
  const previousReplyRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (replyId && replyId !== previousReplyRef.current && !disabled) inputRef.current?.focus()
    previousReplyRef.current = replyId
  }, [replyId, disabled])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disabled || busy || draft.locked) return
    setAttempted(true)
    if (commentValidationError(draft.content)) {
      inputRef.current?.focus()
      return
    }
    const result = await onSubmit()
    if (result === 'success') setAttempted(false)
  }

  return (
    <form className={styles.form} onSubmit={event => void submit(event)} aria-busy={busy}>
      {draft.replyTo ? (
        <div className={styles.reply}>
          <p>Replying to comment ID: {draft.replyTo.publicId}</p>
          <p className={styles.preview}>{draft.replyTo.content}</p>
          <button type="button" className="wc-button wc-button--ghost" disabled={disabled || busy || draft.locked} onClick={() => { onCancelReply(); inputRef.current?.focus() }}>Cancel reply</button>
        </div>
      ) : null}
      <label className={styles.label} htmlFor="comment-content">{draft.replyTo ? 'Your reply' : 'Your comment'}</label>
      <textarea
        ref={inputRef} id="comment-content" name="content" rows={5} value={draft.content}
        disabled={disabled || busy || draft.locked} onChange={event => { onChange(event.target.value); setAttempted(false) }}
        aria-invalid={message ? true : undefined}
        aria-describedby={`comment-help${message ? ' comment-error' : ''}${draft.locked ? ' comment-locked' : ''}`}
        className={styles.input}
      />
      <div className={styles.meta} id="comment-help">
        <p>Plain text. Up to 2000 UTF-16 code units after trimming.</p>
        <p>{length}/2000</p>
      </div>
      {draft.locked ? <p id="comment-locked" className={styles.error} role="status">This draft belongs to your previous session. Confirm the same account to unlock it; it will not be submitted automatically.</p> : null}
      {message ? <p id="comment-error" className={styles.error} role="alert">{message}</p> : null}
      <button type="submit" className="wc-button wc-button--primary" disabled={disabled || busy || draft.locked}>{busy ? 'Please wait…' : draft.replyTo ? 'Post reply' : 'Post comment'}</button>
    </form>
  )
}
