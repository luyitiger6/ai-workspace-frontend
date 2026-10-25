import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '@/lib/home/repository'
import { HotPosts } from './hot-posts'

describe('热门帖子区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('最多展示 10 条帖子并按热度排序', async () => {
    render(<HotPosts city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(10)
    expect(items[0]).toHaveTextContent('成都的雨，落进了盖碗茶里')
    expect(items[1]).toHaveTextContent('外滩的风，从黄昏吹到夜里')
  })

  it('不展示草稿与已删除帖子', async () => {
    render(<HotPosts city="all" />)

    await screen.findAllByRole('listitem')

    expect(screen.queryByText('在故宫闭馆前的最后半小时')).not.toBeInTheDocument()
    expect(screen.queryByText('已删除的旧帖')).not.toBeInTheDocument()
  })

  it('没有帖子时展示空态', async () => {
    vi.spyOn(mockRepository, 'listHotPosts').mockResolvedValueOnce({ items: [], total: 0 })

    render(<HotPosts city="beijing" />)

    expect(await screen.findByText(/还没有帖子/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(mockRepository, 'listHotPosts').mockRejectedValueOnce(new Error('mock failure'))

    render(<HotPosts city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('热门帖子暂时没能加载出来')
  })
})
