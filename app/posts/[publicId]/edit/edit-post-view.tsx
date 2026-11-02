'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { PostEditor } from '@/components/posts/post-editor'
import { authHref } from '@/lib/auth/return-to'
import type { PostCreateRequest } from '@/lib/contracts/posts'
import { isPostAuthor } from '@/lib/posts/post-author'
import { describePostsError, PostsApiError, postsApi } from '@/lib/posts/posts-api'
import type { PostDetail } from '@/lib/posts/types'
import styles from '../../editor-page.module.css'

interface EditorState {
  status: 'loading' | 'ready' | 'not-found' | 'error'
  post: PostDetail | null
  error: string | null
}

/** 两态同一句：编辑页不区分发布与草稿，保存就是保存。 */
const LABELS = { published: 'Save changes', draft: 'Save changes' }

export function EditPostView({ publicId }: { publicId: string }) {
  const auth = useAuth()
  const router = useRouter()
  const [state, setState] = useState<EditorState>({ status: 'loading', post: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', post: null, error: null })
    void postsApi.detail(publicId, controller.signal).then(
      post => {
        if (!controller.signal.aborted) setState({ status: 'ready', post, error: null })
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return
        const notFound = cause instanceof PostsApiError && cause.status === 404
        setState({
          status: notFound ? 'not-found' : 'error',
          post: null,
          error: notFound ? null : describePostsError(cause),
        })
      },
    )
    return () => controller.abort()
  }, [publicId, reloadKey])

  const save = async (request: PostCreateRequest): Promise<string | null> => {
    try {
      await postsApi.update(publicId, request)
      router.push(`/posts/${publicId}`)
      router.refresh()
      return null
    } catch (cause) {
      setSessionExpired(cause instanceof PostsApiError && cause.status === 401)
      return describePostsError(cause)
    }
  }

  const post = state.post
  const loading = auth.status === 'loading' || state.status === 'loading'
  const authorView = post !== null && auth.status === 'user' && isPostAuthor(post.authorPublicId, auth.user?.publicId ?? null)

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <Link href={`/posts/${publicId}`} className={styles.back}>← Back to the post</Link>
        <div className={styles.head}>
          <p className="wc-eyebrow">Community</p>
          <h1 className={styles.title}>Edit post</h1>
        </div>

        {loading ? <p className={styles.notice} role="status">Loading post…</p> : null}

        {!loading && state.status === 'not-found' ? (
          <div className={styles.notice}>
            <h2>Post not found</h2>
            <p>This post is no longer available. It may have been deleted.</p>
            <div className={styles.links}>
              <Link className="wc-button wc-button--primary" href="/posts">Back to all posts</Link>
            </div>
          </div>
        ) : null}

        {!loading && state.status === 'error' ? (
          <div className={styles.notice} role="alert">
            <h2>Post could not load</h2>
            <p>{state.error}</p>
            <div className={styles.links}>
              <button type="button" className="wc-button wc-button--ghost" onClick={() => setReloadKey(value => value + 1)}>Retry reading post</button>
              <Link className="wc-button wc-button--ghost" href={`/posts/${publicId}`}>Back to the post</Link>
            </div>
          </div>
        ) : null}

        {!loading && state.status === 'ready' && auth.status === 'guest' ? (
          <aside className={styles.notice}>
            <h2>Log in to edit</h2>
            <p>Only the author can change this post. Log in with the account that published it.</p>
            <div className={styles.links}>
              <Link className="wc-button wc-button--primary" href={authHref('login')}>Log in</Link>
              <Link className="wc-button wc-button--ghost" href={`/posts/${publicId}`}>Back to the post</Link>
            </div>
          </aside>
        ) : null}

        {!loading && state.status === 'ready' && auth.status === 'user' && !authorView ? (
          <div className={styles.notice}>
            <h2>You can only edit your own post</h2>
            <p>This post belongs to another account, so the editor stays closed.</p>
            <div className={styles.links}>
              <Link className="wc-button wc-button--primary" href={`/posts/${publicId}`}>Back to the post</Link>
            </div>
          </div>
        ) : null}

        {!loading && state.status === 'ready' && authorView && post ? (
          <>
            <PostEditor
              initial={{
                title: post.title,
                content: post.content,
                coverImage: post.coverImage,
                tags: post.tags.join(', '),
                status: post.status,
              }}
              labels={LABELS}
              onSubmit={save}
            />
            {sessionExpired ? (
              <p className={styles.note} role="status">
                Your session has expired. <Link href={authHref('login')}>Log in again</Link> — the text you typed stays here until you leave this page.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}
