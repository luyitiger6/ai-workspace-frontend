'use client'

import { cityName } from '@/lib/home/cities'
import { formatCount, formatDate } from '@/lib/home/format'
import { mockRepository } from '@/lib/home/repository'
import type { CitySlug } from '@/lib/home/types'
import { EmptyState, SectionError, SectionLoading } from './section-state'
import { useSectionData } from './use-section-data'
import styles from './hot-posts.module.css'

export function HotPosts({ city }: { city: CitySlug }) {
  const state = useSectionData(() => mockRepository.listHotPosts({ city }), [city])

  return (
    <section
      id="hot-posts"
      className={styles.section}
      data-section="hot-posts"
      aria-labelledby="hot-posts-title"
    >
      <div className="wc-container">
        <div className="wc-section-head">
          <div>
            <p className="wc-eyebrow">Trending</p>
            <h2 id="hot-posts-title" className="wc-section-title">
              热门帖子
            </h2>
          </div>
          <p className="wc-section-note">按评论、浏览与发布时间排序。</p>
        </div>

        {state.status === 'loading' ? <SectionLoading label="正在统计这周的热度…" /> : null}
        {state.status === 'error' ? (
          <SectionError message="热门帖子暂时没能加载出来，稍后再试试。" />
        ) : null}
        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState message={`${cityName(city)}还没有帖子，去社区写第一篇。`} />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ol className={styles.list}>
            {state.items.map((post, index) => (
              <li key={post.id} className={styles.item}>
                <span className={styles.rank} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className={styles.content}>
                  <h3 className={styles.title}>{post.title}</h3>
                  <p className={styles.meta}>
                    {post.author} · {cityName(post.city)} · {formatDate(post.publishedAt)}
                  </p>
                </div>
                <p className={styles.stats}>
                  {post.commentCount} 评论 · {formatCount(post.viewCount)} 浏览
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  )
}
