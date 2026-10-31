import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'
import styles from '../auth.module.css'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to continue to your next route.',
}

export default function LoginPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brand}>
          <Link className={styles.logo} href="/">
            wanderchain
          </Link>
          <p className={styles.quote}>Every trip, written as a route a person can follow.</p>
          <p className={styles.quoteNote}>Log in to save routes and publish posts.</p>
        </aside>
        <div className={styles.panel}>
          <Suspense fallback={<p role="status">Loading sign-in form…</p>}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
