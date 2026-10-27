import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { searchContent } from '@/lib/search/query'
import styles from './search.module.css'

export const metadata: Metadata = {
  title: '搜索',
  description: '在 wanderchain 的全部编辑推荐、帖子与景点里查找城市与路线。',
}

type SearchParams = Record<string, string | string[] | undefined>

interface SearchPageProps {
  searchParams: Promise<SearchParams>
}

/** 与首页同一套归一化规则：只取单值查询参数。 */
function firstValue(params: SearchParams, key: string): string {
  const value = params[key]
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && value[0]) {
    return value[0]
  }
  return ''
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const outcome = searchContent(firstValue(params, 'q'))
  const asked = outcome.query !== ''

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main id="main-content" className={styles.main}>
        <div className={`wc-container ${styles.inner}`}>
          <p className="wc-eyebrow">Search</p>
          <h1 className={styles.title}>站内搜索</h1>

          {!asked ? (
            <div className={styles.state}>
              <p className={styles.stateText}>
                输入一个城市、帖子或景点的名字，从全部内容里找。首页只放最热的一屏，剩下的都在这里。
              </p>
              <Link className={styles.stateLink} href="/">
                回到首页开始逛
              </Link>
            </div>
          ) : null}

          {asked && outcome.total === 0 ? (
            <div className={styles.state}>
              <p className={styles.stateText}>没有找到与「{outcome.query}」有关的内容。</p>
              <Link className={styles.stateLink} href="/">
                回到首页看看
              </Link>
            </div>
          ) : null}

          {asked && outcome.total > 0 ? (
            <>
              <p className={styles.status}>
                关键词「{outcome.query}」共 {outcome.total} 条结果。
              </p>

              <div className={styles.groups}>
                {outcome.groups.map((group) => (
                  <section
                    key={group.kind}
                    className={styles.group}
                    aria-labelledby={`search-group-${group.kind}`}
                  >
                    <div className={styles.groupHead}>
                      <h2 id={`search-group-${group.kind}`} className={styles.groupTitle}>
                        {group.heading}
                      </h2>
                      <p className={styles.count}>{group.count} 条</p>
                    </div>

                    <ul className={styles.list}>
                      {group.items.map((item) => (
                        <li key={`${group.kind}-${item.id}`} className={styles.item}>
                          <p className={styles.itemTitle}>{item.title}</p>
                          <p className={styles.meta}>
                            {item.cityLabel} · {item.meta}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <Link className={styles.anchor} href={group.anchorHref}>
                      {group.anchorLabel} →
                    </Link>
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
