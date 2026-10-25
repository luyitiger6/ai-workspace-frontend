import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiAssistantProvider, AiAssistantTrigger } from './ai-assistant'

function renderAssistant() {
  return render(
    <AiAssistantProvider>
      <AiAssistantTrigger variant="header" />
      <AiAssistantTrigger variant="floating" />
    </AiAssistantProvider>,
  )
}

describe('AI 助手入口', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('顶部入口打开 AI 助手面板', () => {
    renderAssistant()

    fireEvent.click(screen.getByTestId('ai-header'))

    expect(screen.getByRole('dialog', { name: 'AI 旅行助手' })).toBeInTheDocument()
    expect(screen.getByText(/真实对话能力正在接入/)).toBeInTheDocument()
  })

  it('悬浮按钮与顶部入口打开同一个面板', () => {
    renderAssistant()

    fireEvent.click(screen.getByTestId('ai-floating'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 助手' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('ai-header'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'AI 旅行助手' })).toBeInTheDocument()
  })

  it('点击关闭按钮收起面板', () => {
    renderAssistant()
    fireEvent.click(screen.getByTestId('ai-header'))

    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 助手' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('按 Esc 收起面板', () => {
    renderAssistant()
    fireEvent.click(screen.getByTestId('ai-header'))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('点击遮罩收起面板', () => {
    renderAssistant()
    fireEvent.click(screen.getByTestId('ai-header'))

    fireEvent.click(screen.getByTestId('ai-overlay'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('打开与关闭全程不发起任何网络请求', () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    renderAssistant()

    fireEvent.click(screen.getByTestId('ai-floating'))
    fireEvent.click(screen.getByRole('button', { name: '知道了' }))

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
