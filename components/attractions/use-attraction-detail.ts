'use client'

import { useEffect, useState } from 'react'

import {
  attractionsApi,
  describeAttractionsError,
  isAttractionNotFound,
} from '@/lib/attractions/attractions-api'
import type { AttractionDetail } from '@/lib/attractions/types'

export type AttractionDetailState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: AttractionDetail; error: null }
  | { status: 'not-found'; data: null; error: null }
  | { status: 'error'; data: null; error: string }

/**
 * 详情只有一个数据源，没有写入，因此不需要帖子详情那套代次与同步锁：
 * 取消即为放弃，只由 effect 的清理函数负责，绝不把 AbortError 当成错误态展示。
 */
export function useAttractionDetail(publicId: string) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AttractionDetailState>({ status: 'loading', data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading', data: null, error: null })
    attractionsApi.detail(publicId, controller.signal)
      .then((data) => {
        if (active) setState({ status: 'ready', data, error: null })
      })
      .catch((cause: unknown) => {
        // 切页或重试时旧请求被取消，它的失败不再代表当前页面。
        if (!active) return
        setState(
          isAttractionNotFound(cause)
            ? { status: 'not-found', data: null, error: null }
            : { status: 'error', data: null, error: describeAttractionsError(cause) },
        )
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [publicId, attempt])

  return { state, retry: () => setAttempt((value) => value + 1) }
}
