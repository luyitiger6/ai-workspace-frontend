import type { CitySlug } from './types'

export interface CityOption {
  slug: CitySlug
  name: string
  tagline: string
}

/** 8 个 MVP 城市入口：all 表示不限城市。 */
export const CITIES: readonly CityOption[] = [
  { slug: 'all', name: '全部', tagline: '不限城市，随便走走' },
  { slug: 'beijing', name: '北京', tagline: '城墙与胡同之间' },
  { slug: 'shanghai', name: '上海', tagline: '梧桐树下的城市' },
  { slug: 'guangzhou', name: '广州', tagline: '早茶与骑楼' },
  { slug: 'chengdu', name: '成都', tagline: '慢一点，再慢一点' },
  { slug: 'xian', name: '西安', tagline: '十三公里的风' },
  { slug: 'hangzhou', name: '杭州', tagline: '西湖以西是茶山' },
  { slug: 'sanya', name: '三亚', tagline: '把冬天留在岸上' },
]

export const DEFAULT_CITY: CitySlug = 'all'

const CITY_SLUGS: readonly CitySlug[] = CITIES.map((city) => city.slug)

export function isCitySlug(value: string): value is CitySlug {
  return (CITY_SLUGS as readonly string[]).includes(value)
}

/** 缺失或非法城市一律归一化为 all，保证页面永远有确定输入。 */
export function parseCity(value: string | string[] | undefined): CitySlug {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) {
    return DEFAULT_CITY
  }
  return isCitySlug(raw) ? raw : DEFAULT_CITY
}

export function cityName(slug: CitySlug): string {
  return CITIES.find((city) => city.slug === slug)?.name ?? '全部'
}
