import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState, SectionError, SectionLoading } from './section-state'

describe('区块三态展示', () => {
  it('加载态使用 role="status" 并暴露加载文案', () => {
    render(<SectionLoading label="Gathering attraction data…" />)

    const status = screen.getByRole('status')

    expect(status).toHaveTextContent('Gathering attraction data…')
  })

  it('加载态装饰元素对辅助技术隐藏', () => {
    const { container } = render(<SectionLoading label="Loading" />)

    expect(container.querySelector('span')).toHaveAttribute('aria-hidden', 'true')
  })

  it('错误态使用 role="alert"', () => {
    render(<SectionError message="Hot posts could not load." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Hot posts could not load.')
  })

  it('空态不占用 status 或 alert 角色', () => {
    render(<EmptyState message="Nothing here yet." />)

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
