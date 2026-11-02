'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { PostEditor } from '@/components/posts/post-editor'
import { authHref } from '@/lib/auth/return-to'
import type { PostCreateRequest } from '@/lib/contracts/posts'
import { describePostsError, PostsApiError, postsApi } from '@/lib/posts/posts-api'
import styles from '../editor-page.module.css'

/** 新建页两种状态各自的按钮文案；提交成功与否由服务端返回决定。 */
const LABELS = { published: 'Publish post', draft: 'Save draft' }

export function NewPostView() {
  const auth = useAuth()
  const router = useRouter()
  const [sessionExpired, setSessionExpired] = useState(false)

  const submit = async (request: PostCreateRequest): Promise<string | null> => {
    try {
      const created = await postsApi.create(request)
      router.push(`/posts/${created.publicId}`)
      router.refresh()
      return null
    } catch (cause) {
      setSessionExpired(cause instanceof PostsApiError && cause.status === 401)
      return describePostsError(cause)
    }
  }

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <Link href="/posts" className={styles.back}>← Back to all posts</Link>
        <div className={styles.head}>
          <p className="wc-eyebrow">Community</p>
          <h1 className={styles.title}>Write a post</h1>
        </div>

        {auth.status === 'loading' ? <p className={styles.notice} role="status">Checking your session…</p> : null}

        {auth.status === 'guest' ? (
          <aside className={styles.notice}>
            <h2>Log in to write</h2>
            <p>Writing a post needs an account. Nothing is submitted from this page until you are signed in.</p>
            <div className={styles.links}>
              <Link className="wc-button wc-button--primary" href={authHref('login')}>Log in</Link>
              <Link className="wc-button wc-button--ghost" href={authHref('register')}>Create account</Link>
            </div>
            <p className={styles.note}>After logging in, open Write a post again — this page will not return you here automatically.</p>
          </aside>
        ) : null}

        {auth.status === 'user' ? (
          <>
            <PostEditor labels={LABELS} onSubmit={submit} />
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
