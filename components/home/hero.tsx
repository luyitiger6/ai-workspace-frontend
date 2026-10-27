import Image from 'next/image'
import Link from 'next/link'

import { CITIES } from '@/lib/home/cities'
import styles from './hero.module.css'

/** 与编辑推荐同源的 Unsplash photoId，由自定义 loader 按 sizes 直接向 CDN 要档位。 */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=70'

/** 城市规模只从白名单派生：all 是筛选项，不是一座城市。 */
const CITY_COUNT = CITIES.filter((city) => city.slug !== 'all').length

export function HomeHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.media} aria-hidden="true">
        <Image className={styles.image} src={HERO_IMAGE} alt="" fill priority sizes="100vw" />
      </div>
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.fade} aria-hidden="true" />

      <div className={`wc-container ${styles.inner}`}>
        <p className={`wc-eyebrow ${styles.eyebrow}`}>wanderchain · 城市旅行指南</p>
        <h1 id="hero-title" className={styles.title}>
          把想去的地方，走成一条能出发的路线。
        </h1>
        <p className={styles.lead}>
          {CITY_COUNT} 座城市，编辑走过的路线、正在被讨论的帖子与值得专程前往的景点，
          都在同一个搜索框里。
        </p>

        <form className={styles.search} action="/search" method="get" role="search">
          <label className="wc-visually-hidden" htmlFor="hero-search">
            搜索城市、帖子或景点
          </label>
          <input
            id="hero-search"
            className={styles.searchInput}
            type="search"
            name="q"
            placeholder="搜城市、帖子或景点，例如「成都」"
            autoComplete="off"
            required
          />
          <button className="wc-button wc-button--primary" type="submit">
            搜索
          </button>
        </form>

        <p className={styles.links}>
          <Link className={styles.link} href="/community">
            进入旅游社区
          </Link>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <Link className={styles.link} href="/attractions">
            查看景点攻略
          </Link>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <a className={styles.link} href="#cities">
            按城市逛 →
          </a>
        </p>

        <p className={styles.meta}>当前覆盖 {CITY_COUNT} 座城市，每周由编辑重新走一遍。</p>
      </div>
    </section>
  )
}
