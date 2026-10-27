import Link from 'next/link'
import { AccountMenu } from '@/components/auth/account-menu'
import { AiAssistantTrigger } from '@/components/home/ai-assistant'
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
          <AiAssistantTrigger variant="header" />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
