import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'
import styles from '../auth.module.css'

export const metadata: Metadata = {
  title: '登录',
  description: '登录后继续你的下一段路线。',
}

export default function LoginPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brand}>
          <Link className={styles.logo} href="/">
            wanderchain
          </Link>
          <p className={styles.quote}>把每一次出发，写成人能看懂的路线。</p>
          <p className={styles.quoteNote}>登录后可收藏路线、发布帖子。</p>
        </aside>
        <div className={styles.panel}>
          <AuthForm mode="login" />
        </div>
      </div>
    </main>
  )
}
