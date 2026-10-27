import { describe, expect, it } from 'vitest'
import RootLayout, { metadata } from './layout'

const HAN = /\p{Script=Han}/u

describe('根布局语言与元数据', () => {
  it('html 元素的 lang 为 en', () => {
    const element = RootLayout({ children: null })
    expect(element.type).toBe('html')
    expect(element.props.lang).toBe('en')
  })

  it('标题、描述与 openGraph 都是英文且不含中文', () => {
    const title = metadata.title as { default: string; template: string }
    expect(title.default).toBe('wanderchain · Turn a wish into a route')
    expect(HAN.test(title.default)).toBe(false)

    expect(typeof metadata.description).toBe('string')
    expect(HAN.test(metadata.description as string)).toBe(false)

    expect(HAN.test(metadata.openGraph?.title as string)).toBe(false)
    expect(HAN.test(metadata.openGraph?.description as string)).toBe(false)
  })
})
