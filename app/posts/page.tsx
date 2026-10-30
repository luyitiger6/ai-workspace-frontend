'use client'

import { Suspense } from 'react'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { PostsContent } from './posts-content'
import styles from './page.module.css'

function PostsFallback() {
  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <div className={styles.head}>
          <div>
            <p className="wc-eyebrow">Community</p>
            <h1 className={styles.title}>All posts</h1>
          </div>
        </div>
        <div className={styles.loading} role="status">
          <p>Loading posts…</p>
        </div>
      </div>
    </main>
  )
}

export default function PostsPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />

      <Suspense fallback={<PostsFallback />}>
        <PostsContent />
      </Suspense>

      <SiteFooter />
    </div>
  )
}
