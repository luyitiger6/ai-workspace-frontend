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
        登录 / 注册
      </Link>
    )
  }

  return (
    <div className={styles.user}>
      <span className={styles.name}>{user.name}</span>
      {user.role === 'admin' ? <span className={styles.role}>编辑</span> : null}
      <button type="button" className={styles.logout} onClick={logout}>
        退出
      </button>
    </div>
  )
}
