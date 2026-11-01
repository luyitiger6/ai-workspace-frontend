import type { AttractionCollection } from '@/lib/contracts/attractions'

export interface CollectionCopy {
  key: AttractionCollection
  /** 榜单名是固定英文串，不随城市或数据变化（spec「榜单名称为固定英文串」）。 */
  title: string
  blurb: string
}

/** 三个约束型榜单的界面文案；顺序即页面渲染顺序。 */
export const COLLECTIONS: readonly CollectionCopy[] = [
  {
    key: 'first-trip',
    title: 'First time in China',
    blurb:
      'The stops that answer what a first visit actually asks: what to book, what it costs, and how to get there.',
  },
  {
    key: 'no-booking',
    title: 'No booking needed',
    blurb:
      'Walk in and pay at the gate. No timed slot, no reservation, nothing to arrange before you land.',
  },
  {
    key: 'open-monday',
    title: 'Open on Mondays',
    blurb:
      'Most museums in China close on Mondays. These stay open, so a Monday is never a wasted day.',
  },
]
