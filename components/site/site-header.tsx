import Link from 'next/link'
import { AccountMenu } from '@/components/auth/account-menu'
import { AiAssistantTrigger } from '@/components/home/ai-assistant'
import { CurrencyTool } from '@/components/travel/currency-tool'
import { WeatherTool } from '@/components/travel/weather-tool'
import { MessageBadge } from './message-badge'
import styles from './site-header.module.css'

const NAV_ITEMS = [
  { href: '/community', label: 'Travel community' },
  { href: '/attractions', label: 'Attraction guides' },
]

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`wc-container ${styles.inner}`}>
        <Link className={styles.logo} href="/">
          <span className={styles.logoMark} aria-hidden="true" />
          wanderchain
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} className={styles.navLink} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          {/* 两个旅行工具靠左：图标触发器比文字按钮短，窄屏下先给它们留位置（design D8） */}
          <WeatherTool />
          <CurrencyTool />
          <AiAssistantTrigger variant="header" />
          <MessageBadge />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
