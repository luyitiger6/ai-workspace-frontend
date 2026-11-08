import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeProfileError, ProfileApiError, ProfileNetworkError, profileApi } from './profile-api'

const fetchMock = vi.fn()
const ID = '01K7USER0000000000000000000'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

function lastRequest() {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { path, init }
}

/**
 * 公开用户资料端点层（任务 3.2）。
 *
 * `profileApi.publicProfile` 恒走真接口，不受 `USE_MOCK_PROFILE` 影响（OQ1 决策），
 * 所以这里不需要设置任何环境变量就能断言真实请求与真实失败码。
 */
describe('公开用户资料端点层', () => {
  it('200：五项逐一映射，请求走公开路径并透传 signal', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue(json({
      publicId: ID,
      displayName: 'Alice',
      avatarUrl: 'https://cdn.example.com/a.png',
      bio: '简介',
      interests: ['hiking', 'food'],
    }))

    const profile = await profileApi.publicProfile(ID, signal)

    expect(profile).toEqual({
      publicId: ID,
      displayName: 'Alice',
      avatarUrl: 'https://cdn.example.com/a.png',
      bio: '简介',
      interests: ['hiking', 'food'],
    })
    expect(lastRequest().path).toBe(`/api/profiles/${ID}`)
    expect(lastRequest().init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', signal })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('404：抛 PROFILE_NOT_FOUND，界面文案不照搬服务端原文', async () => {
    fetchMock.mockResolvedValue(json({ code: 'PROFILE_NOT_FOUND', message: '用户不存在' }, 404))

    await expect(profileApi.publicProfile(ID)).rejects.toMatchObject({
      name: 'ProfileApiError',
      status: 404,
      code: 'PROFILE_NOT_FOUND',
    })

    const text = describeProfileError(new ProfileApiError(404, 'PROFILE_NOT_FOUND', '用户不存在'))
    expect(text).not.toBe('用户不存在')
    expect(text).toContain('does not exist')
  })

  it('网络失败：归一成 ProfileNetworkError 且不自动重试', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))

    await expect(profileApi.publicProfile(ID)).rejects.toBeInstanceOf(ProfileNetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
