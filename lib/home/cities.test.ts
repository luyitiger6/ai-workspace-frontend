import { describe, expect, it } from 'vitest'
import { CITIES, cityName, cityNameEn, DEFAULT_CITY, isCitySlug, parseCity } from './cities'
import type { CitySlug } from './types'

describe('城市白名单', () => {
  it('提供 8 个互不重复的 MVP 城市', () => {
    expect(CITIES).toHaveLength(8)
    expect(new Set(CITIES.map((city) => city.slug)).size).toBe(8)
  })

  it('缺失城市回落到 all', () => {
    expect(parseCity(undefined)).toBe(DEFAULT_CITY)
  })

  it('非法城市回落到 all', () => {
    expect(parseCity('atlantis')).toBe(DEFAULT_CITY)
  })

  it('合法城市原样返回', () => {
    expect(parseCity('beijing')).toBe('beijing')
    expect(parseCity(['sanya'])).toBe('sanya')
  })

  it('isCitySlug 只接受白名单内的 slug', () => {
    expect(isCitySlug('hangzhou')).toBe(true)
    expect(isCitySlug('chengdu ')).toBe(false)
  })

  it('cityName 返回中文名', () => {
    expect(cityName('xian')).toBe('西安')
    expect(cityName('all')).toBe('全部')
  })

  it('未收录 slug 的中英文展示名都退回不限城市', () => {
    const unknown = 'unknown' as CitySlug

    expect(cityName(unknown)).toBe('全部')
    expect(cityNameEn(unknown)).toBe('All cities')
  })

  it('cityNameEn 保留专有拼写', () => {
    expect(cityNameEn('all')).toBe('All cities')
    expect(cityNameEn('xian')).toBe("Xi'an")
    expect(cityNameEn('sanya')).toBe('Sanya')
  })
})
