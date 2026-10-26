import Link from 'next/link'
import { CITIES } from '@/lib/home/cities'
import {
  EDITOR_PICKS_LIMIT,
  HOT_ATTRACTIONS_LIMIT,
  HOT_POSTS_LIMIT,
} from '@/lib/home/repository'
import styles from './hero.module.css'

export type HeroStatLabel = '城市入口' | '编辑推荐' | '热门帖子' | '热门景点'

export interface HeroStat {
  readonly label: HeroStatLabel
  readonly value: number
}

export interface HomeHeroProps {
  readonly stats?: readonly HeroStat[]
}

const STAT_LABELS: readonly HeroStatLabel[] = ['城市入口', '编辑推荐', '热门帖子', '热门景点']

const DEFAULT_STATS: readonly HeroStat[] = [
  { label: '城市入口', value: CITIES.length },
  { label: '编辑推荐', value: EDITOR_PICKS_LIMIT },
  { label: '热门帖子', value: HOT_POSTS_LIMIT },
  { label: '热门景点', value: HOT_ATTRACTIONS_LIMIT },
]

/**
 * 概览入参要么整组采用，要么整组回退。
 * 逐项回退会拼出「编辑推荐 -1」这类自相矛盾的展示，且从界面上看不出是否生效。
 */
function resolveStats(stats: HomeHeroProps['stats']): readonly HeroStat[] {
  const valid =
    stats !== undefined &&
    stats.length === STAT_LABELS.length &&
    stats.every(
      (stat, index) =>
        stat.label === STAT_LABELS[index] && Number.isInteger(stat.value) && stat.value >= 0,
    )

  return valid ? stats : DEFAULT_STATS
}

export function HomeHero({ stats }: HomeHeroProps) {
  const overview = resolveStats(stats)

  return (
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
            {overview.map((stat) => (
              <li key={stat.label} className={styles.stat}>
                <span className={styles.statLabel}>{stat.label}</span>
                <p className={styles.statValue}>{stat.value}</p>
              </li>
            ))}
          </ul>
          <p className={styles.asideNote}>列表上限来自数据契约，城市切换即时生效。</p>
        </aside>
      </div>
    </section>
  )
}
