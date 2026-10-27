import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ListResult } from '@/lib/home/types'
import { useSectionData } from './use-section-data'
import type { SectionState } from './use-section-data'

function readyItems(state: SectionState<string>): string[] | null {
  return state.status === 'ready' ? state.items : null
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('useSectionData', () => {
  it('首次渲染返回 loading 态并立即发起取数', () => {
    const load = vi.fn(() => new Promise<ListResult<string>>(() => undefined))

    const { result } = renderHook(() => useSectionData<string>(load, []))

    expect(result.current).toEqual({ status: 'loading' })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('数据返回后进入 ready 态并携带 items 与 total', async () => {
    const load = vi.fn(async () => ({ items: ['alpha', 'beta'], total: 9 }))

    const { result } = renderHook(() => useSectionData<string>(load, []))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current).toEqual({ status: 'ready', items: ['alpha', 'beta'], total: 9 })
  })

  it('数据源失败时进入 error 态', async () => {
    const load = vi.fn(async () => {
      throw new Error('mock failure')
    })

    const { result } = renderHook(() => useSectionData<string>(load, []))

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }))
  })

  it('deps 内容不变时内部状态更新不会重复取数', async () => {
    const load = vi.fn(async () => ({ items: ['alpha'], total: 1 }))

    const { result, rerender } = renderHook(
      (props: { deps: string[] }) => useSectionData<string>(load, props.deps),
      { initialProps: { deps: ['all'] } },
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ deps: ['all'] })

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  })

  it('deps 变化时重新取数并丢弃旧结果', async () => {
    const stale = createDeferred<ListResult<string>>()
    const fresh = createDeferred<ListResult<string>>()
    const load = vi
      .fn<() => Promise<ListResult<string>>>()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise)

    const { result, rerender } = renderHook(
      (props: { deps: string[] }) => useSectionData<string>(load, props.deps),
      { initialProps: { deps: ['all'] } },
    )

    rerender({ deps: ['beijing'] })

    await act(async () => {
      fresh.resolve({ items: ['beijing pick'], total: 1 })
    })
    await waitFor(() => expect(readyItems(result.current)).toEqual(['beijing pick']))

    await act(async () => {
      stale.resolve({ items: ['all picks'], total: 12 })
    })

    expect(result.current).toEqual({ status: 'ready', items: ['beijing pick'], total: 1 })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('卸载后返回的结果不再触发状态更新', async () => {
    const deferred = createDeferred<ListResult<string>>()
    let renders = 0

    const { unmount } = renderHook(() => {
      renders += 1
      return useSectionData<string>(() => deferred.promise, [])
    })

    unmount()
    const rendersBeforeResolve = renders

    await act(async () => {
      deferred.resolve({ items: ['late'], total: 1 })
      await deferred.promise
    })

    expect(renders).toBe(rendersBeforeResolve)
  })
})
