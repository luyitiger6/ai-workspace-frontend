'use client'

import { useEffect, useState } from 'react'
import type { ListResult } from '@/lib/home/types'

export type SectionState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: T[]; total: number }

/**
 * 区块数据加载：数据源是异步契约，真实 API 接入时组件无需调整。
 * 依赖由调用方显式声明，避免每次渲染都重新拉取。
 */
export function useSectionData<T>(
  load: () => Promise<ListResult<T>>,
  deps: readonly unknown[],
): SectionState<T> {
  const [state, setState] = useState<SectionState<T>>({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })

    load()
      .then((result) => {
        if (active) {
          setState({ status: 'ready', items: result.items, total: result.total })
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error' })
        }
      })

    return () => {
      active = false
    }
  }, deps)

  return state
}
