import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SectionBoundary } from './section-boundary'

function Bomb(): never {
  throw new Error('render failure')
}

describe('SectionBoundary', () => {
  beforeEach(() => {
    // React 会把被边界捕获的错误打印到 console.error，测试内静音避免噪音。
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染期异常被捕获，只降级自身', () => {
    render(
      <div>
        <SectionBoundary title="Hot posts">
          <Bomb />
        </SectionBoundary>
        <p>sibling section</p>
      </div>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hot posts could not load. Please try again later.',
    )
    expect(screen.getByText('sibling section')).toBeInTheDocument()
  })

  it('降级文案带出各自区块标题', () => {
    render(
      <>
        <SectionBoundary title="Editor's picks">
          <Bomb />
        </SectionBoundary>
        <SectionBoundary title="Hot attractions">
          <Bomb />
        </SectionBoundary>
      </>,
    )

    const alerts = screen.getAllByRole('alert')

    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent(
      "Editor's picks could not load. Please try again later.",
    )
    expect(alerts[1]).toHaveTextContent(
      'Hot attractions could not load. Please try again later.',
    )
  })

  it('正常内容原样渲染，不出现降级文案', () => {
    render(
      <SectionBoundary title="Hot posts">
        <p>loaded content</p>
      </SectionBoundary>,
    )

    expect(screen.getByText('loaded content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
