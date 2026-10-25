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
