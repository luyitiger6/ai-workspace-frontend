'use client'

import Image from 'next/image'

import { cityNameEn } from '@/lib/home/cities'
import { formatCount } from '@/lib/home/format'
import { mockRepository } from '@/lib/home/repository'
import type { CitySlug } from '@/lib/home/types'
import { EmptyState, SectionError, SectionLoading } from './section-state'
import { useSectionData } from './use-section-data'
import styles from './hot-attractions.module.css'

export function HotAttractions({ city }: { city: CitySlug }) {
  const state = useSectionData(() => mockRepository.listHotAttractions({ city }), [city])

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
              <li key={item.id} className={styles.card}>
                <Image
                  className={styles.cover}
                  src={item.coverUrl}
                  alt={`${item.nameEn} cover`}
                  width={600}
                  height={600}
                  sizes="(max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)"
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.body}>
                  <h3 className={styles.name}>{item.nameEn}</h3>
                  <p className={styles.meta}>
                    {cityNameEn(item.city)} · Rating {item.rating.toFixed(1)}
                  </p>
                  <p className={styles.views}>{formatCount(item.viewCount)} views</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
