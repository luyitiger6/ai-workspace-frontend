import { beforeEach, describe, expect, it } from 'vitest'
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

  it('注册新账号后立即建立会话', async () => {
    const session = await registerAccount({
      email: 'new@wanderchain.dev',
      password: 'secret123',
      name: '新旅人',
    })

    expect(session.user.email).toBe('new@wanderchain.dev')
    expect(session.user.name).toBe('新旅人')
    expect(session.user.role).toBe('user')
    expect(session.token.split('.')).toHaveLength(3)
  })

  it('重复邮箱无法注册', async () => {
    await expect(
      registerAccount({ email: 'admin@wanderchain.dev', password: 'secret123', name: '冒名者' }),
    ).rejects.toThrow('该邮箱已经注册过了')
  })

  it('密码错误时拒绝登录', async () => {
    await expect(loginWithPassword('admin@wanderchain.dev', 'wrong-password')).rejects.toThrow(
      '邮箱或密码不正确',
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

  it('非法邮箱与过短密码被输入校验拦截', async () => {
    await expect(
      registerAccount({ email: 'not-an-email', password: 'secret123', name: '路人' }),
    ).rejects.toBeInstanceOf(AuthError)
    await expect(
      registerAccount({ email: 'ok@wanderchain.dev', password: '123', name: '路人' }),
    ).rejects.toThrow('密码至少 6 位')
  })
})
