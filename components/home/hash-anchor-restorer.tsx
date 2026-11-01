'use client'

import { useEffect } from 'react'

/** 校正的最长观察时长：超过后交给浏览器原生锚点行为，不再干预。 */
const MAX_SETTLE_MS = 3_000
/** 连续这么多帧目标位置不再变化，视为布局稳定并收工。 */
const STABLE_FRAMES = 3
/** 小于该偏差视为已对齐，避免 1px 抖动引发滚动。 */
const TOLERANCE_PX = 2

/** 从 location.hash 解析目标元素 id；空 hash 或只含 `#` 返回空串。 */
export function hashTargetId(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (raw === '') {
    return ''
  }
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * 把目标对齐到吸顶头部下沿所需的滚动位置。
 * 头部是 sticky，窄屏换行后会更高，所以偏移由调用方传入实测高度而不是常量。
 */
export function anchorScrollTop(rectTop: number, scrollY: number, headerHeight: number): number {
  return Math.max(0, Math.round(rectTop + scrollY - headerHeight))
}

/** 会滚动页面的按键属于用户主动操作，校正应当立刻让位。 */
export function isScrollKey(key: string): boolean {
  return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(key)
}

/**
 * 锚点落位补偿：从搜索页回链或直接带 hash 打开首页时，浏览器/Next 的滚动发生在
 * 区块数据就绪之前，加载占位换成真实列表后目标区块会被上方内容顶到视口之外。
 * 这里在布局稳定前持续把目标对回吸顶头部下沿，用户一动手就停。
 */
export function HashAnchorRestorer() {
  useEffect(() => {
    let stop: (() => void) | null = null

    const begin = () => {
      stop?.()
      stop = watchAnchor()
    }

    begin()
    window.addEventListener('hashchange', begin)
    window.addEventListener('popstate', begin)

    return () => {
      window.removeEventListener('hashchange', begin)
      window.removeEventListener('popstate', begin)
      stop?.()
    }
  }, [])

  return null
}

function watchAnchor(): () => void {
  const id = hashTargetId(window.location.hash)
  const target = id === '' ? null : document.getElementById(id)
  if (target === null) {
    return () => {}
  }

  let stopped = false
  let frame = 0
  let stableFrames = 0
  /** 上次被文档尽头夹住时的文档高度：高度没变之前不重复下发同一次滚动。 */
  let clampedAtHeight = -1
  let observer: ResizeObserver | null = null
  const deadline = performance.now() + MAX_SETTLE_MS

  const disconnect = () => {
    window.removeEventListener('wheel', finish)
    window.removeEventListener('touchstart', finish)
    window.removeEventListener('keydown', onKeyDown)
    observer?.disconnect()
    cancelAnimationFrame(frame)
  }

  function finish() {
    if (stopped) {
      return
    }
    stopped = true
    disconnect()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (isScrollKey(event.key)) {
      finish()
    }
  }

  const align = (): number => {
    const header = document.querySelector('header')
    const headerHeight = header === null ? 0 : header.getBoundingClientRect().height
    const top = anchorScrollTop(target!.getBoundingClientRect().top, window.scrollY, headerHeight)
    const docHeight = document.documentElement.scrollHeight
    // 页尾区块所需的滚动位置可能超过文档尽头：此时浏览器会把滚动夹住，
    // 记下当时的文档高度，等布局变长再追，避免对着同一个夹住的数值反复下发。
    if (Math.abs(window.scrollY - top) > TOLERANCE_PX && docHeight !== clampedAtHeight) {
      window.scrollTo({ top, behavior: 'auto' })
      if (Math.abs(window.scrollY - top) > TOLERANCE_PX) {
        clampedAtHeight = docHeight
      }
    }
    return top
  }

  const tick = () => {
    if (stopped) {
      return
    }

    const desired = align()
    // 判据是「真的到位」，不是「期望位置没变」：区块被夹在文档尽头时期望值
    // 本来就恒等，只盯着它会让校正提前收工，随后文档变长就永远差那一截。
    if (Math.abs(window.scrollY - desired) <= TOLERANCE_PX) {
      stableFrames += 1
    } else {
      stableFrames = 0
    }

    if (stableFrames >= STABLE_FRAMES || performance.now() > deadline) {
      finish()
      return
    }

    frame = requestAnimationFrame(tick)
  }

  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(() => {
      // 内容高度变化：稳定性重新计数，让下一帧继续对齐。
      stableFrames = 0
    })
    observer.observe(document.body)
  }

  window.addEventListener('wheel', finish, { passive: true })
  window.addEventListener('touchstart', finish, { passive: true })
  window.addEventListener('keydown', onKeyDown)

  frame = requestAnimationFrame(tick)

  return finish
}
