import { CitySwitcher } from '@/components/home/city-switcher'
import { EditorPicks } from '@/components/home/editor-picks'
import { FeatureNav } from '@/components/home/feature-nav'
import { HashAnchorRestorer } from '@/components/home/hash-anchor-restorer'
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
  // Next 在某些调用下（比如直接以组件方式渲染）可能拿不到 searchParams，缺省按空参数处理。
  const params = (await searchParams) ?? {}
  const city = parseCity(params.city)
  const query = toQuery(params)

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main id="main-content" className={styles.main}>
        <HashAnchorRestorer />
        <HomeHero />

        <div className={`wc-container ${styles.sections}`}>
          <SectionBoundary title="Feature entrances">
            <FeatureNav />
          </SectionBoundary>

          <SectionBoundary title="City picker">
            <CitySwitcher activeCity={city} query={query} />
          </SectionBoundary>

          <SectionBoundary title="Editor's picks">
            <EditorPicks city={city} />
          </SectionBoundary>

          <SectionBoundary title="Trending posts">
            <HotPosts city={city} />
          </SectionBoundary>

          <SectionBoundary title="Popular attractions">
            <HotAttractions city={city} />
          </SectionBoundary>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
