'use client'

import Link from 'next/link'
import { useAuth } from './auth-provider'
import styles from './account-menu.module.css'

export function AccountMenu() {
  const { status, user, logout } = useAuth()

  if (status === 'loading') {
    return <span className={styles.placeholder} aria-hidden="true" data-testid="account-loading" />
  }

  if (!user) {
    return (
      <Link className={styles.login} href="/login">
        Log in / Sign up
      </Link>
    )
  }

  return (
    <div className={styles.user}>
      <span className={styles.name}>{user.name}</span>
      {user.role === 'admin' ? <span className={styles.role}>Editor</span> : null}
      <button type="button" className={styles.logout} onClick={logout}>
        Log out
      </button>
    </div>
  )
}
