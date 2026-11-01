'use client'

import Image from 'next/image'
import Link from 'next/link'

import { SectionError, SectionLoading } from '@/components/home/section-state'
import { cityNameEn, isCitySlug } from '@/lib/home/cities'
import { formatCount, formatMonth } from '@/lib/home/format'
import type { AttractionDetail as Detail } from '@/lib/attractions/types'
import { AttractionFacts } from './attraction-facts'
import { useAttractionDetail } from './use-attraction-detail'
import styles from './attraction-detail.module.css'

/** 主图占满容器，容器宽被 `.article` 限住，所以档位按容器上限而不是视口推算。 */
const SIZES = '(max-width: 720px) calc(100vw - 48px), 880px'

export function AttractionDetail({ publicId }: { publicId: string }) {
  const { state, retry } = useAttractionDetail(publicId)

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.inner}`}>
        <Link className={styles.back} href="/attractions">
          ← Back to all attractions
        </Link>

        {state.status === 'loading' ? <SectionLoading label="Loading this attraction…" /> : null}

        {state.status === 'error' ? (
          <div className={styles.notice}>
            <h1 className={styles.title}>This attraction could not load</h1>
            <SectionError message={state.error} />
            <button type="button" className="wc-button wc-button--primary" onClick={retry}>
              Retry loading this attraction
            </button>
          </div>
        ) : null}

        {state.status === 'not-found' ? (
          <div className={styles.notice}>
            <h1 className={styles.title}>Attraction not found</h1>
            <p className={styles.lead}>
              This attraction is not published, or it has been taken down. Browse the shortlists
              instead.
            </p>
            <Link className="wc-button wc-button--primary" href="/attractions">
              Browse all attractions
            </Link>
          </div>
        ) : null}

        {state.status === 'ready' ? <Article detail={state.data} /> : null}
      </div>
    </main>
  )
}

function Article({ detail }: { detail: Detail }) {
  const city = isCitySlug(detail.city) ? cityNameEn(detail.city) : detail.city
  const rating = detail.rating === null ? 'Not rated yet' : `Rating ${detail.rating.toFixed(1)}`

  return (
    <article className={styles.article}>
      <div className={styles.head}>
        <p className="wc-eyebrow">Attractions · Guide</p>
        <h1 className={styles.title}>{detail.nameEn}</h1>
        <p className={styles.meta}>
          {city} · {rating} · {formatCount(detail.viewCount)} views
        </p>
        <p className={styles.checked}>
          Checked <time dateTime={detail.verifiedAt.slice(0, 10)}>{formatMonth(detail.verifiedAt)}</time>
        </p>
      </div>

      <div className={styles.cover}>
        {detail.coverUrl ? (
          <Image
            className={styles.coverImage}
            src={detail.coverUrl}
            alt={`${detail.nameEn} cover`}
            width={1200}
            height={800}
            sizes={SIZES}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            className={styles.coverPlaceholder}
            role="img"
            aria-label={`${detail.nameEn} has no cover image`}
          />
        )}
      </div>

      {detail.summaryEn ? <p className={styles.summary}>{detail.summaryEn}</p> : null}

      <section className={styles.section} aria-labelledby="attraction-facts">
        <h2 id="attraction-facts" className={styles.sectionTitle}>
          What to know before you go
        </h2>
        <AttractionFacts detail={detail} />
      </section>

      {detail.contentEn ? (
        <section className={styles.section} aria-labelledby="attraction-guide">
          <h2 id="attraction-guide" className={styles.sectionTitle}>
            The guide
          </h2>
          <div className={styles.body}>{detail.contentEn}</div>
        </section>
      ) : null}

      <p className={styles.footer}>
        Details were checked in person. Prices, hours and booking rules change — re-check the
        official site before you travel.
      </p>
    </article>
  )
}
