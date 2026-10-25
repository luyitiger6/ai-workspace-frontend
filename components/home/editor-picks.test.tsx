import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '@/lib/home/repository'
import { EditorPicks } from './editor-picks'

describe('编辑推荐区块', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('按 sortOrder 升序展示全部精选卡片', async () => {
    render(<EditorPicks city="all" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(6)
    expect(items[0]).toHaveTextContent('在故宫的黄昏里走一圈')
    expect(items[1]).toHaveTextContent('武康路的梧桐与咖啡')
    expect(items[2]).toHaveTextContent('人民公园的一杯盖碗茶')
  })

  it('选中城市时只展示该城市与全城通用卡片', async () => {
    render(<EditorPicks city="beijing" />)

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(screen.getByText('在故宫的黄昏里走一圈')).toBeInTheDocument()
    expect(screen.getByText('七天假期，只带一个背包')).toBeInTheDocument()
    expect(screen.queryByText('武康路的梧桐与咖啡')).not.toBeInTheDocument()
  })

  it('没有匹配卡片时展示空态', async () => {
    vi.spyOn(mockRepository, 'listEditorPicks').mockResolvedValueOnce({ items: [], total: 0 })

    render(<EditorPicks city="sanya" />)

    expect(await screen.findByText(/还没有编辑精选/)).toBeInTheDocument()
  })

  it('数据源失败时展示错误态', async () => {
    vi.spyOn(mockRepository, 'listEditorPicks').mockRejectedValueOnce(new Error('mock failure'))

    render(<EditorPicks city="all" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('编辑推荐暂时没能加载出来')
  })
})
