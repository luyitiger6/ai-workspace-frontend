import type { Metadata } from 'next'
import { MeContent } from './me-content'

export const metadata: Metadata = {
  title: 'My profile',
  description: 'Manage your wanderchain display name, avatar, bio and interests.',
}

export default function MePage() {
  return <MeContent />
}
