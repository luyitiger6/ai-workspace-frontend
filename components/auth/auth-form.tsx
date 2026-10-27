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
      setError('The two passwords do not match')
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
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again later.')
      setPending(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h1 className={styles.title}>{isRegister ? 'Create an account' : 'Welcome back'}</h1>
      <p className={styles.subtitle}>
        {isRegister ? 'Sign up to save routes and publish posts.' : 'Continue to your next route.'}
      </p>

      {isRegister ? (
        <label className={styles.field}>
          <span>Username</span>
          <input
            name="name"
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="How should we call you on the road"
            required
          />
        </label>
      ) : null}

      <label className={styles.field}>
        <span>Email</span>
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
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          required
        />
      </label>

      {isRegister ? (
        <label className={styles.field}>
          <span>Confirm password</span>
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Type it again"
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
        {pending ? 'Working…' : isRegister ? 'Sign up and log in' : 'Log in'}
      </button>

      <p className={styles.switch}>
        {isRegister ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/register">Create one</Link>
          </>
        )}
      </p>

      {isRegister ? null : (
        <p className={styles.hint}>Demo account: admin@wanderchain.dev / admin123</p>
      )}
    </form>
  )
}
