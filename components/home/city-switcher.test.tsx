import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CitySwitcher } from './city-switcher'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

describe('城市快速入口', () => {
  beforeEach(() => {
    replace.mockClear()
  })

  it('展示 8 个 MVP 城市入口', () => {
    render(<CitySwitcher activeCity="all" query={{}} />)

    expect(screen.getAllByRole('button')).toHaveLength(8)
    expect(screen.getByRole('button', { name: '北京' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '三亚' })).toBeInTheDocument()
  })

  it('点击城市把 slug 写入 city 查询参数', () => {
    render(<CitySwitcher activeCity="all" query={{}} />)

    fireEvent.click(screen.getByRole('button', { name: '北京' }))

    expect(replace).toHaveBeenCalledWith('/?city=beijing')
  })

  it('选中 all 时删除 city 参数', () => {
    render(<CitySwitcher activeCity="beijing" query={{ city: 'beijing' }} />)

    fireEvent.click(screen.getByRole('button', { name: '全部' }))

    expect(replace).toHaveBeenCalledWith('/')
  })

  it('切换城市时保留其他查询参数', () => {
    render(<CitySwitcher activeCity="beijing" query={{ city: 'beijing', ref: 'home' }} />)

    fireEvent.click(screen.getByRole('button', { name: '上海' }))

    expect(replace).toHaveBeenCalledTimes(1)
    const target = replace.mock.calls[0][0] as string
    expect(target).toContain('city=shanghai')
    expect(target).toContain('ref=home')
  })

  it('当前城市处于高亮态且唯一', () => {
    render(<CitySwitcher activeCity="hangzhou" query={{ city: 'hangzhou' }} />)

    const pressed = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')

    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('杭州')
  })

  it('重复点击当前城市不产生新的导航', () => {
    render(<CitySwitcher activeCity="sanya" query={{ city: 'sanya' }} />)

    fireEvent.click(screen.getByRole('button', { name: '三亚' }))

    expect(replace).not.toHaveBeenCalled()
  })
})
