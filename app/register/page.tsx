import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'
import styles from '../auth.module.css'

export const metadata: Metadata = {
  title: '注册',
  description: '注册后即可收藏路线、发布帖子。',
}

export default function RegisterPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brand}>
          <Link className={styles.logo} href="/">
            wanderchain
          </Link>
          <p className={styles.quote}>先写下你想去哪，路线会慢慢长出来。</p>
          <p className={styles.quoteNote}>注册只需要邮箱、用户名和密码。</p>
        </aside>
        <div className={styles.panel}>
          <AuthForm mode="register" />
        </div>
      </div>
    </main>
  )
}
