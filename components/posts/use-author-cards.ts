'use client'

import { useEffect, useRef, useState } from 'react'
import { profileApi } from '@/lib/profile/profile-api'
import type { AuthorCardEntry } from '@/lib/profile/types'

/** 单批请求上限：与后端批量名片端点（1–50）对齐。 */
const CHUNK_SIZE = 50

/** 稳定集合签名：去重 + 排序 + 分隔符，避免数组引用变化导致 effect 反复触发。 */
function idsSignature(ids: string[]): string {
  return [...new Set(ids)].sort().join('\u001f')
}

/**
 * 作者名片批量取数。
 *
 * 接收作者标识数组，去重、剔除已缓存、按 ≤50 切块并发请求，合并进一张
 * `Map<publicId, { pending | ready | missing }>`。失败批次不写入「永久缺失」：
 * 它们被记入可重试集合，在标识集合变化（翻页 / 刷新）时重新请求。
 */
export function useAuthorCards(authorIds: string[]): ReadonlyMap<string, AuthorCardEntry> {
  const cacheRef = useRef<Map<string, AuthorCardEntry>>(new Map())
  const retryableRef = useRef<Set<string>>(new Set())
  const [, forceRender] = useState(0)
  const signature = idsSignature(authorIds)

  useEffect(() => {
    const unique = [...new Set(authorIds)]
    const toFetch = unique.filter((id) => !cacheRef.current.has(id) || retryableRef.current.has(id))
    if (toFetch.length === 0) return

    // 未缓存的先标 pending，让卡片立即进入占位态；重试的保持原 missing 呈现。
    for (const id of toFetch) {
      if (!cacheRef.current.has(id)) {
        cacheRef.current.set(id, { status: 'pending', card: null })
      }
    }
    forceRender((value) => value + 1)

    let active = true
    const chunks: string[][] = []
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
      chunks.push(toFetch.slice(i, i + CHUNK_SIZE))
    }

    void Promise.all(
      chunks.map(async (chunk) => {
        try {
          const cards = await profileApi.cards(chunk)
          if (!active) return
          const byId = new Map(cards.map((card) => [card.publicId, card]))
          for (const id of chunk) {
            retryableRef.current.delete(id)
            const card = byId.get(id)
            if (card !== undefined && card.displayName.trim() !== '') {
              cacheRef.current.set(id, { status: 'ready', card })
            } else {
              cacheRef.current.set(id, { status: 'missing', card: null })
            }
          }
        } catch {
          if (!active) return
          // 失败批次：呈现为 missing，但记入可重试集合，标识集合变化时重取。
          for (const id of chunk) {
            retryableRef.current.add(id)
            cacheRef.current.set(id, { status: 'missing', card: null })
          }
        } finally {
          if (active) forceRender((value) => value + 1)
        }
      }),
    )

    return () => {
      active = false
    }
  }, [signature])

  return cacheRef.current
}
