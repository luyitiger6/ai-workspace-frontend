import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import { mockRepository } from '@/lib/home/repository'
import HomePage from './page'

const replaceMock = vi.hoisted(() => vi.fn())

const HAN = /\p{Script=Han}/u

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

    expect(screen.getByRole('button', { name: 'Beijing' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ city: 'beijing' }))
  })

  it('非法城市回归全部', async () => {
    await renderHome({ city: 'atlantis' })

    expect(screen.getByRole('button', { name: 'All cities' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Beijing' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('searchParams 缺失时仍渲染并回落全部城市', async () => {
    const ui = await HomePage({ searchParams: Promise.resolve(undefined!) })
    render(
      <AuthProvider>
        <AiAssistantProvider>{ui}</AiAssistantProvider>
      </AuthProvider>,
    )

    expect(screen.getByRole('button', { name: 'All cities' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Popular attractions' })).toBeInTheDocument()
  })

  it('城市切换不影响主视觉', async () => {
    const readHero = () => {
      const region = screen.getByRole('region', { name: /Turn a place you want to see/ })
      return {
        heading: within(region).getByRole('heading', { level: 1 }).textContent,
        keyword: (within(region).getByLabelText('Search cities, posts or attractions') as HTMLInputElement).value,
      }
    }

    const { unmount } = await renderHome({ city: 'all' })
    const baseline = readHero()
    unmount()

    await renderHome({ city: 'beijing' })

    expect(readHero()).toEqual(baseline)
  })

  it('单个区块失败不连带其他区块', async () => {
    vi.spyOn(mockRepository, 'listEditorPicks').mockRejectedValue(new Error('mock failure'))

    await renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent("Editor's picks could not load")
    expect(screen.getByRole('heading', { name: 'Trending posts' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Popular attractions' })).toBeInTheDocument()
  })

  it('渲染后的可见文本不含中文字符', async () => {
    const { container } = await renderHome({ city: 'beijing' })

    expect(HAN.test(container.textContent ?? '')).toBe(false)
    expect(HAN.test(document.body.textContent ?? '')).toBe(false)
  })

  it('重复 city 参数取首值', async () => {
    const ui = await HomePage({ searchParams: Promise.resolve({ city: ['beijing', 'shanghai'] }) })
    render(
      <AuthProvider>
        <AiAssistantProvider>{ui}</AiAssistantProvider>
      </AuthProvider>,
    )

    expect(screen.getByRole('button', { name: 'Beijing' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Shanghai' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('city 变化触发三个内容区块重新取数', async () => {
    const picksSpy = vi.spyOn(mockRepository, 'listEditorPicks')
    const postsSpy = vi.spyOn(mockRepository, 'listHotPosts')
    const attractionsSpy = vi.spyOn(mockRepository, 'listHotAttractions')

    const first = await HomePage({ searchParams: Promise.resolve({ city: 'all' }) })
    const { rerender } = render(
      <AuthProvider>
        <AiAssistantProvider>{first}</AiAssistantProvider>
      </AuthProvider>,
    )

    await waitFor(() => expect(picksSpy).toHaveBeenLastCalledWith({ city: 'all' }))

    const second = await HomePage({ searchParams: Promise.resolve({ city: 'beijing' }) })
    rerender(
      <AuthProvider>
        <AiAssistantProvider>{second}</AiAssistantProvider>
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(picksSpy).toHaveBeenLastCalledWith({ city: 'beijing' })
      expect(postsSpy).toHaveBeenLastCalledWith({ city: 'beijing' })
      expect(attractionsSpy).toHaveBeenLastCalledWith({ city: 'beijing' })
    })
  })
})
