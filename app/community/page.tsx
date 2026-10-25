import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/site/placeholder'

export const metadata: Metadata = {
  title: '旅游社区',
  description: '看别人怎么走，也把你的路线写下来。',
}

export default function CommunityPage() {
  return (
    <PlaceholderPage
      eyebrow="Community"
      title="旅游社区"
      description="路线分享、问答与同城约伴都会放在这里。"
    />
  )
}
