import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import type { AttractionSummary } from '@/lib/attractions/types'
import SearchPage from './page'

vi.mock('@/lib/attractions/server', () => ({
  listAttractionsForSearch: vi.fn(),
}))

const replaceMock = vi.hoisted(() => vi.fn())

const HAN = /\p{Script=Han}/u

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

const { listAttractionsForSearch } = await import('@/lib/attractions/server')
const listAttractions = vi.mocked(listAttractionsForSearch)

type Params = Record<string, string | string[] | undefined>

/** 与后端返回同形的景点数据；搜索页只消费这一层，不关心数据从哪来。 */
const ATTRACTIONS: AttractionSummary[] = [
  {
    publicId: '01JQATTR000000000000000006',
    nameEn: 'Kuanzhai Alley',
    nameCn: '宽窄巷子',
    city: 'chengdu',
    coverUrl: '',
    rating: 4.6,
    viewCount: 18600,
    publishedAt: '2026-09-01T00:00:00+08:00',
    freeEntry: true,
    bookingRequired: false,
    openOnMonday: true,
  },
  {
    publicId: '01JQATTR000000000000000007',
    nameEn: 'Shamian Island',
    nameCn: '沙面岛',
    city: 'guangzhou',
    coverUrl: '',
    rating: 4.4,
    viewCount: 9800,
    publishedAt: '2026-09-02T00:00:00+08:00',
    freeEntry: true,
    bookingRequired: false,
    openOnMonday: true,
  },
]

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
  vi.unstubAllGlobals()
  replaceMock.mockClear()
  localStorage.clear()
})

// 顶栏挂载就会探测一次会话（GET /api/auth/me）。这里把它桩成访客态：
// 页面自身不直接联网，景点取数走 `lib/attractions/server` 模块（本文件把它桩掉）。
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
  listAttractions.mockReset()
  listAttractions.mockResolvedValue(ATTRACTIONS)
})

describe('站内搜索结果页', () => {
  it('没有关键词时渲染引导态且不出结果分组', async () => {
    await renderSearch()

    expect(screen.getByText(/Type the name of a city, a post or an attraction/)).toBeInTheDocument()
    expect(groupHeadings()).toEqual([])
    expect(screen.getByRole('link', { name: 'Back to the homepage' })).toHaveAttribute('href', '/')
    // 引导态没有关键词可搜，不去打扰后端。
    expect(listAttractions).not.toHaveBeenCalled()
  })

  it('关键词只有空白时同样是引导态', async () => {
    await renderSearch({ q: '   ' })

    expect(screen.getByText(/Type the name of a city, a post or an attraction/)).toBeInTheDocument()
    expect(groupHeadings()).toEqual([])
    expect(listAttractions).not.toHaveBeenCalled()
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

  it('景点不可达时该分组缺席，编辑推荐与帖子照常', async () => {
    // `listAttractionsForSearch` 失败一律返回空数组：景点降级缺席，其余分组不受影响。
    listAttractions.mockResolvedValue([])

    await renderSearch({ q: '成都' })

    expect(groupHeadings()).toEqual(["Editor's picks", 'Posts'])
    expect(screen.getByText('3 results for “成都”.')).toBeInTheDocument()
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

  it('景点条目可点进详情页，其余条目不是链接', async () => {
    await renderSearch({ q: '成都' })

    const attraction = screen.getByRole('link', { name: 'Kuanzhai Alley' })
    expect(attraction).toHaveAttribute('href', '/attractions/01JQATTR000000000000000006')

    // 编辑推荐与帖子暂无详情页：条目里不放没有去处的链接。
    const editorGroup = screen.getByRole('region', { name: "Editor's picks" })
    const postGroup = screen.getByRole('region', { name: 'Posts' })
    expect(editorGroup.querySelectorAll('a[href^="/attractions/"]')).toHaveLength(0)
    expect(postGroup.querySelectorAll('a[href^="/attractions/"]')).toHaveLength(0)
    // 搜索结果引用的 publicId 全部来自后端列表，不拿 Mock 的数值 id 拼地址。
    expect(document.querySelectorAll('a[href^="/attractions/"]')).toHaveLength(1)
  })

  it('展示组名、条数与城市英文名', async () => {
    await renderSearch({ q: '成都' })

    const postGroup = screen.getByRole('region', { name: 'Posts' })
    expect(within(postGroup).getByText('2')).toBeInTheDocument()
    expect(
      within(postGroup).getByText('Two days around Chengdu: old towns and bamboo groves'),
    ).toBeInTheDocument()
    expect(within(postGroup).getAllByText(/^Chengdu · /).length).toBe(2)

    const attractionGroup = screen.getByRole('region', { name: 'Attractions' })
    expect(within(attractionGroup).getByText('Chengdu · Rating 4.6 · 18,600 views')).toBeInTheDocument()
  })

  it('服务端渲染：唯一 h1、含页头页脚，景点只取一次', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await renderSearch({ q: '成都' })

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Search the site')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(listAttractions).toHaveBeenCalledTimes(1)
    const beyondSessionProbe = fetchSpy.mock.calls.filter(
      ([url]) => String(url) !== '/api/auth/me',
    )
    expect(beyondSessionProbe).toEqual([])
  })

  it('英文关键词的结果页不含中文字符', async () => {
    const { container } = await renderSearch({ q: 'chengdu' })

    expect(HAN.test(container.textContent ?? '')).toBe(false)
  })
})
