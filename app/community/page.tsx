import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/site/placeholder'

export const metadata: Metadata = {
  title: 'Travel community',
  description: 'See how others travel, and write down your own route.',
}

export default function CommunityPage() {
  return (
    <PlaceholderPage
      eyebrow="Community"
      title="Travel community"
      description="Route sharing, questions and meet-ups with nearby travelers will live here."
    />
  )
}
