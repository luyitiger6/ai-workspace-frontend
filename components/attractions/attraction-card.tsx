import Image from 'next/image'
import Link from 'next/link'

import type { AttractionSummary } from '@/lib/attractions/types'
import { cityNameEn, isCitySlug } from '@/lib/home/cities'
import { formatCount } from '@/lib/home/format'
import styles from './attraction-card.module.css'

/** 四列网格内容宽，与 `.grid` 的列数断点对应。 */
const SIZES =
  '(max-width: 480px) calc(100vw - 48px), (max-width: 720px) calc(50vw - 40px), ' +
  '(max-width: 1080px) calc(33.33vw - 40px), calc(25vw - 40px)'

/**
 * 三个布尔事实列是徽标的唯一来源：卡片不按榜单另造一套说法，
 * 因此在任一榜单里都能读出同一条事实（例如无需预约榜里的「No booking needed」）。
 */
function facts(attraction: AttractionSummary): string[] {
  return [
    attraction.freeEntry ? 'Free entry' : 'Paid entry',
    attraction.bookingRequired ? 'Booking needed' : 'No booking needed',
    attraction.openOnMonday ? 'Open on Mondays' : 'Closed on Mondays',
  ]
}

/** 列表卡片：整卡可点，跳转到 `/attractions/{publicId}`。 */
export function AttractionCard({ attraction }: { attraction: AttractionSummary }) {
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
            height={450}
            sizes={SIZES}
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

          <ul className={styles.badges}>
            {facts(attraction).map((fact) => (
              <li key={fact} className={styles.badge}>
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </Link>
    </li>
  )
}
