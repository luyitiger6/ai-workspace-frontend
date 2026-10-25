import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider, AiAssistantTrigger } from '@/components/home/ai-assistant'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'wanderchain · 把想去的地方走成路线',
    template: '%s · wanderchain',
  },
  description:
    'wanderchain 是一个城市旅行指南：编辑推荐的路线、热门的社区帖子与值得专程前往的景点。',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="wc-skip-link" href="#main-content">
          跳到主要内容
        </a>
        <AuthProvider>
          <AiAssistantProvider>
            {children}
            <AiAssistantTrigger variant="floating" />
          </AiAssistantProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
