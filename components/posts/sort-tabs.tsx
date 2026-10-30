'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { PostSortBy } from '@/lib/home/types'
import styles from './sort-tabs.module.css'

export const SORT_OPTIONS: { value: PostSortBy; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'hottest', label: 'Hottest' },
  { value: 'mostDiscussed', label: 'Most discussed' },
]

export interface SortTabsProps {
  active: PostSortBy
}

export function SortTabs({ active }: SortTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function select(value: PostSortBy) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('sortBy', value)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Sort posts">
      {SORT_OPTIONS.map((option) => {
        const selected = option.value === active
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.tab} ${selected ? styles.active : ''}`}
            onClick={() => select(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
