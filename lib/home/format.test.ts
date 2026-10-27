import { describe, expect, it } from 'vitest'
import { formatCount, formatDate } from './format'

describe('formatCount', () => {
  it('三位数按原样输出', () => {
    expect(formatCount(999)).toBe('999')
  })

  it('四位数起使用英文千分位', () => {
    expect(formatCount(1000)).toBe('1,000')
    expect(formatCount(12345)).toBe('12,345')
  })

  it('不再使用「万」单位', () => {
    expect(formatCount(32000)).toBe('32,000')
    expect(formatCount(32000)).not.toContain('万')
  })
})

describe('formatDate', () => {
  it('输出英文月份与日期', () => {
    expect(formatDate('2026-09-30T10:00:00+08:00')).toBe('Sep 30')
  })

  it('按中国时区换算，不受运行环境时区影响', () => {
    // 该时刻在东八区是 10 月 2 日清晨，在 UTC 仍是 10 月 1 日
    expect(formatDate('2026-10-02T06:00:00+08:00')).toBe('Oct 2')
  })

  it('非法时间串直接抛出 RangeError，不静默兜底', () => {
    expect(() => formatDate('not-a-date')).toThrow(RangeError)
    expect(() => formatDate('')).toThrow(RangeError)
  })
})
