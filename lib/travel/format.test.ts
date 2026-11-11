import { describe, expect, it } from 'vitest'
import { formatRate } from './format'

describe('汇率展示精度', () => {
  it('大于等于 1 时保留两位', () => {
    expect(formatRate(23.7139)).toBe('23.71')
    expect(formatRate(5.009935)).toBe('5.01')
    expect(formatRate(1.1631)).toBe('1.16')
    expect(formatRate(1)).toBe('1.00')
  })

  it('小于 1 时保留四位', () => {
    expect(formatRate(0.149528)).toBe('0.1495')
    expect(formatRate(0.1281)).toBe('0.1281')
  })

  it('不产出科学计数法', () => {
    expect(formatRate(0.000012)).toBe('0.0000')
    expect(formatRate(1234567.891)).not.toMatch(/e/i)
    expect(formatRate(1234567.891)).toBe('1234567.89')
  })

  it('非有限值显示占位符而不是 NaN 或 Infinity', () => {
    expect(formatRate(Number.NaN)).toBe('—')
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe('—')
    expect(formatRate(Number.NEGATIVE_INFINITY)).toBe('—')
  })
})
