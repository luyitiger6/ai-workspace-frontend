import { fireEvent, render, screen } from '@testing-library/react'
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

  it('窄视口下三张卡片都保留在文档中，由 CSS 决定堆叠', () => {
    window.innerWidth = 375
    window.dispatchEvent(new Event('resize'))

    renderNav()

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('list')).toHaveAttribute('data-layout', 'grid')
  })
})
