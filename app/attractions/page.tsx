import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/site/placeholder'

export const metadata: Metadata = {
  title: '景点攻略',
  description: '按城市与季节，挑一个不踩雷的地方。',
}

export default function AttractionsPage() {
  return (
    <PlaceholderPage
      eyebrow="Attractions"
      title="景点攻略"
      description="按城市、季节与人流整理的景点笔记会放在这里。"
    />
  )
}
