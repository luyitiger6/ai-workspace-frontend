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
      {/* 只展示后端契约里真实存在的字段：后端没有角色模型，也就不该有角色徽章。 */}
      <span className={styles.name}>{user.displayName}</span>
      <button type="button" className={styles.logout} onClick={() => void logout()}>
        Log out
      </button>
    </div>
  )
}
