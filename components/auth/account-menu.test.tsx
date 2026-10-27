import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { loginWithPassword } from '@/lib/auth/mock-auth'
import { AccountMenu } from './account-menu'
import { AuthProvider } from './auth-provider'

function renderMenu() {
  return render(
    <AuthProvider>
      <AccountMenu />
    </AuthProvider>,
  )
}

describe('账号入口', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('访客看到登录入口', async () => {
    renderMenu()

    expect(await screen.findByRole('link', { name: 'Log in / Sign up' })).toBeInTheDocument()
  })

  it('已登录用户看到用户名与角色标记', async () => {
    await loginWithPassword('admin@wanderchain.dev', 'admin123')

    renderMenu()

    expect(await screen.findByText('Editor Lan')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('退出后回到访客态', async () => {
    await loginWithPassword('traveler@wanderchain.dev', 'traveler123')
    renderMenu()

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('link', { name: 'Log in / Sign up' })).toBeInTheDocument()
    expect(screen.queryByText('Traveler Zhou')).not.toBeInTheDocument()
  })

  it('普通用户不显示编辑标记', async () => {
    await loginWithPassword('traveler@wanderchain.dev', 'traveler123')

    renderMenu()

    expect(await screen.findByText('Traveler Zhou')).toBeInTheDocument()
    expect(screen.queryByText('Editor')).not.toBeInTheDocument()
  })
})
