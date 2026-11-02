import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import styles from '../../editor-page.module.css'
import { EditPostView } from './edit-post-view'

interface EditPostPageProps {
  params: Promise<{ publicId: string }>
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { publicId } = await params
  return (
    <div className={styles.page}>
      <SiteHeader />
      <EditPostView key={publicId} publicId={publicId} />
      <SiteFooter />
    </div>
  )
}
