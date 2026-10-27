import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider, AiAssistantTrigger } from '@/components/home/ai-assistant'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'wanderchain · Turn a wish into a route',
    template: '%s · wanderchain',
  },
  description:
    'wanderchain is a city travel guide: routes our editors walked, trending community posts, and places worth a detour.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'wanderchain · Turn a wish into a route',
    description:
      'wanderchain is a city travel guide: routes our editors walked, trending community posts, and places worth a detour.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="wc-skip-link" href="#main-content">
          Skip to main content
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
