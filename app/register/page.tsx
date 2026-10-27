import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'
import styles from '../auth.module.css'

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Sign up to save routes and publish posts.',
}

export default function RegisterPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brand}>
          <Link className={styles.logo} href="/">
            wanderchain
          </Link>
          <p className={styles.quote}>Write down where you want to go, and the route will grow from there.</p>
          <p className={styles.quoteNote}>Signing up only needs an email, a username and a password.</p>
        </aside>
        <div className={styles.panel}>
          <AuthForm mode="register" />
        </div>
      </div>
    </main>
  )
}
