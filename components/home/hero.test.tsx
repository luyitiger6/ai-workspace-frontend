import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CITIES } from '@/lib/home/cities'
import {
  EDITOR_PICKS_LIMIT,
  HOT_ATTRACTIONS_LIMIT,
  HOT_POSTS_LIMIT,
} from '@/lib/home/repository'
import { HomeHero, type HeroStat } from './hero'

const DEFAULT_OVERVIEW = [
  `城市入口${CITIES.length}`,
  `编辑推荐${EDITOR_PICKS_LIMIT}`,
  `热门帖子${HOT_POSTS_LIMIT}`,
  `热门景点${HOT_ATTRACTIONS_LIMIT}`,
]

function overviewText(): (string | null)[] {
  return screen.getAllByRole('listitem').map((item) => item.textContent)
}

describe('首页主视觉', () => {
  it('默认概览按固定顺序取数据契约常量', () => {
    render(<HomeHero />)

    expect(overviewText()).toEqual(DEFAULT_OVERVIEW)
  })

  it('提供完全合法的概览入参时整组采用', () => {
    const stats: HeroStat[] = [
      { label: '城市入口', value: 3 },
      { label: '编辑推荐', value: 4 },
      { label: '热门帖子', value: 5 },
      { label: '热门景点', value: 6 },
    ]
    const snapshot = stats.map((stat) => ({ ...stat }))

    render(<HomeHero stats={stats} />)

    expect(overviewText()).toEqual(['城市入口3', '编辑推荐4', '热门帖子5', '热门景点6'])
    expect(stats).toEqual(snapshot)
  })

  it('概览入参不合格时整组回退，不拼接半套数据', () => {
    const errorSpy = vi.spyOn(console, 'error')
    const invalid: HeroStat[][] = [
      [],
      [{ label: '城市入口', value: 1 }],
      [
        { label: '城市入口', value: 1 },
        { label: '编辑推荐', value: 2 },
        { label: '热门帖子', value: 3 },
        { label: '热门景点', value: 4 },
        { label: '城市入口', value: 5 },
      ],
      [
        { label: '编辑推荐', value: 1 },
        { label: '城市入口', value: 1 },
        { label: '热门帖子', value: 1 },
        { label: '热门景点', value: 1 },
      ],
      [
        { label: '城市入口', value: -1 },
        { label: '编辑推荐', value: 4 },
        { label: '热门帖子', value: 5 },
        { label: '热门景点', value: 6 },
      ],
      [
        { label: '城市入口', value: 1.5 },
        { label: '编辑推荐', value: 4 },
        { label: '热门帖子', value: 5 },
        { label: '热门景点', value: 6 },
      ],
      [
        { label: '城市入口', value: Number.NaN },
        { label: '编辑推荐', value: 4 },
        { label: '热门帖子', value: 5 },
        { label: '热门景点', value: 6 },
      ],
    ]

    for (const stats of invalid) {
      const { unmount } = render(<HomeHero stats={stats} />)

      expect(overviewText()).toEqual(DEFAULT_OVERVIEW)
      unmount()
    }

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('三个入口分别指向社区、景点与页内城市锚点', () => {
    render(<HomeHero />)

    expect(screen.getByRole('link', { name: '进入旅游社区' })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: '查看景点攻略' })).toHaveAttribute(
      'href',
      '/attractions',
    )
    expect(screen.getByRole('link', { name: /按城市逛/ })).toHaveAttribute('href', '#cities')
  })

  it('以 h1 命名自身区域', () => {
    render(<HomeHero />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('把想去的地方，走成一条能出发的路线。')
    expect(screen.getByRole('region', { name: heading.textContent ?? '' })).toBeInTheDocument()
  })

  it('不发起任何网络请求', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<HomeHero />)

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
