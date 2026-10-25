import Link from 'next/link'
import { CitySwitcher } from '@/components/home/city-switcher'
import { EditorPicks } from '@/components/home/editor-picks'
import { FeatureNav } from '@/components/home/feature-nav'
import { HotAttractions } from '@/components/home/hot-attractions'
import { HotPosts } from '@/components/home/hot-posts'
import { SectionBoundary } from '@/components/home/section-boundary'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { CITIES, parseCity } from '@/lib/home/cities'
import {
  EDITOR_PICKS_LIMIT,
  HOT_ATTRACTIONS_LIMIT,
  HOT_POSTS_LIMIT,
} from '@/lib/home/repository'
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
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={`wc-container ${styles.heroInner}`}>
            <div>
              <p className="wc-eyebrow">wanderchain · 城市旅行指南</p>
              <h1 id="hero-title" className={styles.title}>
                把想去的地方，走成一条能出发的路线。
              </h1>
              <p className={styles.lead}>
                七座城市，三种入口：看编辑走过的路线，翻最近被讨论的帖子，或者先挑一个景点。
                内容来自本地 Mock 契约，真实接口接入后界面不用重写。
              </p>
              <div className={styles.actions}>
                <Link className="wc-button wc-button--primary" href="/community">
                  进入旅游社区
                </Link>
                <Link className="wc-button wc-button--ghost" href="/attractions">
                  查看景点攻略
                </Link>
                <a className={styles.textLink} href="#cities">
                  按城市逛 →
                </a>
              </div>
              <p className={styles.meta}>当前城市会影响下方三类内容的范围。</p>
            </div>

            <aside className={styles.aside} aria-labelledby="hero-aside-title">
              <h2 id="hero-aside-title" className={styles.asideTitle}>
                本期一览
              </h2>
              <ul className={styles.stats}>
                <li className={styles.stat}>
                  <span className={styles.statLabel}>城市入口</span>
                  <p className={styles.statValue}>{CITIES.length}</p>
                </li>
                <li className={styles.stat}>
                  <span className={styles.statLabel}>编辑推荐</span>
                  <p className={styles.statValue}>{EDITOR_PICKS_LIMIT}</p>
                </li>
                <li className={styles.stat}>
                  <span className={styles.statLabel}>热门帖子</span>
                  <p className={styles.statValue}>{HOT_POSTS_LIMIT}</p>
                </li>
                <li className={styles.stat}>
                  <span className={styles.statLabel}>热门景点</span>
                  <p className={styles.statValue}>{HOT_ATTRACTIONS_LIMIT}</p>
                </li>
              </ul>
              <p className={styles.asideNote}>列表上限来自数据契约，城市切换即时生效。</p>
            </aside>
          </div>
        </section>

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
