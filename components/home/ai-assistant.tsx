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
    throw new Error('useAiAssistant 必须在 AiAssistantProvider 内使用')
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

/** AI 助手为纯前端占位：只有打开/关闭，不发起任何网络请求。 */
export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

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

    closeButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  return (
    <AiAssistantContext.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen ? (
        <div className={styles.overlay} data-testid="ai-overlay" onClick={close}>
          <section
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-assistant-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.panelHead}>
              <span className={styles.badge}>即将上线</span>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={close}
                aria-label="关闭 AI 助手"
              >
                ×
              </button>
            </div>
            <h2 id="ai-assistant-title" className={styles.panelTitle}>
              AI 旅行助手
            </h2>
            <p className={styles.panelText}>
              真实对话能力正在接入。之后你可以让它按城市生成行程、比较景点，或者替你算一笔旅行预算。
            </p>
            <ul className={styles.capabilities}>
              <li>按城市生成三日行程</li>
              <li>比较景点的适合季节与人流</li>
              <li>按预算调整住宿与交通</li>
            </ul>
            <p className={styles.note}>当前是纯前端占位入口，不会发送任何请求。</p>
            <button type="button" className="wc-button wc-button--primary" onClick={close}>
              知道了
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
        aria-label="打开 AI 助手"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        data-testid="ai-floating"
      >
        <SparkIcon />
        <span className={styles.floatingText}>AI 助手</span>
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
      AI 助手
    </button>
  )
}
