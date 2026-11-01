'use client'

import { EmptyState, SectionError, SectionLoading } from '@/components/home/section-state'
import { useSectionData } from '@/components/home/use-section-data'
import { attractionsApi } from '@/lib/attractions/attractions-api'
import type { AttractionCollection } from '@/lib/contracts/attractions'
import { cityNameEn } from '@/lib/home/cities'
import type { CitySlug } from '@/lib/home/types'
import { AttractionCard } from './attraction-card'
import styles from './attraction-collections.module.css'

interface CollectionBlockProps {
  collection: AttractionCollection
  /** 榜单名与说明由 `collections.ts` 给出固定文案，组件不参与拼写。 */
  title: string
  blurb: string
  city: CitySlug
}

/**
 * 一个约束型榜单区块。成员与顺序完全由后端策展决定，组件不排序、不筛选。
 * 三个区块各自取数、各自承担三态：任一榜失败都不牵连其它榜与下面的完整列表。
 */
export function CollectionBlock({ collection, title, blurb, city }: CollectionBlockProps) {
  const state = useSectionData(
    () => attractionsApi.listAttractions({ city, collection }),
    [city, collection],
  )
  const scope = city === 'all' ? 'anywhere in China' : `in ${cityNameEn(city)}`

  return (
    <section
      className={styles.block}
      data-collection={collection}
      aria-labelledby={`collection-${collection}`}
    >
      <div className={styles.head}>
        <h2 id={`collection-${collection}`} className={styles.title}>
          {title}
        </h2>
        <p className={styles.blurb}>{blurb}</p>
      </div>

      {state.status === 'loading' ? <SectionLoading label="Loading this shortlist…" /> : null}
      {state.status === 'error' ? (
        <SectionError message={`${title} could not load. Please try again later.`} />
      ) : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <EmptyState message={`No picks on this shortlist ${scope} yet.`} />
      ) : null}
      {state.status === 'ready' && state.items.length > 0 ? (
        <ul className={styles.grid}>
          {state.items.map((item) => (
            <AttractionCard key={item.publicId} attraction={item} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
