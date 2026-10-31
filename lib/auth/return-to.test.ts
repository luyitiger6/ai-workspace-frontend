import { describe, expect, it } from 'vitest'
import { authHref, safeReturnTo } from './return-to'

const target = '/posts/01ARZ3NDEKTSV4RRFFQ69G5FAV'

describe('认证回跳允许列表', () => {
  it('规范 ULID 详情可回跳及登录注册互转', () => {
    expect(safeReturnTo(target)).toBe(target)
    for (const mode of ['login', 'register'] as const) {
      const href = authHref(mode, target)
      expect(new URL(href, 'http://localhost').searchParams.get('next')).toBe(target)
      expect(new URL(href, 'http://localhost').pathname).toBe(`/${mode}`)
    }
    expect(safeReturnTo('/posts/7ZZZZZZZZZZZZZZZZZZZZZZZZZ')).not.toBeNull()
  })

  it.each([
    null, undefined, '', '/', '/posts', '/search', 'https://evil.test', '//evil.test',
    '\\evil.test', target + '?sortBy=latest', target + '#comments', target + '/extra',
    target + '/', target + '\n', target.toLowerCase(), '/posts/8ZZZZZZZZZZZZZZZZZZZZZZZZZ',
    '/posts/01ARZ3NDEKTSV4RRFFQ69G5FAI', '/posts/01ARZ3NDEKTSV4RRFFQ69G5FAL',
    '/posts/01ARZ3NDEKTSV4RRFFQ69G5FAO', '/posts/01ARZ3NDEKTSV4RRFFQ69G5FAU',
    '/posts/not-an-id', '/posts/../login', '/posts\\01ARZ3NDEKTSV4RRFFQ69G5FAV',
    encodeURIComponent(target), encodeURIComponent(encodeURIComponent(target)),
    '/%70osts/01ARZ3NDEKTSV4RRFFQ69G5FAV', target.replace('A', '%41'),
  ])('拒绝未知或绕过目标 %s', (next) => {
    expect(safeReturnTo(next)).toBeNull()
    expect(authHref('login', next)).toBe('/login')
    expect(authHref('register', next)).toBe('/register')
  })
})
