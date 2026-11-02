import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommentResponse, VoteResponse } from '@/lib/contracts/posts'
import type { PostDetail } from '@/lib/posts/types'
import { PostsApiError, PostsNetworkError } from '@/lib/posts/posts-api'
import { usePostDetail } from './use-post-detail'

const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FAA'
const POST_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const OTHER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

const harness = vi.hoisted(() => {
  const auth = {
    status: 'user' as 'loading' | 'guest' | 'user',
    user: null as { publicId: string } | null,
    refresh: vi.fn(),
    logoutRevision: 0,
  }
  const api = {
    detail: vi.fn(),
    comments: vi.fn(),
    readMyInteractions: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    vote: vi.fn(),
    cancelVote: vi.fn(),
    bookmark: vi.fn(),
    cancelBookmark: vi.fn(),
  }
  return { auth, api }
})

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => harness.auth }))
vi.mock('@/lib/posts/posts-api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/posts/posts-api')>()
  return { ...actual, postsApi: harness.api }
})

function makeDetail(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    publicId: POST_ID,
    title: 'A walk through the old town',
    content: 'Body',
    coverImage: 'https://example.com/cover.jpg',
    tags: ['Walking'],
    status: 'published',
    authorPublicId: OWNER,
    createdAt: '2026-10-01T10:00:00+08:00',
    updatedAt: '2026-10-01T10:00:00+08:00',
    commentCount: 1,
    upVoteCount: 2,
    bookmarkCount: 3,
    ...overrides,
  }
}

function makeComment(id: string, overrides: Partial<CommentResponse> = {}): CommentResponse {
  return {
    publicId: id,
    postPublicId: POST_ID,
    parentPublicId: null,
    authorPublicId: OWNER,
    content: `Comment ${id}`,
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  for (const fn of Object.values(harness.api)) fn.mockReset()
  harness.auth.status = 'user'
  harness.auth.user = { publicId: OWNER }
  harness.auth.logoutRevision = 0
  harness.auth.refresh.mockReset().mockResolvedValue(null)
  harness.api.detail.mockResolvedValue(makeDetail())
  harness.api.comments.mockResolvedValue({ items: [makeComment('c1')], nextCursor: null })
  harness.api.readMyInteractions.mockResolvedValue({ voteDirection: null, bookmarked: false })
})

