'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import styles from './ai-assistant.module.css'

interface AiAssistantContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null)

export function useAiAssistant(): AiAssistantContextValue {
  const value = useContext(AiAssistantContext)
  if (!value) {
    throw new Error('useAiAssistant must be used inside AiAssistantProvider')
  }
  return value
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
    </svg>
  )
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** 运行期查询而非缓存：面板内容会随对话能力上线而新增控件，写死 ref 列表会静默漏掉新元素。 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/** AI 助手为纯前端占位：只有打开/关闭，不发起任何网络请求。 */
export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  // 焦点移入、焦点归还与背景滚动锁都由规格约束（见「AI 助手面板的模态约束」），不是可随手删掉的实现细节。
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  const open = useCallback(() => {
    const active = typeof document === 'undefined' ? null : document.activeElement
    restoreFocusRef.current = active instanceof HTMLElement ? active : null
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    const target = restoreFocusRef.current
    restoreFocusRef.current = null
    target?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // 保存原值并原样恢复：原值是空字符串时也要恢复成空字符串，不能写成 'auto' 覆盖调用方的声明。
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const panel = panelRef.current
      if (!panel) {
        return
      }

      const focusable = getFocusableElements(panel)
      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, close])

  return (
    <AiAssistantContext.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen ? (
        <div className={styles.overlay} data-testid="ai-overlay" onClick={close}>
          <section
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-assistant-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.panelHead}>
              <span className={styles.badge}>Coming soon</span>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={close}
                aria-label="Close the AI assistant"
              >
                ×
              </button>
            </div>
            <h2 id="ai-assistant-title" className={styles.panelTitle}>
              AI travel assistant
            </h2>
            <p className={styles.panelText}>
              Real conversation is being wired up. Soon you will be able to ask for a city
              itinerary, compare attractions, or price out a trip.
            </p>
            <ul className={styles.capabilities}>
              <li>Build a three-day itinerary for any city</li>
              <li>Compare attractions by season and crowds</li>
              <li>Fit stays and transport to your budget</li>
            </ul>
            <p className={styles.note}>This is a front-end placeholder. It sends no requests.</p>
            <button type="button" className="wc-button wc-button--primary" onClick={close}>
              Got it
            </button>
          </section>
        </div>
      ) : null}
    </AiAssistantContext.Provider>
  )
}

export function AiAssistantTrigger({ variant }: { variant: 'header' | 'floating' }) {
  const { open, isOpen } = useAiAssistant()

  if (variant === 'floating') {
    return (
      <button
        type="button"
        className={styles.floating}
        onClick={open}
        aria-label="Open the AI assistant"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        data-testid="ai-floating"
      >
        <SparkIcon />
        <span className={styles.floatingText}>AI assistant</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={styles.headerTrigger}
      onClick={open}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      data-testid="ai-header"
    >
      <SparkIcon />
      AI assistant
    </button>
  )
}
