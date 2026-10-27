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
        <p className={`wc-eyebrow ${styles.eyebrow}`}>wanderchain · City travel guide</p>
        <h1 id="hero-title" className={styles.title}>
          Turn a place you want to see into a route you can start today.
        </h1>
        <p className={styles.lead}>
          {CITY_COUNT} cities, routes walked by our editors, posts being discussed right now, and
          places worth the detour — all behind one search box.
        </p>

        <form className={styles.search} action="/search" method="get" role="search">
          <label className="wc-visually-hidden" htmlFor="hero-search">
            Search cities, posts or attractions
          </label>
          <input
            id="hero-search"
            className={styles.searchInput}
            type="search"
            name="q"
            placeholder="Search cities, posts or attractions, e.g. Chengdu"
            autoComplete="off"
            required
          />
          <button className="wc-button wc-button--primary" type="submit">
            Search
          </button>
        </form>

        <p className={styles.links}>
          <Link className={styles.link} href="/community">
            Enter the travel community
          </Link>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <Link className={styles.link} href="/attractions">
            Browse attraction guides
          </Link>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <a className={styles.link} href="#cities">
            Browse by city →
          </a>
        </p>

        <p className={styles.meta}>
          Currently covering {CITY_COUNT} cities, re-walked by our editors every week.
        </p>
      </div>
    </section>
  )
}
