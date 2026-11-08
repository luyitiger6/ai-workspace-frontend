import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { profileApi } from '@/lib/profile/profile-api'
import type { ProfileCard } from '@/lib/profile/types'
import { useAuthorCards } from './use-author-cards'

vi.mock('@/lib/profile/profile-api', () => ({
  profileApi: {
    me: vi.fn(),
    update: vi.fn(),
    cards: vi.fn(),
    interests: vi.fn(),
  },
}))

function card(publicId: string, displayName = 'Ada'): ProfileCard {
  return { publicId, displayName, avatarUrl: '' }
}

describe('useAuthorCards', () => {
  it('按 authorPublicId 去重，重复标识只请求一次', async () => {
    const cards = vi.mocked(profileApi.cards)
    cards.mockResolvedValueOnce([card('A'), card('B')])

    renderHook(() => useAuthorCards(['A', 'A', 'B']))

    await waitFor(() => expect(cards).toHaveBeenCalledTimes(1))
    expect(cards).toHaveBeenCalledWith(['A', 'B'])
  })

  it('剔除已缓存标识，集合变化时只请求新增项', async () => {
    const cards = vi.mocked(profileApi.cards)
    cards.mockResolvedValueOnce([card('A'), card('B')])

    const { rerender } = renderHook(({ ids }: { ids: string[] }) => useAuthorCards(ids), {
      initialProps: { ids: ['A', 'B'] },
    })
    await waitFor(() => expect(cards).toHaveBeenCalledTimes(1))

    cards.mockResolvedValueOnce([card('C')])
    rerender({ ids: ['A', 'B', 'C'] })

    await waitFor(() => expect(cards).toHaveBeenCalledTimes(2))
    expect(cards).toHaveBeenLastCalledWith(['C'])
  })

  it('超过 50 个标识按块并发请求，块大小不超过 50', async () => {
    const cards = vi.mocked(profileApi.cards)
    const ids = Array.from({ length: 60 }, (_, index) => `id-${index}`)
    cards.mockImplementation(async (chunk) => chunk.map((id) => card(id)))

    renderHook(() => useAuthorCards(ids))

    await waitFor(() => expect(cards).toHaveBeenCalledTimes(2))
    expect(cards.mock.calls[0][0]).toHaveLength(50)
    expect(cards.mock.calls[1][0]).toHaveLength(10)
  })

  it('维护 pending / ready / missing 三态', async () => {
    const cards = vi.mocked(profileApi.cards)
    let resolve!: (value: ProfileCard[]) => void
    cards.mockImplementationOnce(() => new Promise<ProfileCard[]>((yes) => { resolve = yes }))

    const { result } = renderHook(() => useAuthorCards(['A', 'B']))

    await waitFor(() => expect(result.current.get('A')?.status).toBe('pending'))
    expect(result.current.get('B')?.status).toBe('pending')

    await act(async () => {
      resolve([card('A'), { publicId: 'B', displayName: '', avatarUrl: '' }])
    })

    await waitFor(() => expect(result.current.get('A')?.status).toBe('ready'))
    expect(result.current.get('A')?.card?.displayName).toBe('Ada')
    expect(result.current.get('B')?.status).toBe('missing')
    expect(result.current.get('B')?.card).toBeNull()
  })

  it('失败批次在标识集合变化时重新请求', async () => {
    const cards = vi.mocked(profileApi.cards)
    cards.mockRejectedValueOnce(new Error('network'))

    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useAuthorCards(ids), {
      initialProps: { ids: ['A'] },
    })

    await waitFor(() => expect(result.current.get('A')?.status).toBe('missing'))

    cards.mockResolvedValueOnce([card('A')])
    rerender({ ids: ['A', 'B'] })

    await waitFor(() => expect(result.current.get('A')?.status).toBe('ready'))
    expect(cards).toHaveBeenCalledTimes(2)
    expect(cards).toHaveBeenLastCalledWith(['A', 'B'])
  })
})
