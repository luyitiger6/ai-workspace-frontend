'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  describeAuthError,
  fetchCaptcha,
  isCaptchaRequired,
  requestRegisterCode,
} from '@/lib/auth/auth-api'
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_BYTES,
  type CaptchaResponse,
} from '@/lib/contracts/auth'
import { useAuth } from './auth-provider'
import styles from './auth-form.module.css'

interface Props {
  mode: 'login' | 'register'
}

/** 注册的两步：先用图形码换邮箱码，再用邮箱码完成注册。 */
type RegisterStep = 'captcha' | 'code'

const PASSWORD_HINT = `At least ${PASSWORD_MIN_BYTES} characters (up to ${PASSWORD_MAX_BYTES})`

/**
 * 登录与注册共用一张表单，但两条链路对图形码的态度正好相反：
 *
 * - 登录默认不取图形码。取码本身就是一次账户维度的探测面，所以只有后端用
 *   `CAPTCHA_INVALID` 明确要求时才取一张，随后允许带码重试；
 * - 注册第一步必须带图形码答案，因此进入注册页就取一张。
 *
 * 文案分流一律走错误码而不是状态码：两个 403（邮箱未验证 / 来源不可信）必须给出
 * 不同的话，限流的等待秒数取自响应头，不在前端猜。
 */
export function AuthForm({ mode }: Props) {
  const isRegister = mode === 'register'
  const { login, register } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<RegisterStep>('captcha')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)

  const loadCaptcha = useCallback(async () => {
    try {
      const issued = await fetchCaptcha()
      setCaptcha(issued)
      setCaptchaAnswer('')
    } catch (cause) {
      setError(describeAuthError(cause))
    }
  }, [])

  // 注册第一步离不开图形码，所以进页面就取一张；登录不预取。
  useEffect(() => {
    if (isRegister) {
      void loadCaptcha()
    }
  }, [isRegister, loadCaptcha])

  async function submitLogin() {
    await login({
      email,
      password,
      ...(captcha ? { captchaId: captcha.captchaId, captchaAnswer } : {}),
    })
    router.replace('/')
  }

  async function submitRegisterCode() {
    await requestRegisterCode({
      email,
      captchaId: captcha?.captchaId ?? '',
      captchaAnswer,
    })
    setStep('code')
    setNotice('Check your inbox. The code expires in 5 minutes.')
  }

  async function submitRegister() {
    await register({ email, code, password, displayName })
    router.replace('/')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (isRegister && step === 'captcha' && password !== confirm) {
      setError('The two passwords do not match')
      return
    }

    if (isRegister && step === 'captcha' && !captcha) {
      // 图形码还没到位就提交，只会换来一次无意义的 400：先补一张再说。
      setError('The image verification is still loading. Please try again.')
      await loadCaptcha()
      return
    }

    setPending(true)
    try {
      if (!isRegister) {
        await submitLogin()
      } else if (step === 'captcha') {
        await submitRegisterCode()
        // 第一步成功后还要等用户输入邮箱码，按钮必须恢复可点；
        // 而登录与注册第二步成功后直接离开本页，保持 pending 反而能挡住重复提交。
        setPending(false)
      } else {
        await submitRegister()
      }
    } catch (cause) {
      setError(describeAuthError(cause))
      // 图形码是一次性的：答错或被要求补码之后，旧的那张必须作废并换新的。
      if (isCaptchaRequired(cause) || (isRegister && step === 'captcha')) {
        await loadCaptcha()
      }
      setPending(false)
    }
  }

  const submitLabel = pending
    ? 'Working…'
    : !isRegister
      ? 'Log in'
      : step === 'captcha'
        ? 'Send email code'
        : 'Sign up and log in'

  const captchaField = (
    <>
      <div className={styles.captcha}>
        {captcha ? (
          // 图形码是后端生成的 data URI，走不了 next/image 的自定义 loader，只能用原生 img。
          <img
            className={styles.captchaImage}
            src={captcha.image}
            alt="Image verification challenge"
            width={160}
            height={48}
          />
        ) : (
          // 加载态一律用 role="status"（与内容区块的约定一致），让读屏软件能播报而不是静默略过。
          <span className={styles.captchaPending} role="status">
            Loading image…
          </span>
        )}
        <button
          type="button"
          className={styles.captchaRefresh}
          onClick={() => void loadCaptcha()}
          disabled={pending}
        >
          Refresh
        </button>
      </div>
      <label className={styles.field}>
        <span>Image code</span>
        <input
          name="captchaAnswer"
          type="text"
          autoComplete="off"
          value={captchaAnswer}
          onChange={(event) => setCaptchaAnswer(event.target.value)}
          placeholder="Type the characters in the image"
          required
        />
      </label>
    </>
  )

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={pending}>
      <h1 className={styles.title}>{isRegister ? 'Create an account' : 'Welcome back'}</h1>
      <p className={styles.subtitle}>
        {isRegister
          ? step === 'captcha'
            ? 'Step 1 of 2: verify your email to receive a code.'
            : 'Step 2 of 2: enter the code we sent you.'
          : 'Continue to your next route.'}
      </p>

      {isRegister && step === 'captcha' ? (
        <label className={styles.field}>
          <span>Username</span>
          <input
            name="displayName"
            type="text"
            autoComplete="nickname"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
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

      {isRegister && step === 'code' ? (
        <label className={styles.field}>
          <span>Email code</span>
          <input
            name="code"
            type="text"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="6-digit code from your inbox"
            required
          />
        </label>
      ) : null}

      {isRegister && step === 'captcha' ? (
        <>
          <label className={styles.field}>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={PASSWORD_HINT}
              required
            />
          </label>
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
          {captchaField}
        </>
      ) : null}

      {!isRegister ? (
        <>
          <label className={styles.field}>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={PASSWORD_HINT}
              required
            />
          </label>
          {/* 登录只在后端明确要求时才出现图形码：不预取，也就少一个可被探测的入口。 */}
          {captcha ? captchaField : null}
        </>
      ) : null}

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="wc-button wc-button--primary" disabled={pending}>
        {submitLabel}
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
    </form>
  )
}
