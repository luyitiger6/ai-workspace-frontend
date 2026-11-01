'use client'

import { EmptyState, SectionError, SectionLoading } from '@/components/home/section-state'
import { useSectionData } from '@/components/home/use-section-data'
import { attractionsApi } from '@/lib/attractions/attractions-api'
import { cityNameEn } from '@/lib/home/cities'
import type { CitySlug } from '@/lib/home/types'
import { AttractionCard } from './attraction-card'
import styles from './attraction-collections.module.css'

/** 后端 `limit` 上限；一次取满，超出部分由 `total` 如实说明，不假装还有下一页。 */
const LIST_LIMIT = 50

/** 完整列表：默认按浏览数降序（后端默认），与榜单区块分开取数。 */
export function AttractionList({ city }: { city: CitySlug }) {
  const state = useSectionData(
    () => attractionsApi.listAttractions({ city, limit: LIST_LIMIT }),
    [city],
  )
  const scope = city === 'all' ? 'All cities' : cityNameEn(city)
  const scopeIn = city === 'all' ? 'anywhere in China' : `in ${cityNameEn(city)}`

  return (
    <section className={styles.block} data-section="attraction-list" aria-labelledby="attraction-list-title">
      <div className={styles.head}>
        <h2 id="attraction-list-title" className={styles.title}>
          Every published attraction
        </h2>
        <p className={styles.blurb}>
          {scope} · sorted by views by default, newest and best rated on request.
        </p>
      </div>

      {state.status === 'loading' ? <SectionLoading label="Gathering attraction data…" /> : null}
      {state.status === 'error' ? (
        <SectionError message="The attraction list could not load. Please try again later." />
      ) : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <EmptyState message={`No published attractions ${scopeIn} yet.`} />
      ) : null}
      {state.status === 'ready' && state.items.length > 0 ? (
        <>
          <p className={styles.statusLine}>
            Showing {state.items.length} of {state.total} published attractions.
          </p>
          <ul className={styles.grid}>
            {state.items.map((item) => (
              <AttractionCard key={item.publicId} attraction={item} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
