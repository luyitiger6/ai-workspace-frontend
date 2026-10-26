import { CitySwitcher } from '@/components/home/city-switcher'
import { EditorPicks } from '@/components/home/editor-picks'
import { FeatureNav } from '@/components/home/feature-nav'
import { HomeHero } from '@/components/home/hero'
import { HotAttractions } from '@/components/home/hot-attractions'
import { HotPosts } from '@/components/home/hot-posts'
import { SectionBoundary } from '@/components/home/section-boundary'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { parseCity } from '@/lib/home/cities'
import styles from './home.module.css'

type SearchParams = Record<string, string | string[] | undefined>

interface HomePageProps {
  searchParams: Promise<SearchParams>
}

/** 只保留单值查询参数，交给城市入口做替换而非丢弃。 */
function toQuery(params: SearchParams): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query[key] = value
    } else if (Array.isArray(value) && value[0]) {
      query[key] = value[0]
    }
  }
  return query
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const city = parseCity(params.city)
  const query = toQuery(params)

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main id="main-content" className={styles.main}>
        <HomeHero />

        <div className={`wc-container ${styles.sections}`}>
          <SectionBoundary title="功能入口">
            <FeatureNav />
          </SectionBoundary>

          <SectionBoundary title="城市入口">
            <CitySwitcher activeCity={city} query={query} />
          </SectionBoundary>

          <SectionBoundary title="编辑推荐">
            <EditorPicks city={city} />
          </SectionBoundary>

          <SectionBoundary title="热门帖子">
            <HotPosts city={city} />
          </SectionBoundary>

          <SectionBoundary title="热门景点">
            <HotAttractions city={city} />
          </SectionBoundary>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
