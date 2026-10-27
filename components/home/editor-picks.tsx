'use client'

import Image from 'next/image'

import { cityNameEn } from '@/lib/home/cities'
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
              Editor&apos;s picks
            </h2>
          </div>
          <p className="wc-section-note">
            Routes our editors walked themselves and wrote down — not a list copied from somewhere.
          </p>
        </div>

        {state.status === 'loading' ? (
          <SectionLoading label="Our editors are picking this week's routes…" />
        ) : null}
        {state.status === 'error' ? (
          <SectionError message="Editor's picks could not load. Please try again later." />
        ) : null}
        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState message={`No editor's picks in ${cityNameEn(city)} yet. Try another city.`} />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ul className={styles.grid}>
            {state.items.map((pick) => (
              <li key={pick.id} className={styles.card}>
                <Image
                  className={styles.cover}
                  src={pick.coverUrl}
                  alt={`${pick.titleEn} cover`}
                  width={900}
                  height={675}
                  sizes="(max-width: 640px) calc(100vw - 64px), (max-width: 900px) calc(50vw - 50px), (min-width: 1160px) 347px, calc(33.33vw - 40px)"
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.body}>
                  <span className={styles.city}>
                    {pick.city === 'all' ? 'All cities' : cityNameEn(pick.city)}
                  </span>
                  <h3 className={styles.title}>{pick.titleEn}</h3>
                  <p className={styles.summary}>{pick.summaryEn}</p>
                  <p className={styles.editor}>{pick.editorEn}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
