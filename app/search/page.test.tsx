import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import SearchPage from './page'

const replaceMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

type Params = Record<string, string | string[] | undefined>

async function renderSearch(params: Params = {}) {
  const ui = await SearchPage({ searchParams: Promise.resolve(params) })
  return render(
    <AuthProvider>
      <AiAssistantProvider>{ui}</AiAssistantProvider>
    </AuthProvider>,
  )
}

function groupHeadings(): (string | null)[] {
  return Array.from(document.querySelectorAll('[aria-labelledby^="search-group-"] h2')).map(
    (node) => node.textContent,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  replaceMock.mockClear()
  localStorage.clear()
})

describe('站内搜索结果页', () => {
  it('没有关键词时渲染引导态且不出结果分组', async () => {
    await renderSearch()

    expect(screen.getByText(/输入一个城市、帖子或景点的名字/)).toBeInTheDocument()
    expect(groupHeadings()).toEqual([])
    expect(screen.getByRole('link', { name: '回到首页开始逛' })).toHaveAttribute('href', '/')
  })

  it('关键词只有空白时同样是引导态', async () => {
    await renderSearch({ q: '   ' })

    expect(screen.getByText(/输入一个城市、帖子或景点的名字/)).toBeInTheDocument()
    expect(groupHeadings()).toEqual([])
  })

  it('命中多类时分组顺序固定为编辑推荐、帖子、景点', async () => {
    await renderSearch({ q: '成都' })

    expect(groupHeadings()).toEqual(['编辑推荐', '帖子', '景点'])
    expect(screen.getByText('关键词「成都」共 4 条结果。')).toBeInTheDocument()
  })

  it('回显的关键词去掉首尾空白', async () => {
    await renderSearch({ q: '   成都  ' })

    expect(screen.getByText('关键词「成都」共 4 条结果。')).toBeInTheDocument()
    expect(screen.queryByText(/「   成都  」/)).not.toBeInTheDocument()
  })

  it('零命中渲染空态与回首页入口', async () => {
    await renderSearch({ q: 'zzz' })

    expect(screen.getByText('没有找到与「zzz」有关的内容。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '回到首页看看' })).toHaveAttribute('href', '/')
    expect(groupHeadings()).toEqual([])
  })

  it('每组都带回首页对应区块的锚点', async () => {
    await renderSearch({ q: '成都' })

    expect(screen.getByRole('link', { name: /在首页看编辑推荐/ })).toHaveAttribute(
      'href',
      '/#editor-picks',
    )
    expect(screen.getByRole('link', { name: /在首页看热门帖子/ })).toHaveAttribute(
      'href',
      '/#hot-posts',
    )
    expect(screen.getByRole('link', { name: /在首页看热门景点/ })).toHaveAttribute(
      'href',
      '/#hot-attractions',
    )
  })

  it('结果条目本身不是链接', async () => {
    await renderSearch({ q: '成都' })

    const listItems = document.querySelectorAll('[aria-labelledby^="search-group-"] li')
    expect(listItems.length).toBe(4)
    for (const item of Array.from(listItems)) {
      expect(item.querySelector('a')).toBeNull()
    }
  })

  it('展示组名、条数与城市中文名', async () => {
    await renderSearch({ q: '成都' })

    const postGroup = screen.getByRole('region', { name: '帖子' })
    expect(within(postGroup).getByText('2 条')).toBeInTheDocument()
    expect(within(postGroup).getByText('成都周边两日：古镇与竹林')).toBeInTheDocument()
    expect(within(postGroup).getAllByText(/^成都 · /).length).toBe(2)
  })

  it('服务端渲染：唯一 h1、含页头页脚、零 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await renderSearch({ q: '成都' })

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('站内搜索')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
