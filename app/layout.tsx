import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '待办事项',
  description: 'Spring Boot + Next.js 最小待办应用',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
