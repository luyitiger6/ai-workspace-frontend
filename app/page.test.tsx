import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import { mockRepository } from '@/lib/home/repository'
import HomePage from './page'

const replaceMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

type SearchParams = Record<string, string>

async function renderHome(params: SearchParams = {}) {
  const ui = await HomePage({ searchParams: Promise.resolve(params) })
  return render(
    <AuthProvider>
      <AiAssistantProvider>{ui}</AiAssistantProvider>
    </AuthProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  replaceMock.mockClear()
  localStorage.clear()
})

describe('wanderchain 首页', () => {
  it('按固定顺序渲染五个区块', async () => {
    await renderHome()

    const order = Array.from(document.querySelectorAll('[data-section]')).map((node) =>
      node.getAttribute('data-section'),
    )

    expect(order).toEqual([
      'feature-nav',
      'city-switcher',
      'editor-picks',
      'hot-posts',
      'hot-attractions',
    ])
  })

  it('把合法城市下发给城市入口与内容区块', async () => {
    const spy = vi.spyOn(mockRepository, 'listHotPosts')

    await renderHome({ city: 'beijing' })

    expect(screen.getByRole('button', { name: '北京' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ city: 'beijing' }))
  })

  it('非法城市回归全部', async () => {
    await renderHome({ city: 'atlantis' })

    expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '北京' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('城市切换不影响主视觉', async () => {
    const readOverview = () =>
      within(screen.getByRole('region', { name: /把想去的地方/ }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)

    const { unmount } = await renderHome({ city: 'all' })
    const baseline = readOverview()
    unmount()

    await renderHome({ city: 'beijing' })

    expect(readOverview()).toEqual(baseline)
  })

  it('单个区块失败不连带其他区块', async () => {
    vi.spyOn(mockRepository, 'listEditorPicks').mockRejectedValue(new Error('mock failure'))

    await renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent('编辑推荐暂时没能加载出来')
    expect(screen.getByRole('heading', { name: '热门帖子' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '热门景点' })).toBeInTheDocument()
  })
})
