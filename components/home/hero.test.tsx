import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CITIES } from '@/lib/home/cities'
import { HomeHero } from './hero'

const CITY_COUNT = CITIES.filter((city) => city.slug !== 'all').length

afterEach(() => {
  vi.restoreAllMocks()
})

describe('首屏主视觉与站内搜索入口', () => {
  it('以 h1 命名自身区域，且标题文案不变', () => {
    render(<HomeHero />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('把想去的地方，走成一条能出发的路线。')
    expect(screen.getByRole('region', { name: /把想去的地方/ })).toBeInTheDocument()
  })

  it('背景大图是纯装饰，并声明满宽 sizes', () => {
    const { container } = render(<HomeHero />)

    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('alt', '')
    expect(image).toHaveAttribute('sizes', '100vw')
  })

  it('搜索框用原生 GET 表单提交到 /search，参数名为 q', () => {
    render(<HomeHero />)

    const form = screen.getByRole('search')
    expect(form.tagName).toBe('FORM')
    expect(form).toHaveAttribute('method', 'get')
    expect(form).toHaveAttribute('action', '/search')

    const input = screen.getByLabelText('搜索城市、帖子或景点')
    expect(input).toHaveAttribute('name', 'q')
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toBeRequired()
    expect(within(form).getByRole('button', { name: '搜索' })).toHaveAttribute('type', 'submit')
  })

  it('三个站内入口与页内锚点指向固定', () => {
    render(<HomeHero />)

    expect(screen.getByRole('link', { name: '进入旅游社区' })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: '查看景点攻略' })).toHaveAttribute('href', '/attractions')
    expect(screen.getByRole('link', { name: /按城市逛/ })).toHaveAttribute('href', '#cities')
  })

  it('城市规模提示与城市白名单一致', () => {
    render(<HomeHero />)

    expect(screen.getByText(/每周由编辑重新走一遍/)).toHaveTextContent(`${CITY_COUNT} 座城市`)
  })

  it('不再展示任何由列表上限派生的数值', () => {
    render(<HomeHero />)

    const region = screen.getByRole('region', { name: /把想去的地方/ })
    expect(within(region).queryByRole('listitem')).toBeNull()
    expect(within(region).queryByText('本期一览')).toBeNull()
  })

  it('渲染期间不发起任何网络请求', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<HomeHero />)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
