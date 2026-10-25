'use client'

import { cityName } from '@/lib/home/cities'
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
      className={styles.section}
      data-section="hot-attractions"
      aria-labelledby="hot-attractions-title"
    >
      <div className="wc-container">
        <div className="wc-section-head">
          <div>
            <p className="wc-eyebrow">Places</p>
            <h2 id="hot-attractions-title" className="wc-section-title">
              热门景点
            </h2>
          </div>
          <p className="wc-section-note">按浏览量与发布时间排序。</p>
        </div>

        {state.status === 'loading' ? <SectionLoading label="正在收集景点数据…" /> : null}
        {state.status === 'error' ? (
          <SectionError message="热门景点暂时没能加载出来，稍后再试试。" />
        ) : null}
        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState message={`${cityName(city)}还没有收录景点，换座城市看看。`} />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ul className={styles.grid}>
            {state.items.map((item) => (
              <li key={item.id} className={styles.card}>
                <img
                  className={styles.cover}
                  src={item.coverUrl}
                  alt={`${item.name}封面`}
                  width={600}
                  height={600}
                  loading="lazy"
                />
                <div className={styles.body}>
                  <h3 className={styles.name}>{item.name}</h3>
                  <p className={styles.meta}>
                    {cityName(item.city)} · 评分 {item.rating.toFixed(1)}
                  </p>
                  <p className={styles.views}>{formatCount(item.viewCount)} 浏览</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
