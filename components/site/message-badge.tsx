'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { dmApi, isUnauthenticated } from '@/lib/dm/dm-api'
import styles from './message-badge.module.css'

/**
 * 顶栏消息入口与总未读角标（tasks 6.3）。
 *
 * 未读总数走独立的轻量端点（design D9）：不为一个数字拉整页会话。
 * 只在已登录时渲染入口并发请求——未登录不显示，也不触发 `/api/dm/unread-count`。
 *
 * 顶栏在每个页面都渲染，所以不做轮询：窗口重新获得焦点时刷新一次，
 * 其余时机由列表/会话页自身的取数反映（不在顶栏堆常驻定时器）。
 */
export function MessageBadge() {
  const { status, expireSession } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (status !== 'user') {
      setCount(0)
      return
    }
    const controller = new AbortController()
    let active = true
    const load = () => {
      dmApi
        .unreadCount(controller.signal)
        .then(value => {
          if (active) setCount(value)
        })
        .catch(cause => {
          if (!active) return
          if (isUnauthenticated(cause)) {
            expireSession()
            return
          }
          // 角标拿不到就不显示数字：不猜未读数，也不把顶栏变成错误提示区。
          setCount(0)
        })
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      active = false
      controller.abort()
      window.removeEventListener('focus', load)
    }
  }, [status, expireSession])

  if (status !== 'user') return null

  return (
    <Link className={styles.link} href="/messages">
      <span>Messages</span>
      {count > 0 ? (
        <span className={styles.badge}>
          {count > 99 ? '99+' : count}
          <span className="wc-visually-hidden"> unread</span>
        </span>
      ) : null}
    </Link>
  )
}
