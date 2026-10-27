import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/site/placeholder'

export const metadata: Metadata = {
  title: 'Attraction guides',
  description: 'Pick a place worth the trip, by city and by season.',
}

export default function AttractionsPage() {
  return (
    <PlaceholderPage
      eyebrow="Attractions"
      title="Attraction guides"
      description="Attraction notes sorted by city, season and crowd levels will live here."
    />
  )
}
