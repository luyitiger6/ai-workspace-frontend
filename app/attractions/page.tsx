import type { Metadata } from 'next'

import { AttractionList } from '@/components/attractions/attraction-list'
import { CollectionBlock } from '@/components/attractions/collection-block'
import { COLLECTIONS } from '@/components/attractions/collections'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { cityNameEn, parseCity } from '@/lib/home/cities'
import styles from './attractions.module.css'

export const metadata: Metadata = {
  title: 'Attraction guides',
  description: 'Three curated shortlists and every checked attraction, by city.',
}

type SearchParams = Record<string, string | string[] | undefined>

interface AttractionsPageProps {
  searchParams: Promise<SearchParams>
}

/**
 * 景点列表页：三个约束型榜单在前，完整列表在后（spec「景点列表页先榜单后列表」）。
 * 城市参数与首页同一归一化规则——缺失、为空或白名单外一律回落 `all`。
 */
export default async function AttractionsPage({ searchParams }: AttractionsPageProps) {
  // Next 在某些调用下（比如直接以组件方式渲染）可能拿不到 searchParams，缺省按空参数处理。
  const params = (await searchParams) ?? {}
  const city = parseCity(params.city)
  const scope = city === 'all' ? 'across China' : `in ${cityNameEn(city)}`

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main id="main-content" className={styles.main}>
        <div className={`wc-container ${styles.inner}`}>
          <div className={styles.head}>
            <p className="wc-eyebrow">Attractions</p>
            <h1 className={styles.title}>Places worth the trip</h1>
            <p className={styles.lead}>
              Three shortlists first, each answering one question that can block a trip: it is your
              first time in the country, you would rather not book ahead, or the only free day you
              have is a Monday. Every entry below has been checked {scope} before it was listed.
            </p>
          </div>

          {COLLECTIONS.map((collection) => (
            <CollectionBlock
              key={collection.key}
              collection={collection.key}
              title={collection.title}
              blurb={collection.blurb}
              city={city}
            />
          ))}

          <AttractionList city={city} />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
