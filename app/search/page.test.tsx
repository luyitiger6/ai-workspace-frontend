import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import SearchPage from './page'

const replaceMock = vi.hoisted(() => vi.fn())

const HAN = /\p{Script=Han}/u

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

    expect(screen.getByText(/Type the name of a city, a post or an attraction/)).toBeInTheDocument()
    expect(groupHeadings()).toEqual([])
    expect(screen.getByRole('link', { name: 'Back to the homepage' })).toHaveAttribute('href', '/')
  })

  it('关键词只有空白时同样是引导态', async () => {
    await renderSearch({ q: '   ' })

    expect(screen.getByText(/Type the name of a city, a post or an attraction/)).toBeInTheDocument()
    expect(groupHeadings()).toEqual([])
  })

  it('命中多类时分组顺序固定为编辑推荐、帖子、景点', async () => {
    await renderSearch({ q: '成都' })

    expect(groupHeadings()).toEqual(["Editor's picks", 'Posts', 'Attractions'])
    expect(screen.getByText('4 results for “成都”.')).toBeInTheDocument()
  })

  it('回显的关键词去掉首尾空白', async () => {
    await renderSearch({ q: '   成都  ' })

    expect(screen.getByText('4 results for “成都”.')).toBeInTheDocument()
    expect(screen.queryByText(/“   成都  ”/)).not.toBeInTheDocument()
  })

  it('零命中渲染空态与回首页入口', async () => {
    await renderSearch({ q: 'zzz' })

    expect(screen.getByText('Nothing found for “zzz”.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the homepage' })).toHaveAttribute('href', '/')
    expect(groupHeadings()).toEqual([])
  })

  it('含引号、尖括号与脚本标签的关键词按纯文本回显', async () => {
    const payload = '<script>alert("x")</script> & <b>bold</b>'

    const { container } = await renderSearch({ q: payload })

    expect(screen.getByText(`Nothing found for “${payload}”.`)).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<script>alert("x")</script>')
  })

  it('每组都带回首页对应区块的锚点', async () => {
    await renderSearch({ q: '成都' })

    expect(screen.getByRole('link', { name: /See editor picks on the homepage/ })).toHaveAttribute(
      'href',
      '/#editor-picks',
    )
    expect(screen.getByRole('link', { name: /See trending posts on the homepage/ })).toHaveAttribute(
      'href',
      '/#hot-posts',
    )
    expect(
      screen.getByRole('link', { name: /See popular attractions on the homepage/ }),
    ).toHaveAttribute('href', '/#hot-attractions')
  })

  it('结果条目本身不是链接', async () => {
    await renderSearch({ q: '成都' })

    const listItems = document.querySelectorAll('[aria-labelledby^="search-group-"] li')
    expect(listItems.length).toBe(4)
    for (const item of Array.from(listItems)) {
      expect(item.querySelector('a')).toBeNull()
    }
  })

  it('展示组名、条数与城市英文名', async () => {
    await renderSearch({ q: '成都' })

    const postGroup = screen.getByRole('region', { name: 'Posts' })
    expect(within(postGroup).getByText('2')).toBeInTheDocument()
    expect(
      within(postGroup).getByText('Two days around Chengdu: old towns and bamboo groves'),
    ).toBeInTheDocument()
    expect(within(postGroup).getAllByText(/^Chengdu · /).length).toBe(2)
  })

  it('服务端渲染：唯一 h1、含页头页脚、零 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await renderSearch({ q: '成都' })

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Search the site')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('英文关键词的结果页不含中文字符', async () => {
    const { container } = await renderSearch({ q: 'chengdu' })

    expect(HAN.test(container.textContent ?? '')).toBe(false)
  })
})
