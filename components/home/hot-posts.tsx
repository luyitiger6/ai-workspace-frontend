'use client'

import Link from 'next/link'
import { cityNameEn } from '@/lib/home/cities'
import { formatDate } from '@/lib/home/format'
import { mockRepository } from '@/lib/home/repository'
import type { CitySlug } from '@/lib/home/types'
import { PostCardStats } from '@/components/posts/post-card-stats'
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
              Trending posts
            </h2>
          </div>
          <div className={styles.headActions}>
            <Link className={styles.viewAll} href="/posts?sortBy=hottest">
              View all posts
            </Link>
            <p className="wc-section-note">Ranked by comments, views and publish time.</p>
          </div>
        </div>

        {state.status === 'loading' ? (
          <SectionLoading label="Measuring this week's buzz…" />
        ) : null}
        {state.status === 'error' ? (
          <SectionError message="Trending posts could not load. Please try again later." />
        ) : null}
        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState message={`Be the first to ask in ${cityNameEn(city)}.`} />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ol className={styles.list}>
            {state.items.map((post, index) => (
              <li key={post.id} className={styles.item}>
                <span className={styles.rank} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className={styles.content}>
                  <h3 className={styles.title}>{post.titleEn}</h3>
                  <p className={styles.meta}>
                    {post.authorEn} · {cityNameEn(post.city)} · {formatDate(post.publishedAt)}
                  </p>
                </div>
                <PostCardStats
                  upVoteCount={post.upVoteCount}
                  commentCount={post.commentCount}
                  bookmarkCount={post.bookmarkCount}
                />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  )
}
