'use client'

import Image from 'next/image'

import { cityName } from '@/lib/home/cities'
import { mockRepository } from '@/lib/home/repository'
import type { CitySlug } from '@/lib/home/types'
import { EmptyState, SectionError, SectionLoading } from './section-state'
import { useSectionData } from './use-section-data'
import styles from './editor-picks.module.css'

export function EditorPicks({ city }: { city: CitySlug }) {
  const state = useSectionData(() => mockRepository.listEditorPicks({ city }), [city])

  return (
    <section
      id="editor-picks"
      className={styles.section}
      data-section="editor-picks"
      aria-labelledby="editor-picks-title"
    >
      <div className="wc-container">
        <div className="wc-section-head">
          <div>
            <p className="wc-eyebrow">Editor&apos;s picks</p>
            <h2 id="editor-picks-title" className="wc-section-title">
              编辑推荐
            </h2>
          </div>
          <p className="wc-section-note">由编辑亲自走过、亲手写下的路线，不是榜单搬运。</p>
        </div>

        {state.status === 'loading' ? <SectionLoading label="编辑正在挑这一期的路线…" /> : null}
        {state.status === 'error' ? (
          <SectionError message="编辑推荐暂时没能加载出来，稍后再试试。" />
        ) : null}
        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState message={`${cityName(city)}还没有编辑精选，换座城市看看。`} />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ul className={styles.grid}>
            {state.items.map((pick) => (
              <li key={pick.id} className={styles.card}>
                <Image
                  className={styles.cover}
                  src={pick.coverUrl}
                  alt={`${pick.title}封面`}
                  width={900}
                  height={675}
                  sizes="(max-width: 640px) calc(100vw - 64px), (max-width: 900px) calc(50vw - 50px), (min-width: 1160px) 347px, calc(33.33vw - 40px)"
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.body}>
                  <span className={styles.city}>
                    {pick.city === 'all' ? '全城' : cityName(pick.city)}
                  </span>
                  <h3 className={styles.title}>{pick.title}</h3>
                  <p className={styles.summary}>{pick.summary}</p>
                  <p className={styles.editor}>{pick.editor}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
