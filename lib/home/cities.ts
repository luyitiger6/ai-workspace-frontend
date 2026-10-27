import type { CitySlug } from './types'

export interface CityOption {
  slug: CitySlug
  name: string
  nameEn: string
  tagline: string
  taglineEn: string
}

/** 8 个 MVP 城市入口：all 表示不限城市。中文字段保留为内容资产，界面只展示英文字段。 */
export const CITIES: readonly CityOption[] = [
  {
    slug: 'all',
    name: '全部',
    nameEn: 'All cities',
    tagline: '不限城市，随便走走',
    taglineEn: 'Everywhere, at any pace',
  },
  {
    slug: 'beijing',
    name: '北京',
    nameEn: 'Beijing',
    tagline: '城墙与胡同之间',
    taglineEn: 'Between city walls and hutong lanes',
  },
  {
    slug: 'shanghai',
    name: '上海',
    nameEn: 'Shanghai',
    tagline: '梧桐树下的城市',
    taglineEn: 'A city under plane trees',
  },
  {
    slug: 'guangzhou',
    name: '广州',
    nameEn: 'Guangzhou',
    tagline: '早茶与骑楼',
    taglineEn: 'Morning tea and arcades',
  },
  {
    slug: 'chengdu',
    name: '成都',
    nameEn: 'Chengdu',
    tagline: '慢一点，再慢一点',
    taglineEn: 'Slow down, then slow down more',
  },
  {
    slug: 'xian',
    name: '西安',
    nameEn: "Xi'an",
    tagline: '十三公里的风',
    taglineEn: 'Thirteen kilometers of wind',
  },
  {
    slug: 'hangzhou',
    name: '杭州',
    nameEn: 'Hangzhou',
    tagline: '西湖以西是茶山',
    taglineEn: 'Tea hills west of the lake',
  },
  {
    slug: 'sanya',
    name: '三亚',
    nameEn: 'Sanya',
    tagline: '把冬天留在岸上',
    taglineEn: 'Leave winter on the shore',
  },
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

/** 界面展示用英文城市名；缺失时按不限城市处理。 */
export function cityNameEn(slug: CitySlug): string {
  return CITIES.find((city) => city.slug === slug)?.nameEn ?? 'All cities'
}
