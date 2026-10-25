'use client'

import { useRouter } from 'next/navigation'
import { CITIES, cityName } from '@/lib/home/cities'
import type { CitySlug } from '@/lib/home/types'
import styles from './city-switcher.module.css'

interface Props {
  activeCity: CitySlug
  query: Record<string, string>
}

export function CitySwitcher({ activeCity, query }: Props) {
  const router = useRouter()
  const active = CITIES.find((city) => city.slug === activeCity) ?? CITIES[0]

  function select(slug: CitySlug) {
    if (slug === activeCity) {
      return
    }

    const params = new URLSearchParams(query)
    if (slug === 'all') {
      params.delete('city')
    } else {
      params.set('city', slug)
    }

    const search = params.toString()
    router.replace(search ? `/?${search}` : '/')
  }

  return (
    <section
      id="cities"
      className={styles.section}
      data-section="city-switcher"
      aria-labelledby="city-switcher-title"
    >
      <div className="wc-container">
        <div className="wc-section-head">
          <div>
            <p className="wc-eyebrow">Cities</p>
            <h2 id="city-switcher-title" className="wc-section-title">
              先选一座城
            </h2>
          </div>
          <p className="wc-section-note">
            当前：{cityName(activeCity)} · {active.tagline}
          </p>
        </div>

        <ul className={styles.list}>
          {CITIES.map((city) => {
            const isActive = city.slug === activeCity
            return (
              <li key={city.slug}>
                <button
                  type="button"
                  className={isActive ? `${styles.chip} ${styles.active}` : styles.chip}
                  aria-pressed={isActive}
                  onClick={() => select(city.slug)}
                >
                  {city.name}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
