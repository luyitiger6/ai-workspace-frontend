import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { Conversation } from './conversation'
import styles from '../messages.module.css'

interface ConversationPageProps {
  params: Promise<{ publicId: string }>
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { publicId } = await params
  return (
    <div className={styles.page}>
      <SiteHeader />
      <Conversation key={publicId} publicId={publicId} />
      <SiteFooter />
    </div>
  )
}
