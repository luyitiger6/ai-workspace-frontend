import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HashAnchorRestorer,
  anchorScrollTop,
  hashTargetId,
  isScrollKey,
} from './hash-anchor-restorer'

function rect(top: number, height: number): DOMRect {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

/** 造一个带吸顶头部与目标区块的首页外壳，返回两者以便桩化尺寸。 */
function mountLayout(headerHeight: number, targetTop: number) {
  const header = document.createElement('header')
  const target = document.createElement('section')
  target.id = 'hot-posts'
  document.body.append(header, target)
  header.getBoundingClientRect = () => rect(0, headerHeight)
  target.getBoundingClientRect = () => rect(targetTop, 618)
  return { header, target }
}

describe('锚点落位补偿', () => {
  let frameCallback: FrameRequestCallback | null = null

  beforeEach(() => {
    document.body.replaceChildren()
    window.history.replaceState(null, '', '/')
    frameCallback = null
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallback = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  it('从 hash 解析目标 id，空 hash 与裸 # 返回空串', () => {
    expect(hashTargetId('#hot-posts')).toBe('hot-posts')
    expect(hashTargetId('hot-posts')).toBe('hot-posts')
    expect(hashTargetId('#%E4%B8%AD')).toBe('中')
    expect(hashTargetId('#')).toBe('')
    expect(hashTargetId('')).toBe('')
  })

  it('滚动位置扣掉吸顶头部高度，且不会小于 0', () => {
    expect(anchorScrollTop(1215, 1417, 68)).toBe(2564)
    expect(anchorScrollTop(1215, 1417, 120)).toBe(2512)
    expect(anchorScrollTop(-200, 100, 68)).toBe(0)
  })

  it('只把方向类按键认作用户主动滚动', () => {
    expect(isScrollKey('ArrowDown')).toBe(true)
    expect(isScrollKey('PageUp')).toBe(true)
    expect(isScrollKey(' ')).toBe(true)
    expect(isScrollKey('Tab')).toBe(false)
    expect(isScrollKey('a')).toBe(false)
  })

  it('无锚点时不注册校正、不滚动', () => {
    render(<HashAnchorRestorer />)

    expect(frameCallback).toBeNull()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('有锚点时把目标对齐到吸顶头部下沿', () => {
    mountLayout(68, 1215)
    Object.defineProperty(window, 'scrollY', { value: 1417, configurable: true })
    window.history.replaceState(null, '', '/#hot-posts')

    render(<HashAnchorRestorer />)
    expect(frameCallback).not.toBeNull()

    frameCallback?.(0)

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 2564, behavior: 'auto' })
  })

  it('用户一动手就停止校正', () => {
    mountLayout(68, 1215)
    Object.defineProperty(window, 'scrollY', { value: 1417, configurable: true })
    window.history.replaceState(null, '', '/#hot-posts')

    render(<HashAnchorRestorer />)
    frameCallback?.(0)
    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    fireEvent.wheel(window)
    frameCallback?.(0)

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('被文档尽头夹住后文档变长，仍继续追到新的落点', () => {
    // 回归：页尾区块所需滚动位置超过文档尽头时，期望值恒等曾被当成「稳定」并收工，
    // 随后异步内容把文档撑高，页面就永远停在旧尽头、也够不上「已滚到尽头」的例外。
    const header = document.createElement('header')
    const target = document.createElement('section')
    target.id = 'hot-posts'
    document.body.append(header, target)
    header.getBoundingClientRect = () => rect(0, 68)

    let scrollY = 0
    let docHeight = 768 + 1000
    Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => docHeight,
      configurable: true,
    })
    // 目标在文档中的偏移固定为 1215：视口内 top 随滚动变化，浏览器按文档尽头夹住滚动。
    target.getBoundingClientRect = () => rect(1215 - scrollY, 618)
    vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
      // 浏览器会把越界的目标位置夹到文档尽头，这里手工模拟同一行为。
      const requested = options as ScrollToOptions | number
      const top = typeof requested === 'number' ? requested : (requested.top ?? 0)
      scrollY = Math.min(top, docHeight - 768)
    })
    window.history.replaceState(null, '', '/#hot-posts')

    render(<HashAnchorRestorer />)

    // 前几帧一直卡在 1000：修复前连跑 3 帧就会把「期望值没变」当稳定并收工。
    frameCallback?.(0)
    for (let frame = 0; frame < 3; frame += 1) {
      frameCallback?.(0)
    }
    expect(scrollY).toBe(1000)

    // 文档变长后必须继续追，而不是停在旧尽头。
    docHeight = 768 + 1400
    frameCallback?.(0)
    expect(scrollY).toBe(1147)
  })
})
