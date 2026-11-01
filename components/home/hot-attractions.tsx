'use client'

import Image from 'next/image'
import Link from 'next/link'

import { attractionsApi } from '@/lib/attractions/attractions-api'
import type { AttractionSummary } from '@/lib/attractions/types'
import { cityNameEn, isCitySlug } from '@/lib/home/cities'
import { formatCount } from '@/lib/home/format'
import type { CitySlug } from '@/lib/home/types'
import { EmptyState, SectionError, SectionLoading } from './section-state'
import { useSectionData } from './use-section-data'
import styles from './hot-attractions.module.css'

export function HotAttractions({ city }: { city: CitySlug }) {
  const state = useSectionData(() => attractionsApi.listHotAttractions({ city }), [city])

  return (
    <section
      id="hot-attractions"
      className={styles.section}
      data-section="hot-attractions"
      aria-labelledby="hot-attractions-title"
    >
      <div className="wc-container">
        <div className="wc-section-head">
          <div>
            <p className="wc-eyebrow">Places</p>
            <h2 id="hot-attractions-title" className="wc-section-title">
              Popular attractions
            </h2>
          </div>
          <p className="wc-section-note">Ranked by views and publish time.</p>
        </div>

        {state.status === 'loading' ? <SectionLoading label="Gathering attraction data…" /> : null}
        {state.status === 'error' ? (
          <SectionError message="Popular attractions could not load. Please try again later." />
        ) : null}
        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState message={`Browse attractions in ${cityNameEn(city)}.`} />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ul className={styles.grid}>
            {state.items.map((item) => (
              <HotAttractionCard key={item.publicId} attraction={item} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

/** 卡片整卡可点，跳转 `/attractions/{publicId}`；缺失封面与缺失评分都有确定说法。 */
function HotAttractionCard({ attraction }: { attraction: AttractionSummary }) {
  const city = isCitySlug(attraction.city) ? cityNameEn(attraction.city) : attraction.city
  const rating =
    attraction.rating === null ? 'Not rated yet' : `Rating ${attraction.rating.toFixed(1)}`

  return (
    <li className={styles.card}>
      <Link className={styles.link} href={`/attractions/${attraction.publicId}`}>
        {attraction.coverUrl ? (
          <Image
            className={styles.cover}
            src={attraction.coverUrl}
            alt={`${attraction.nameEn} cover`}
            width={600}
            height={600}
            sizes="(max-width: 480px) calc(100vw - 64px), (max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            className={styles.coverPlaceholder}
            role="img"
            aria-label={`${attraction.nameEn} has no cover image`}
          />
        )}
        <div className={styles.body}>
          <h3 className={styles.name}>{attraction.nameEn}</h3>
          <p className={styles.meta}>
            {city} · {rating}
          </p>
          <p className={styles.views}>{formatCount(attraction.viewCount)} views</p>
        </div>
      </Link>
    </li>
  )
}
