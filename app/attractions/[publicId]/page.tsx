import { AttractionDetail } from '@/components/attractions/attraction-detail'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import styles from '../attractions.module.css'

interface AttractionDetailPageProps {
  params: Promise<{ publicId: string }>
}

/**
 * 详情页只解析路由参数，取数全在客户端：与列表页同一口径，
 * 城市不受控——详情展示景点自身的城市，不跟着 `?city=` 走。
 */
export default async function AttractionDetailPage({ params }: AttractionDetailPageProps) {
  const { publicId } = await params
  return (
    <div className={styles.page}>
      <SiteHeader />
      <AttractionDetail key={publicId} publicId={publicId} />
      <SiteFooter />
    </div>
  )
}