describe('usePostDetail', () => {
  it('游客先读详情再读评论，不请求本人互动状态', async () => {
    harness.auth.status = 'guest'
    harness.auth.user = null

    const { result } = renderHook(() => usePostDetail(POST_ID))

    await waitFor(() => expect(result.current.view.detail.status).toBe('ready'))
    await waitFor(() => expect(result.current.view.comments.status).toBe('ready'))

    expect(harness.api.detail).toHaveBeenCalledWith(POST_ID, expect.any(AbortSignal))
    expect(harness.api.comments).toHaveBeenCalledWith(POST_ID, null, expect.any(AbortSignal))
    expect(harness.api.readMyInteractions).not.toHaveBeenCalled()
    expect(result.current.view.personal.status).toBe('idle')
  })

  it('登录后并行读取评论与本人互动状态', async () => {
    harness.api.readMyInteractions.mockResolvedValue({ voteDirection: 'up', bookmarked: true })

    const { result } = renderHook(() => usePostDetail(POST_ID))

    await waitFor(() => expect(result.current.view.detail.status).toBe('ready'))
    await waitFor(() => expect(result.current.view.personal.status).toBe('ready'))

    expect(result.current.view.comments.status).toBe('ready')
    expect(result.current.view.personal.data).toMatchObject({ voteDirection: 'up', bookmarked: true })
  })

  it('详情 404 归为未找到，且不再请求评论与本人状态', async () => {
    harness.api.detail.mockRejectedValue(new PostsApiError(404, 'POST_NOT_FOUND', 'gone'))

    const { result } = renderHook(() => usePostDetail(POST_ID))

    await waitFor(() => expect(result.current.view.detail.status).toBe('not-found'))
    expect(harness.api.comments).not.toHaveBeenCalled()
    expect(harness.api.readMyInteractions).not.toHaveBeenCalled()
  })

  it('访客拿到他人草稿时按未找到处理并标记会话需复核', async () => {
    harness.auth.status = 'guest'
    harness.auth.user = null
    harness.api.detail.mockResolvedValue(makeDetail({ status: 'draft' }))

    const { result } = renderHook(() => usePostDetail(POST_ID))

    await waitFor(() => expect(result.current.view.detail.status).toBe('not-found'))
    expect(result.current.view.detail.data).toBeNull()
    expect(result.current.view.sessionExpired).toBe(true)
    expect(harness.api.comments).not.toHaveBeenCalled()
  })

  it('路由切换后迟到的详情响应不覆盖新页面', async () => {
    const stale = deferred<PostDetail>()
    const fresh = deferred<PostDetail>()
    harness.api.detail.mockReset()
    harness.api.detail.mockImplementationOnce(() => stale.promise).mockImplementationOnce(() => fresh.promise)

    const { result, rerender } = renderHook(({ id }: { id: string }) => usePostDetail(id), { initialProps: { id: POST_ID } })
    await waitFor(() => expect(harness.api.detail).toHaveBeenCalledTimes(1))

    rerender({ id: OTHER_ID })
    await waitFor(() => expect(harness.api.detail).toHaveBeenCalledTimes(2))

    await act(async () => { stale.resolve(makeDetail({ title: 'Stale title' })); await Promise.resolve() })
    expect(result.current.view.detail.data).toBeNull()

    await act(async () => { fresh.resolve(makeDetail({ publicId: OTHER_ID, title: 'Fresh title' })); await Promise.resolve() })
    await waitFor(() => expect(result.current.view.detail.data?.title).toBe('Fresh title'))
  })

  it('并发投票只发一次写请求，成功后校准详情与本人状态', async () => {
    const write = deferred<VoteResponse>()
    harness.api.vote.mockReturnValue(write.promise)

    const { result } = renderHook(() => usePostDetail(POST_ID))
    await waitFor(() => expect(result.current.view.personal.status).toBe('ready'))

    act(() => {
      void result.current.toggleVote('up')
      void result.current.toggleVote('up')
    })

    expect(harness.api.vote).toHaveBeenCalledOnce()
    expect(harness.api.vote).toHaveBeenCalledWith(POST_ID, 'up', expect.any(AbortSignal))
    expect(result.current.view.busy).toBe(true)

    await act(async () => {
      write.resolve({ publicId: 'v1', postPublicId: POST_ID, authorPublicId: OWNER, direction: 'up', createdAt: '2026-10-11T16:30:00+08:00', updatedAt: '2026-10-11T16:30:00+08:00' })
      await write.promise
    })

    await waitFor(() => expect(result.current.view.busy).toBe(false))
    await waitFor(() => expect(result.current.view.mutation.status).toBe('success'))
    expect(harness.api.detail).toHaveBeenCalledTimes(2)
    expect(harness.api.readMyInteractions).toHaveBeenCalledTimes(2)
  })

  it('写结果未知时锁住后续动作，要求先核对服务端数据', async () => {
    harness.api.vote.mockRejectedValue(new PostsNetworkError())

    const { result } = renderHook(() => usePostDetail(POST_ID))
    await waitFor(() => expect(result.current.view.personal.status).toBe('ready'))

    await act(async () => { await result.current.toggleVote('up') })

    expect(result.current.view.mutation.status).toBe('uncertain')
    expect(result.current.view.mutation.message).toBe('The write result is unknown. Check server data before taking another action; nothing will be sent again automatically.')
    expect(result.current.view.needsReview).toBe(true)

    await act(async () => { await result.current.toggleVote('down') })
    expect(harness.api.vote).toHaveBeenCalledTimes(1)
  })

  it('评论提交去空白并绑定父级，成功后清空草稿', async () => {
    harness.api.createComment.mockResolvedValue(makeComment('c9'))

    const { result } = renderHook(() => usePostDetail(POST_ID))
    await waitFor(() => expect(result.current.view.comments.status).toBe('ready'))

    act(() => { result.current.editContent('  Hello  ') })
    act(() => { result.current.chooseReply(makeComment('c1')) })
    await act(async () => { await result.current.submitComment() })

    expect(harness.api.createComment).toHaveBeenCalledWith(POST_ID, { content: 'Hello', parentPublicId: 'c1' }, expect.any(AbortSignal))
    expect(result.current.draft).toMatchObject({ content: '', replyTo: null })
    expect(result.current.view.mutation.status).toBe('success')
    expect(harness.api.comments).toHaveBeenCalledTimes(2)
  })

  it('空白评论在客户端就被拦下，不发写请求', async () => {
    const { result } = renderHook(() => usePostDetail(POST_ID))
    await waitFor(() => expect(result.current.view.comments.status).toBe('ready'))

    act(() => { result.current.editContent('   ') })
    let outcome: Awaited<ReturnType<typeof result.current.submitComment>> = 'success'
    await act(async () => { outcome = await result.current.submitComment() })

    expect(outcome).toBe('ignored')
    expect(harness.api.createComment).not.toHaveBeenCalled()
  })

  it('服务端判定内容无效时按业务语义提示，不当作写结果未知', async () => {
    harness.api.createComment.mockRejectedValue(new PostsApiError(400, 'VALIDATION_FAILED', 'bad'))

    const { result } = renderHook(() => usePostDetail(POST_ID))
    await waitFor(() => expect(result.current.view.comments.status).toBe('ready'))

    act(() => { result.current.editContent('hello') })
    await act(async () => { await result.current.submitComment() })

    expect(result.current.view.mutation.status).toBe('error')
    expect(result.current.view.mutation.message).toBe('The comment content is invalid. Check its length and try again.')
    expect(result.current.view.needsReview).toBe(false)
  })
})
