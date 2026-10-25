'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { useAuth } from './auth-provider'
import styles from './auth-form.module.css'

interface Props {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: Props) {
  const isRegister = mode === 'register'
  const { login, register } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (isRegister && password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }

    setPending(true)
    try {
      if (isRegister) {
        await register({ email, password, name })
      } else {
        await login(email, password)
      }
      router.replace('/')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后再试')
      setPending(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h1 className={styles.title}>{isRegister ? '创建账号' : '欢迎回来'}</h1>
      <p className={styles.subtitle}>
        {isRegister ? '注册后即可收藏路线、发布帖子。' : '继续你的下一段路线。'}
      </p>

      {isRegister ? (
        <label className={styles.field}>
          <span>用户名</span>
          <input
            name="name"
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="旅途中希望被怎么称呼"
            required
          />
        </label>
      ) : null}

      <label className={styles.field}>
        <span>邮箱</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>

      <label className={styles.field}>
        <span>密码</span>
        <input
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 6 位"
          required
        />
      </label>

      {isRegister ? (
        <label className={styles.field}>
          <span>确认密码</span>
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="再输入一次"
            required
          />
        </label>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="wc-button wc-button--primary" disabled={pending}>
        {pending ? '处理中…' : isRegister ? '注册并登录' : '登录'}
      </button>

      <p className={styles.switch}>
        {isRegister ? (
          <>
            已经有账号了？<Link href="/login">去登录</Link>
          </>
        ) : (
          <>
            还没有账号？<Link href="/register">注册一个</Link>
          </>
        )}
      </p>

      {isRegister ? null : (
        <p className={styles.hint}>演示账号：admin@wanderchain.dev / admin123</p>
      )}
    </form>
  )
}
