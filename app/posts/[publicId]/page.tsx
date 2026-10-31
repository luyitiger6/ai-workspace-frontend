import { PostDetail } from '@/components/posts/post-detail'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import type { PostSortBy } from '@/lib/posts/types'
import styles from '../page.module.css'

interface PostPageProps {
  params: Promise<{ publicId: string }>
  searchParams: Promise<{ sortBy?: string | string[] }>
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const [{ publicId }, query] = await Promise.all([params, searchParams])
  const raw = query.sortBy
  const sortBy: PostSortBy | undefined = raw === 'latest' || raw === 'hottest' || raw === 'mostDiscussed' ? raw : undefined
  return (
    <div className={styles.page}>
      <SiteHeader />
      <PostDetail key={publicId} publicId={publicId} sortBy={sortBy} />
      <SiteFooter />
    </div>
  )
}
