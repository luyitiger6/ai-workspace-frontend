import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TravelPopover } from './travel-popover'

function popoverElement() {
  return (
    <TravelPopover
      label="Weather"
      triggerTestId="travel-trigger"
      panelTestId="travel-panel"
      icon={<span aria-hidden="true">icon</span>}
    >
      {({ close }) => (
        <div>
          <p>Panel body</p>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      )}
    </TravelPopover>
  )
}

function renderPopover() {
  return render(popoverElement())
}

describe('旅行工具浮层底座', () => {
  it('默认收起，点击触发器展开且 aria 状态同步', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByTestId('travel-trigger')
    const panel = screen.getByTestId('travel-panel')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toBeVisible()
    // aria-controls 必须始终指向一个真实存在的元素，否则屏幕阅读器读到空引用
    expect(trigger).toHaveAttribute('aria-controls', panel.id)

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    expect(screen.getByText('Panel body')).toBeVisible()
  })

  it('再次点击触发器收起', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByTestId('travel-trigger')
    await user.click(trigger)
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('travel-panel')).not.toBeVisible()
  })

  it('Escape 关闭并把焦点归还触发器', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByTestId('travel-trigger')
    await user.click(trigger)
    expect(screen.getByTestId('travel-panel')).toBeVisible()

    await user.keyboard('{Escape}')

    expect(screen.getByTestId('travel-panel')).not.toBeVisible()
    expect(trigger).toHaveFocus()
  })

  it('面板内关闭按钮同样归还焦点', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByTestId('travel-trigger')
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.getByTestId('travel-panel')).not.toBeVisible()
    expect(trigger).toHaveFocus()
  })

  it('点击浮层之外收起，且不抢走用户正在点的位置的焦点', async () => {
    const user = userEvent.setup()
    render(
      <div>
        {popoverElement()}
        <button type="button">Outside</button>
      </div>,
    )

    await user.click(screen.getByTestId('travel-trigger'))
    expect(screen.getByTestId('travel-panel')).toBeVisible()

    const outside = screen.getByRole('button', { name: 'Outside' })
    await user.click(outside)

    expect(screen.getByTestId('travel-panel')).not.toBeVisible()
    expect(outside).toHaveFocus()
  })

  it('不锁页面滚动，也不声明为模态', async () => {
    const user = userEvent.setup()
    renderPopover()

    const panel = screen.getByTestId('travel-panel')
    expect(panel).not.toHaveAttribute('aria-modal')

    await user.click(screen.getByTestId('travel-trigger'))

    // 非模态是 design D8 的硬约束：打开浮层不得污染调用方的 body 样式
    expect(document.body.style.overflow).toBe('')
    expect(panel).not.toHaveAttribute('aria-modal')
  })

  it('面板顶出视口左边界时平移回来', async () => {
    const user = userEvent.setup()
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024)
    renderPopover()
    const panel = screen.getByTestId('travel-panel')

    // 模拟触发器靠近屏幕左侧：面板右对齐后左边缘跑到视口外
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      x: -172, y: 80, left: -172, top: 80, right: 124, bottom: 300, width: 296, height: 220,
      toJSON: () => ({}),
    } as DOMRect)

    await user.click(screen.getByTestId('travel-trigger'))

    // 左边距 8px 是目标位置：-172 需要右移 180px
    expect(panel.style.transform).toBe('translateX(180px)')
  })

  it('面板完全在视口内时不写平移', async () => {
    const user = userEvent.setup()
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024)
    renderPopover()
    const panel = screen.getByTestId('travel-panel')

    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      x: 600, y: 80, left: 600, top: 80, right: 896, bottom: 300, width: 296, height: 220,
      toJSON: () => ({}),
    } as DOMRect)

    await user.click(screen.getByTestId('travel-trigger'))

    expect(panel.style.transform).toBe('')
  })
})