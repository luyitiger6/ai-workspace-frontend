import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import { mockRepository } from '@/lib/home/repository'
import type { PostSummaryResponse } from '@/lib/contracts/posts'
import PostsPage from './page'

const replaceMock = vi.hoisted(() => vi.fn())
let searchParams = new URLSearchParams()
const post: PostSummaryResponse = {
  publicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', title: 'A real route', coverImage: '',
  tags: ['Walking'], status: 'published', authorPublicId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  createdAt: '2026-10-11T16:30:00+08:00', updatedAt: '2026-10-11T16:30:00+08:00',
  commentCount: 0, upVoteCount: 0, bookmarkCount: 0,
}
const fetchMock = vi.fn()
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}))

describe('/posts 页面', () => {
  beforeEach(() => {
    fetchMock.mockReset().mockImplementation(async (path: string) => path.startsWith('/api/posts?')
      ? json({ items: [post], nextCursor: null }) : new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    replaceMock.mockClear()
    searchParams = new URLSearchParams()
  })

  function renderPage() {
    return render(
      <AuthProvider>
        <AiAssistantProvider>
          <PostsPage />
        </AiAssistantProvider>
      </AuthProvider>,
    )
  }

  it('渲染页面标题与排序 Tab', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'All posts' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Sort posts' })).toBeInTheDocument()
  })

  it('默认 latest 读取真实端点，完全不消费首页 Mock', async () => {
    const feedSpy = vi.spyOn(mockRepository, 'feedPosts')
    renderPage()
    expect(await screen.findAllByTestId('post-card')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/posts?sortBy=publishedAt&limit=20', expect.objectContaining({
      credentials: 'same-origin', cache: 'no-store', signal: expect.any(AbortSignal),
    }))
    expect(feedSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: post.title })).toHaveAttribute('href', `/posts/${post.publicId}?sortBy=latest`)
  })

  it('空态不展示卡片列表', async () => {
    fetchMock.mockImplementation(async () => json({ items: [], nextCursor: null }))

    renderPage()

    expect(await screen.findByText('No posts yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument()
  })

  it('首次加载失败展示错误态与重试按钮', async () => {
    fetchMock.mockImplementation(async (path: string) => path.startsWith('/api/posts?')
      ? new Response('upstream unavailable', { status: 502 }) : new Response('', { status: 401 }))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Posts could not load')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument()
    fetchMock.mockImplementation(async () => json({ items: [post], nextCursor: null }))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('post-card')).toBeInTheDocument()
  })

  it.each([
    ['latest', 'publishedAt'], ['hottest', 'upVoteCount'], ['mostDiscussed', 'commentCount'], ['unknown', 'publishedAt'],
  ])('URL 排序 %s 只使用对应 HTTP 词 %s', async (sortBy, httpSort) => {
    searchParams = new URLSearchParams({ sortBy })
    renderPage()
    await screen.findByTestId('post-card')
    expect(fetchMock).toHaveBeenCalledWith(`/api/posts?sortBy=${httpSort}&limit=20`, expect.any(Object))
    expect(screen.getByRole('tab', { name: sortBy === 'hottest' ? 'Hottest' : sortBy === 'mostDiscussed' ? 'Most discussed' : 'Latest' }))
      .toHaveAttribute('aria-selected', 'true')
  })

  it('IO 连续进入只请求一次，分页错误保留卡片且只重试原游标', async () => {
    const cursor = 'opaque+/=&雪'
    let fail!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => { fail = resolve })
    fetchMock.mockImplementation(async (path: string) => {
      if (!path.startsWith('/api/posts?')) return new Response('', { status: 401 })
      return new URL(path, 'http://localhost').searchParams.has('cursor') ? pending
        : json({ items: [post], nextCursor: cursor })
    })
    renderPage()
    await screen.findByTestId('post-card')
    const sentinel = screen.getByTestId('post-feed-sentinel')
    const trigger = (globalThis as unknown as { triggerIntersection: (target: Element, isIntersecting: boolean) => void }).triggerIntersection
    act(() => { trigger(sentinel, true); trigger(sentinel, true); trigger(sentinel, true) })
    await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) => path.startsWith('/api/posts?'))).toHaveLength(2))
    await act(async () => fail(new Response('bad cursor', { status: 400 })))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load more')
    expect(screen.getAllByTestId('post-card')).toHaveLength(1)
    const retryPath = `/api/posts?${new URLSearchParams({ sortBy: 'publishedAt', limit: '20', cursor })}`
    fetchMock.mockImplementation(async () => json({ items: [post], nextCursor: null }))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('You have reached the end.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([path]) => path === retryPath)).toHaveLength(2)
    expect(screen.getAllByTestId('post-card')).toHaveLength(1)
    expect(screen.queryByTestId('post-feed-sentinel')).not.toBeInTheDocument()
  })
})
