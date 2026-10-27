import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthError,
  loginWithPassword,
  logoutSession,
  readSession,
  registerAccount,
} from './mock-auth'

describe('Mock 认证', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('注册新账号后立即建立会话', async () => {
    const session = await registerAccount({
      email: 'new@wanderchain.dev',
      password: 'secret123',
      name: 'New Traveler',
    })

    expect(session.user.email).toBe('new@wanderchain.dev')
    expect(session.user.name).toBe('New Traveler')
    expect(session.user.role).toBe('user')
    expect(session.token.split('.')).toHaveLength(3)
  })

  it('重复邮箱无法注册', async () => {
    await expect(
      registerAccount({ email: 'admin@wanderchain.dev', password: 'secret123', name: 'Impostor' }),
    ).rejects.toThrow('This email is already registered')
  })

  it('密码错误时拒绝登录', async () => {
    await expect(loginWithPassword('admin@wanderchain.dev', 'wrong-password')).rejects.toThrow(
      'Incorrect email or password',
    )
  })

  it('内置管理员账号返回 admin 角色', async () => {
    const session = await loginWithPassword('admin@wanderchain.dev', 'admin123')

    expect(session.user.role).toBe('admin')
  })

  it('邮箱大小写不敏感', async () => {
    const session = await loginWithPassword('ADMIN@wanderchain.dev', 'admin123')

    expect(session.user.email).toBe('admin@wanderchain.dev')
  })

  it('登录邮箱忽略首尾空格', async () => {
    const session = await loginWithPassword(' Admin@WanderChain.dev ', 'admin123')

    expect(session.user.email).toBe('admin@wanderchain.dev')
  })

  it('注册时同一邮箱的不同大小写写法被判为重复', async () => {
    await expect(
      registerAccount({
        email: ' ADMIN@WanderChain.dev ',
        password: 'secret123',
        name: 'Impostor',
      }),
    ).rejects.toThrow('This email is already registered')
  })

  it('用户名 trim 后不足 2 个字符时拒绝注册且不写存储', async () => {
    await expect(
      registerAccount({ email: 'short@wanderchain.dev', password: 'secret123', name: '  A  ' }),
    ).rejects.toThrow('Username must be at least 2 characters')

    expect(window.localStorage.getItem('wanderchain.accounts')).toBeNull()
    expect(window.localStorage.getItem('wanderchain.session')).toBeNull()
  })

  it('非法邮箱给出精确文案且不写任何存储', async () => {
    await expect(
      registerAccount({ email: 'not-an-email', password: 'secret123', name: 'Passerby' }),
    ).rejects.toThrow('Enter a valid email address')

    expect(window.localStorage.getItem('wanderchain.accounts')).toBeNull()
    expect(window.localStorage.getItem('wanderchain.session')).toBeNull()
  })

  it('邮箱不存在与密码错误返回完全相同的文案', async () => {
    const attempts = [
      loginWithPassword('nobody@wanderchain.dev', 'secret123'),
      loginWithPassword('admin@wanderchain.dev', 'wrong-password'),
    ]

    const messages = await Promise.all(
      attempts.map((attempt) =>
        attempt.then(
          () => 'resolved',
          (error: unknown) => (error instanceof Error ? error.message : String(error)),
        ),
      ),
    )

    expect(messages).toEqual(['Incorrect email or password', 'Incorrect email or password'])
  })

  it('刷新后仍能读到同一会话', async () => {
    const created = await loginWithPassword('traveler@wanderchain.dev', 'traveler123')

    const restored = readSession()

    expect(restored?.user).toEqual(created.user)
    expect(restored?.expiresAt).toBe(created.expiresAt)
  })

  it('退出后会话被清除', async () => {
    await loginWithPassword('traveler@wanderchain.dev', 'traveler123')

    logoutSession()

    expect(readSession()).toBeNull()
  })

  it('会话过期时被删除并返回 null', () => {
    window.localStorage.setItem(
      'wanderchain.session',
      JSON.stringify({
        token: 'expired.token.sig',
        user: { id: 'u1', email: 'a@b.co', name: 'A', role: 'user' },
        expiresAt: Date.now() - 1000,
      }),
    )

    expect(readSession()).toBeNull()
    expect(window.localStorage.getItem('wanderchain.session')).toBeNull()
  })

  it('损坏的会话被删除且不抛错', () => {
    window.localStorage.setItem('wanderchain.session', '{not-json')

    expect(() => readSession()).not.toThrow()
    expect(readSession()).toBeNull()
    expect(window.localStorage.getItem('wanderchain.session')).toBeNull()
  })

  it('没有 window 时存储访问返回 null', () => {
    vi.stubGlobal('window', undefined)

    expect(readSession()).toBeNull()
    expect(() => logoutSession()).not.toThrow()
  })

  it('非法邮箱与过短密码被输入校验拦截', async () => {
    await expect(
      registerAccount({ email: 'not-an-email', password: 'secret123', name: 'Passerby' }),
    ).rejects.toBeInstanceOf(AuthError)
    await expect(
      registerAccount({ email: 'ok@wanderchain.dev', password: '123', name: 'Passerby' }),
    ).rejects.toThrow('Password must be at least 6 characters')
  })

  it('生产环境下拒绝注册与登录，演示认证不会静默上线', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(loginWithPassword('admin@wanderchain.dev', 'admin123')).rejects.toThrow(
      'Demo auth is disabled',
    )
    await expect(
      registerAccount({ email: 'new@wanderchain.dev', password: 'secret123', name: 'New Traveler' }),
    ).rejects.toThrow('Demo auth is disabled')
    expect(readSession()).toBeNull()
  })
})
