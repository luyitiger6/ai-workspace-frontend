'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from './travel-popover.module.css'

export interface TravelPopoverRenderProps {
  /** 打开时才为 true；面板内容常驻 DOM，据此决定是否发起取数。 */
  isOpen: boolean
  /** 关闭并把焦点归还触发器，供面板内的关闭按钮调用。 */
  close: () => void
}

interface TravelPopoverProps {
  label: string
  icon: ReactNode
  triggerTestId: string
  panelTestId: string
  children: (props: TravelPopoverRenderProps) => ReactNode
}

/**
 * 头部旅行工具的非模态浮层底座（design D8）。
 *
 * 与 AI 助手面板的区别是刻意的：那两个是模态对话框（锁滚动、焦点陷阱），
 * 天气与汇率是「随手查一下就走」的小工具，锁滚动反而打断浏览。
 * 所以这里不设 `aria-modal`、不装焦点陷阱、不动 `body.style.overflow`，
 * 只保留 Escape 关闭与焦点归还——这两条是键盘可用性的底线，不是模态专属。
 *
 * 面板常驻 DOM 并用 `hidden` 切换可见性，为的是 `aria-controls` 始终指向一个
 * 真实存在的元素；条件渲染会让这个属性在关闭时指向空气。
 */
export function TravelPopover({
  label,
  icon,
  triggerTestId,
  panelTestId,
  children,
}: TravelPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false)
    if (restoreFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  /**
   * 把面板夹回视口内。
   *
   * 面板靠 CSS 的 `right: 0` 右对齐触发器，只能对齐、感知不到溢出：
   * 触发器靠左时（窄屏下它在工具栏最前面），面板会整体顶出视口左边界。
   * 这里在布局阶段量一次真实位置，溢出就横向平移回来；不溢出不写任何样式。
   */
  const clampToViewport = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    panel.style.transform = ''
    const rect = panel.getBoundingClientRect()
    // 尚未参与布局（隐藏或测试环境无尺寸）时没有可纠正的溢出
    if (rect.width === 0) return
    const margin = 8
    const viewport = document.documentElement.clientWidth
    // 未布局环境（无宽度信息）下算不出真实边界，宁可不写也不写个错的
    if (viewport === 0) return
    let shift = 0
    if (rect.left < margin) {
      shift = margin - rect.left
    } else if (rect.right > viewport - margin) {
      shift = viewport - margin - rect.right
    }
    if (shift !== 0) {
      panel.style.transform = `translateX(${shift}px)`
    }
  }, [])

  // 打开时先归位再量：上一次的平移不能让这一次的量值偏离真实布局位置。
  useLayoutEffect(() => {
    if (!isOpen) return
    clampToViewport()
  }, [isOpen, clampToViewport])

  // 旋转屏幕或拖窄窗口后，之前算出来的平移可能不再成立。
  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('resize', clampToViewport)
    return () => window.removeEventListener('resize', clampToViewport)
  }, [isOpen, clampToViewport])

  // Escape 只在展开期间挂监听，避免整页常驻一个空转的键盘处理器。
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  // 点击面板之外收起。这里不归还焦点：用户正要点别处，抢回触发器等于吞掉这次点击。
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: PointerEvent) {
      const wrapper = wrapperRef.current
      if (wrapper && !wrapper.contains(event.target as Node)) {
        close(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen, close])

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        data-testid={triggerTestId}
      >
        {icon}
      </button>

      <div
        id={panelId}
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-label={label}
        hidden={!isOpen}
        data-testid={panelTestId}
      >
        {children({ isOpen, close: () => close() })}
      </div>
    </div>
  )
}
