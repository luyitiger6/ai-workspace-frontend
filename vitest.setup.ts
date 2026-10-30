import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // jsdom 不提供 IntersectionObserver，为无限滚动测试提供最小 mock
  const observers = new Map<Element, IntersectionObserverCallback>()

  class MockIntersectionObserver implements IntersectionObserver {
    root: Document | Element | null = null
    rootMargin = '0px'
    scrollMargin = '0px'
    thresholds: readonly number[] = [0]

    constructor(callback: IntersectionObserverCallback) {
      observers.set(this as unknown as Element, callback)
    }

    observe(target: Element): void {
      // 测试通过调用 triggerIntersection 手动触发回调
      ;(target as unknown as { __observerCallback: IntersectionObserverCallback }).__observerCallback =
        observers.get(this as unknown as Element) as IntersectionObserverCallback
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  ;(globalThis as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver
  ;(globalThis as Record<string, unknown>).triggerIntersection = (
    target: Element,
    isIntersecting: boolean,
  ) => {
    const callback = (target as unknown as { __observerCallback?: IntersectionObserverCallback })
      .__observerCallback
    if (!callback) {
      return
    }
    callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
      ],
      new MockIntersectionObserver(callback),
    )
  }
})

// Vitest 未开启 globals，RTL 的自动清理不会注册，需显式在用例间卸载组件
afterEach(() => {
  cleanup()
})
