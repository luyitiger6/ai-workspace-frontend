import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { MessagesContent } from './messages-content'
import styles from './messages.module.css'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Private conversations between wanderchain members.',
}

export default function MessagesPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <MessagesContent />
      <SiteFooter />
    </div>
  )
}
