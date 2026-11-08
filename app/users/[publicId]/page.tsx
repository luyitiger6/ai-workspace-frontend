import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { UserPageContent } from './user-page-content'
import styles from './user-page.module.css'

interface UserPageProps {
  params: Promise<{ publicId: string }>
}

/**
 * 用户页只解析路由参数，资料与列表的取数、四态与重试都在客户端视图里：
 * 公开页恒走真接口，不把 `USE_MOCK_PROFILE` 这类运行期开关带进服务端组件（design D6）。
 */
export default async function UserPage({ params }: UserPageProps) {
  const { publicId } = await params
  return (
    <div className={styles.page}>
      <SiteHeader />
      <UserPageContent key={publicId} publicId={publicId} />
      <SiteFooter />
    </div>
  )
}
