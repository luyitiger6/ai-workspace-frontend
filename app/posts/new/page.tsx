import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import styles from '../editor-page.module.css'
import { NewPostView } from './new-post-view'

export default function NewPostPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <NewPostView />
      <SiteFooter />
    </div>
  )
}
