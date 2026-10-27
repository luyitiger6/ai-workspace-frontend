import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiAssistantProvider, AiAssistantTrigger, useAiAssistant } from './ai-assistant'

function renderAssistant() {
  return render(
    <AiAssistantProvider>
      <AiAssistantTrigger variant="header" />
      <AiAssistantTrigger variant="floating" />
    </AiAssistantProvider>,
  )
}

describe('上下文约束', () => {
  it('Provider 外调用 useAiAssistant 抛出固定英文文案', () => {
    expect(() => renderHook(() => useAiAssistant())).toThrow(
      'useAiAssistant must be used inside AiAssistantProvider',
    )
  })
})

describe('AI 助手入口', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.style.overflow = ''
  })

  it('顶部入口打开 AI 助手面板', () => {
    renderAssistant()

    fireEvent.click(screen.getByTestId('ai-header'))

    expect(screen.getByRole('dialog', { name: 'AI travel assistant' })).toBeInTheDocument()
    expect(screen.getByText(/Real conversation is being wired up/)).toBeInTheDocument()
  })

  it('悬浮按钮与顶部入口打开同一个面板', () => {
    renderAssistant()

    fireEvent.click(screen.getByTestId('ai-floating'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close the AI assistant' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('ai-header'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'AI travel assistant' })).toBeInTheDocument()
  })

  it('点击关闭按钮收起面板', () => {
    renderAssistant()
    fireEvent.click(screen.getByTestId('ai-header'))

    fireEvent.click(screen.getByRole('button', { name: 'Close the AI assistant' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('模态约束', () => {
    it('两个入口打开后焦点都落在关闭按钮上', () => {
      for (const testId of ['ai-header', 'ai-floating']) {
        const { unmount } = renderAssistant()

        fireEvent.click(screen.getByTestId(testId))

        expect(screen.getByRole('button', { name: 'Close the AI assistant' })).toHaveFocus()
        unmount()
      }
    })

    it('Tab 在最后一个元素上回到第一个', () => {
      renderAssistant()
      fireEvent.click(screen.getByTestId('ai-header'))

      const closeButton = screen.getByRole('button', { name: 'Close the AI assistant' })
      const confirmButton = screen.getByRole('button', { name: 'Got it' })

      confirmButton.focus()
      expect(confirmButton).toHaveFocus()

      fireEvent.keyDown(document, { key: 'Tab' })

      expect(closeButton).toHaveFocus()
    })

    it('Shift+Tab 在第一个元素上回到最后一个', () => {
      renderAssistant()
      fireEvent.click(screen.getByTestId('ai-header'))

      const closeButton = screen.getByRole('button', { name: 'Close the AI assistant' })
      const confirmButton = screen.getByRole('button', { name: 'Got it' })

      closeButton.focus()
      expect(closeButton).toHaveFocus()

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

      expect(confirmButton).toHaveFocus()
    })

    it('四种关闭方式都把焦点还给触发元素', () => {
      const closers: Array<[string, () => void]> = [
        ['关闭按钮', () => fireEvent.click(screen.getByRole('button', { name: 'Close the AI assistant' }))],
        ['Got it 按钮', () => fireEvent.click(screen.getByRole('button', { name: 'Got it' }))],
        ['Esc', () => fireEvent.keyDown(document, { key: 'Escape' })],
        ['点击遮罩', () => fireEvent.click(screen.getByTestId('ai-overlay'))],
      ]

      for (const [, closePanel] of closers) {
        const { unmount } = renderAssistant()
        const trigger = screen.getByTestId('ai-header')

        trigger.focus()
        fireEvent.click(trigger)
        expect(screen.getByRole('dialog')).toBeInTheDocument()

        closePanel()

        expect(trigger).toHaveFocus()
        unmount()
      }
    })

    it('打开期间锁定背景滚动，关闭后恢复原值', () => {
      document.body.style.overflow = 'scroll'

      renderAssistant()
      fireEvent.click(screen.getByTestId('ai-header'))

      expect(document.body.style.overflow).toBe('hidden')

      fireEvent.click(screen.getByRole('button', { name: 'Got it' }))

      expect(document.body.style.overflow).toBe('scroll')
    })

    it('面板打开时卸载也恢复背景滚动原值', () => {
      document.body.style.overflow = 'scroll'

      const { unmount } = renderAssistant()
      fireEvent.click(screen.getByTestId('ai-header'))

      expect(document.body.style.overflow).toBe('hidden')

      unmount()

      expect(document.body.style.overflow).toBe('scroll')
    })
  })
})
