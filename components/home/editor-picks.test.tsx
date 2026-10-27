import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_PICKS } from '@/lib/home/mock-data'
import { mockRepository } from '@/lib/home/repository'
import type { EditorPick, ListResult } from '@/lib/home/types'
import { EditorPicks } from './editor-picks'

describe('编辑推荐区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('按 sortOrder 升序展示全部精选卡片', async () => {
    render(<EditorPicks city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(6)
    expect(items[0]).toHaveTextContent('A walk through the Forbidden City at dusk')
    expect(items[1]).toHaveTextContent('Plane trees and coffee on Wukang Road')
    expect(items[2]).toHaveTextContent("A gaiwan of tea in People's Park")
  })

  it('封面图按响应式档位出图并延迟加载', async () => {
    render(<EditorPicks city="all" />)

    const covers = await screen.findAllByRole('img', { name: / cover$/ })

    expect(covers).toHaveLength(6)

    for (const cover of covers) {
      const srcset = cover.getAttribute('srcset') ?? ''

      // jsdom 里 next/image 不加载 next.config.ts 的 images 配置，走的是默认 loader，
      // 因此这里只验证属性产出；档位改写规则由 lib/image-loader.test.ts 覆盖，
      // 自定义 loader 的实际接入由浏览器实测确认。
      expect(srcset).toContain('images.unsplash.com')
      expect(srcset.split(',').length).toBeGreaterThan(1)
      expect(cover.getAttribute('sizes')).toBe(
        '(max-width: 640px) calc(100vw - 64px), (max-width: 900px) calc(50vw - 50px), (min-width: 1160px) 347px, calc(33.33vw - 40px)',
      )
      expect(cover).toHaveAttribute('loading', 'lazy')
      expect(cover).toHaveAttribute('decoding', 'async')
    }
  })

  it('取数期间展示 role="status" 加载提示，完成后消失', async () => {
    let resolveData: (value: ListResult<EditorPick>) => void = () => undefined
    const pending = new Promise<ListResult<EditorPick>>((resolve) => {
      resolveData = resolve
    })
    vi.spyOn(mockRepository, 'listEditorPicks').mockReturnValueOnce(pending)

    render(<EditorPicks city="all" />)

    expect(screen.getByRole('status')).toHaveTextContent(
      "Our editors are picking this week's routes…",
    )

    await act(async () => {
      resolveData({ items: [], total: 0 })
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('选中城市时只展示该城市与全城通用卡片', async () => {
    render(<EditorPicks city="beijing" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(screen.getByText('A walk through the Forbidden City at dusk')).toBeInTheDocument()
    expect(screen.getByText('Seven days, one backpack')).toBeInTheDocument()
    expect(screen.queryByText('Plane trees and coffee on Wukang Road')).not.toBeInTheDocument()
  })

  it('没有匹配卡片时展示空态', async () => {
    vi.spyOn(mockRepository, 'listEditorPicks').mockResolvedValueOnce({ items: [], total: 0 })

    render(<EditorPicks city="sanya" />)

    expect(await screen.findByText(/No editor's picks in Sanya yet/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(mockRepository, 'listEditorPicks').mockRejectedValueOnce(new Error('mock failure'))

    render(<EditorPicks city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent("Editor's picks could not load")
  })

  it('先发的慢请求后返回时不覆盖新城市结果', async () => {
    let resolveSlow: (value: ListResult<EditorPick>) => void = () => undefined
    const slow = new Promise<ListResult<EditorPick>>((resolve) => {
      resolveSlow = resolve
    })
    const spy = vi.spyOn(mockRepository, 'listEditorPicks')
    spy.mockReturnValueOnce(slow)

    const { rerender } = render(<EditorPicks city="all" />)
    rerender(<EditorPicks city="beijing" />)

    expect(await screen.findByText('A walk through the Forbidden City at dusk')).toBeInTheDocument()

    const shanghaiPick = EDITOR_PICKS.find(
      (pick) => pick.titleEn === 'Plane trees and coffee on Wukang Road',
    )!

    await act(async () => {
      resolveSlow({ items: [shanghaiPick], total: 1 })
    })

    expect(screen.queryByText('Plane trees and coffee on Wukang Road')).not.toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
