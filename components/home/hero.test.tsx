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
    expect(heading).toHaveTextContent('Turn a place you want to see into a route you can start today.')
    expect(screen.getByRole('region', { name: /Turn a place you want to see/ })).toBeInTheDocument()
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

    const input = screen.getByLabelText('Search cities, posts or attractions')
    expect(input).toHaveAttribute('name', 'q')
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toBeRequired()
    expect(within(form).getByRole('button', { name: 'Search' })).toHaveAttribute('type', 'submit')
  })

  it('三个站内入口与页内锚点指向固定', () => {
    render(<HomeHero />)

    expect(screen.getByRole('link', { name: 'Enter the travel community' })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: 'Browse attraction guides' })).toHaveAttribute('href', '/attractions')
    expect(screen.getByRole('link', { name: /Browse by city/ })).toHaveAttribute('href', '#cities')
  })

  it('城市规模提示与城市白名单一致', () => {
    render(<HomeHero />)

    expect(screen.getByText(/re-walked by our editors every week/)).toHaveTextContent(
      `${CITY_COUNT} cities`,
    )
  })

  it('不再展示任何由列表上限派生的数值', () => {
    render(<HomeHero />)

    const region = screen.getByRole('region', { name: /Turn a place you want to see/ })
    expect(within(region).queryByRole('listitem')).toBeNull()
    expect(within(region).queryByRole('list')).toBeNull()
  })

  it('渲染期间不发起任何网络请求', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<HomeHero />)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
