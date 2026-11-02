'use client'

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import type { PostCreateRequest, PostStatus } from '@/lib/contracts/posts'
import {
  POST_INPUT_LIMITS,
  codePointLength,
  reviewPostInput,
  splitTags,
  stripWhitespace,
  utf8ByteLength,
  type PostDraftInput,
  type PostInputField,
} from '@/lib/posts/post-input'
import styles from './post-editor.module.css'

/** 两种状态各自的提交按钮文案：新建页区分发布与存草稿，编辑页两态同一句。 */
export interface PostEditorLabels {
  published: string
  draft: string
}

interface PostEditorProps {
  initial?: Partial<PostDraftInput>
  labels: PostEditorLabels
  /** 返回 null 表示已成功（由调用方负责跳转），返回字符串表示要展示的失败原因。 */
  onSubmit: (request: PostCreateRequest) => Promise<string | null>
}

const EMPTY: PostDraftInput = { title: '', content: '', coverImage: '', tags: '', status: 'published' }

/**
 * 写帖与改帖共用的表单。
 *
 * 本地校验只负责拦下明显发不出去的内容并给出即时提示；接受与否由服务端决定，
 * 所以提交失败后一律保留已填内容，不做任何自动重放。
 */
export function PostEditor({ initial, labels, onSubmit }: PostEditorProps) {
  const baseId = useId()
  const [values, setValues] = useState<PostDraftInput>({ ...EMPTY, ...initial })
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const tagsRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const review = useMemo(() => reviewPostInput(values), [values])
  const tags = splitTags(values.tags)
  const titleChars = codePointLength(stripWhitespace(values.title))
  const contentBytes = utf8ByteLength(values.content)

  const change = (patch: Partial<PostDraftInput>) => {
    setValues(current => ({ ...current, ...patch }))
    setFailure(null)
    setAttempted(false)
  }

  /** 标签与封面越界要「即时提示」，标题与正文等提交后再提示，避免边打字边报错。 */
  const issueFor = (field: PostInputField): string | null => {
    const message = review.byField[field]
    if (!message) return null
    return attempted || field === 'tags' || field === 'coverImage' ? message : null
  }

  const describedBy = (field: PostInputField) => {
    const help = `${baseId}-${field}-help`
    return issueFor(field) ? `${help} ${baseId}-${field}-error` : help
  }

  const focusField = (field: PostInputField) => {
    if (field === 'title') titleRef.current?.focus()
    else if (field === 'content') contentRef.current?.focus()
    else if (field === 'tags') tagsRef.current?.focus()
    else coverRef.current?.focus()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setAttempted(true)
    setFailure(null)
    const blocker = review.issues[0]
    if (blocker) {
      focusField(blocker.field)
      return
    }
    setSubmitting(true)
    const message = await onSubmit(review.request)
    if (message !== null) {
      setSubmitting(false)
      setFailure(message)
    }
  }

  return (
    <form className={styles.form} onSubmit={event => void submit(event)} aria-busy={submitting} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${baseId}-title`}>Title</label>
        <input
          ref={titleRef} id={`${baseId}-title`} name="title" type="text" className={styles.input}
          value={values.title} disabled={submitting} maxLength={POST_INPUT_LIMITS.titleChars * 2}
          aria-invalid={issueFor('title') ? true : undefined} aria-describedby={describedBy('title')}
          onChange={event => change({ title: event.target.value })}
        />
        <p id={`${baseId}-title-help`} className={styles.meta}>{titleChars}/{POST_INPUT_LIMITS.titleChars} characters</p>
        {issueFor('title') ? <p id={`${baseId}-title-error`} className={styles.error} role="alert">{issueFor('title')}</p> : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${baseId}-content`}>Body</label>
        <textarea
          ref={contentRef} id={`${baseId}-content`} name="content" rows={12} className={styles.textarea}
          value={values.content} disabled={submitting}
          aria-invalid={issueFor('content') ? true : undefined} aria-describedby={describedBy('content')}
          onChange={event => change({ content: event.target.value })}
        />
        <p id={`${baseId}-content-help`} className={styles.meta}>Plain text. {contentBytes}/{POST_INPUT_LIMITS.contentBytes} UTF-8 bytes</p>
        {issueFor('content') ? <p id={`${baseId}-content-error`} className={styles.error} role="alert">{issueFor('content')}</p> : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${baseId}-tags`}>Tags</label>
        <input
          ref={tagsRef} id={`${baseId}-tags`} name="tags" type="text" className={styles.input}
          value={values.tags} disabled={submitting}
          aria-invalid={issueFor('tags') ? true : undefined} aria-describedby={describedBy('tags')}
          onChange={event => change({ tags: event.target.value })}
        />
        <p id={`${baseId}-tags-help`} className={styles.meta}>
          Separate tags with commas or new lines. Up to {POST_INPUT_LIMITS.tagCount} tags, {POST_INPUT_LIMITS.tagChars} characters each. {tags.length}/{POST_INPUT_LIMITS.tagCount} used.
        </p>
        {issueFor('tags') ? <p id={`${baseId}-tags-error`} className={styles.error} role="alert">{issueFor('tags')}</p> : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${baseId}-coverImage`}>Cover image address</label>
        <input
          ref={coverRef} id={`${baseId}-coverImage`} name="coverImage" type="url" className={styles.input}
          value={values.coverImage} disabled={submitting} placeholder="https://…"
          aria-invalid={issueFor('coverImage') ? true : undefined} aria-describedby={describedBy('coverImage')}
          onChange={event => change({ coverImage: event.target.value })}
        />
        <p id={`${baseId}-coverImage-help`} className={styles.meta}>Optional. Full http:// or https:// address; images are not uploaded here.</p>
        {issueFor('coverImage') ? <p id={`${baseId}-coverImage-error`} className={styles.error} role="alert">{issueFor('coverImage')}</p> : null}
      </div>

      <fieldset className={styles.status} disabled={submitting}>
        <legend className={styles.label}>Visibility</legend>
        {([
          ['published', 'Published', 'Visible in All posts, open to votes and comments.'],
          ['draft', 'Draft', 'Only you can see this draft.'],
        ] as const).map(([status, label, hint]) => (
          <div key={status} className={styles.option}>
            <input
              id={`${baseId}-status-${status}`} name={`${baseId}-status`} type="radio" value={status}
              checked={values.status === status} onChange={() => change({ status: status as PostStatus })}
            />
            <label htmlFor={`${baseId}-status-${status}`}>
              {label}<span className={styles.hint}>{hint}</span>
            </label>
          </div>
        ))}
      </fieldset>

      {failure ? <p className={styles.error} role="alert">{failure}</p> : null}

      <div className={styles.actions}>
        <button type="submit" className="wc-button wc-button--primary" disabled={submitting}>
          {submitting ? 'Saving…' : labels[values.status]}
        </button>
      </div>
    </form>
  )
}
