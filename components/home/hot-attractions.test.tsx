import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '@/lib/home/repository'
import { HotAttractions } from './hot-attractions'

describe('热门景点区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('最多展示 5 个景点并按浏览量排序', async () => {
    render(<HotAttractions city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('故宫博物院')
    expect(items[1]).toHaveTextContent('外滩')
    expect(items[4]).toHaveTextContent('亚龙湾')
  })

  it('封面图按响应式档位出图并延迟加载', async () => {
    render(<HotAttractions city="all" />)

    const covers = await screen.findAllByRole('img', { name: /封面$/ })

    expect(covers).toHaveLength(5)

    for (const cover of covers) {
      const srcset = cover.getAttribute('srcset') ?? ''

      // jsdom 里 next/image 不加载 next.config.ts 的 images 配置，走的是默认 loader，
      // 因此这里只验证属性产出；档位改写规则由 lib/image-loader.test.ts 覆盖，
      // 自定义 loader 的实际接入由浏览器实测确认。
      expect(srcset).toContain('images.unsplash.com')
      expect(srcset.split(',').length).toBeGreaterThan(1)
      expect(cover.getAttribute('sizes')).toBe(
        '(max-width: 720px) calc(50vw - 40px), (max-width: 1080px) calc(33.33vw - 38px), (min-width: 1160px) 204px, calc(20vw - 29px)',
      )
      expect(cover).toHaveAttribute('loading', 'lazy')
      expect(cover).toHaveAttribute('decoding', 'async')
    }
  })

  it('不展示草稿与已删除景点', async () => {
    render(<HotAttractions city="all" />)

    await screen.findAllByRole('listitem')

    expect(screen.queryByText('未开放的观景台')).not.toBeInTheDocument()
    expect(screen.queryByText('已下线的旧景点')).not.toBeInTheDocument()
  })

  it('没有景点时展示空态', async () => {
    vi.spyOn(mockRepository, 'listHotAttractions').mockResolvedValueOnce({ items: [], total: 0 })

    render(<HotAttractions city="sanya" />)

    expect(await screen.findByText(/还没有收录景点/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(mockRepository, 'listHotAttractions').mockRejectedValueOnce(
      new Error('mock failure'),
    )

    render(<HotAttractions city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('热门景点暂时没能加载出来')
  })
})
