import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import AttractionsPage from './attractions/page'
import CommunityPage from './community/page'

// 顶栏挂载会探测一次会话（GET /api/auth/me）；占位页用例只关心站点框架，把它桩成访客态。
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 与 app/layout.tsx 一致：顶栏里的账号入口与 AI 入口都依赖这两层 Provider。 */
function renderPage(node: ReactNode) {
  return render(
    <AuthProvider>
      <AiAssistantProvider>{node}</AiAssistantProvider>
    </AuthProvider>,
  )
}

function expectSiteChrome() {
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  expect(document.getElementById('main-content')).not.toBeNull()
}

describe('占位页带上站点框架', () => {
  it('/community 同时渲染顶栏、页脚与 main-content', () => {
    renderPage(<CommunityPage />)

    expectSiteChrome()
  })

  it('/attractions 同时渲染顶栏、页脚与 main-content', () => {
    renderPage(<AttractionsPage />)

    expectSiteChrome()
  })
})
