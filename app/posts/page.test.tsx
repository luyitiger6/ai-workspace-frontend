import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import { mockRepository } from '@/lib/home/repository'
import PostsPage from './page'

const replaceMock = vi.hoisted(() => vi.fn())
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}))

describe('/posts 页面', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
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

  it('默认按 latest 排序加载', async () => {
    const feedSpy = vi.spyOn(mockRepository, 'feedPosts')

    renderPage()

    await waitFor(() => expect(feedSpy).toHaveBeenCalledWith('latest', null))
    expect(await screen.findAllByTestId('post-card')).toHaveLength(8)
  })

  it('空态不展示卡片列表', async () => {
    vi.spyOn(mockRepository, 'feedPosts').mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    })

    renderPage()

    expect(await screen.findByText('No posts yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument()
  })

  it('首次加载失败展示错误态与重试按钮', async () => {
    vi.spyOn(mockRepository, 'feedPosts').mockRejectedValueOnce(new Error('mock failure'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Posts could not load')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
