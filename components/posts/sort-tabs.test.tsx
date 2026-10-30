import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SortTabs } from './sort-tabs'

const replaceMock = vi.hoisted(() => vi.fn())
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}))

describe('SortTabs', () => {
  afterEach(() => {
    replaceMock.mockClear()
    searchParams = new URLSearchParams()
  })

  it('默认高亮传入的排序', () => {
    render(<SortTabs active="hottest" />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('点击排序 Tab 后通过 router.replace 更新 URL', async () => {
    render(<SortTabs active="latest" />)

    await userEvent.click(screen.getByRole('tab', { name: 'Hottest' }))

    expect(replaceMock).toHaveBeenCalledWith('?sortBy=hottest', { scroll: false })
  })

  it('保留已有的查询参数', async () => {
    searchParams = new URLSearchParams('city=beijing')

    render(<SortTabs active="latest" />)

    await userEvent.click(screen.getByRole('tab', { name: 'Most discussed' }))

    expect(replaceMock).toHaveBeenCalledWith('?city=beijing&sortBy=mostDiscussed', {
      scroll: false,
    })
  })
})
