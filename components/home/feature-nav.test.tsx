import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiAssistantProvider } from './ai-assistant'
import { FeatureNav } from './feature-nav'

function renderNav() {
  return render(
    <AiAssistantProvider>
      <FeatureNav />
    </AiAssistantProvider>,
  )
}

describe('功能导航栏', () => {
  it('展示旅游社区、景点攻略与 AI 助手三张卡片', () => {
    renderNav()

    expect(screen.getByText('Travel community')).toBeInTheDocument()
    expect(screen.getByText('Attraction guides')).toBeInTheDocument()
    expect(screen.getByText('AI assistant')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('三张卡按固定顺序排列且都含图标、标题、描述与动作', () => {
    renderNav()

    const items = screen.getAllByRole('listitem')
    const expected = [
      ['Travel community', 'See how others got around', 'Enter community'],
      ['Attraction guides', 'Pick a place by city and season', 'Browse guides'],
      ['AI assistant', 'Hand it your itinerary', 'Open the placeholder panel'],
    ] as const

    expect(items).toHaveLength(3)

    items.forEach((item, index) => {
      const [title, description, action] = expected[index]

      expect(within(item).getByText(title)).toBeInTheDocument()
      expect(within(item).getByText(description, { exact: false })).toBeInTheDocument()
      expect(item).toHaveTextContent(`${action} →`)
      expect(item.querySelector('svg')).not.toBeNull()
    })
  })

  it('区块由 h2 命名且三个装饰图标被辅助技术跳过', () => {
    renderNav()

    const section = screen.getByRole('region', { name: 'Where to start' })

    expect(section).toHaveAttribute('aria-labelledby', 'feature-nav-title')
    expect(screen.getByRole('heading', { level: 2, name: 'Where to start' })).toHaveAttribute(
      'id',
      'feature-nav-title',
    )

    const icons = section.querySelectorAll('svg')
    expect(icons).toHaveLength(3)

    for (const icon of Array.from(icons)) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('focusable', 'false')
    }
  })

  it('社区与攻略卡片指向各自的入口地址', () => {
    renderNav()

    expect(screen.getByRole('link', { name: /Travel community/ })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: /Attraction guides/ })).toHaveAttribute('href', '/attractions')
  })

  it('AI 卡片打开占位面板', () => {
    renderNav()

    fireEvent.click(screen.getByRole('button', { name: /AI assistant/ }))

    expect(screen.getByRole('dialog', { name: 'AI travel assistant' })).toBeInTheDocument()
  })

  it('面板已打开时再次点击 AI 卡仍只有一个面板实例', () => {
    renderNav()
    const card = screen.getByRole('button', { name: /AI assistant/ })

    fireEvent.click(card)
    fireEvent.click(card)

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getAllByTestId('ai-overlay')).toHaveLength(1)
  })

  it('窄视口下三张卡片都保留在文档中，由 CSS 决定堆叠', () => {
    window.innerWidth = 375
    window.dispatchEvent(new Event('resize'))

    renderNav()

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('list')).toHaveAttribute('data-layout', 'grid')
  })
})
