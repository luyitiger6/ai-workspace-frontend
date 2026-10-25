'use client'

import Link from 'next/link'
import { useAiAssistant } from './ai-assistant'
import styles from './feature-nav.module.css'

function CommunityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3.2" fill="currentColor" />
      <circle cx="17" cy="9.5" r="2.4" fill="currentColor" opacity="0.65" />
      <path
        d="M3.4 19c.5-3.2 2.8-5 5.6-5s5.1 1.8 5.6 5H3.4z"
        fill="currentColor"
      />
      <path
        d="M14.6 19c.3-2 1.4-3.4 3.2-3.9 1.9.4 3 1.8 3.2 3.9h-6.4z"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M12 21s6.4-6.1 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 14.9 12 21 12 21z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10.4" r="2.2" fill="currentColor" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
    </svg>
  )
}

const LINK_ENTRIES = [
  {
    key: 'community',
    href: '/community',
    title: '旅游社区',
    description: '看别人怎么走，也把你的路线写下来。',
    action: '进入社区',
    Icon: CommunityIcon,
    tone: 'green' as const,
  },
  {
    key: 'attractions',
    href: '/attractions',
    title: '景点攻略',
    description: '按城市与季节，挑一个不踩雷的地方。',
    action: '查看攻略',
    Icon: MapIcon,
    tone: 'sand' as const,
  },
]

export function FeatureNav() {
  const { open } = useAiAssistant()

  return (
    <section className={styles.section} data-section="feature-nav" aria-labelledby="feature-nav-title">
      <div className="wc-container">
        <div className="wc-section-head">
          <div>
            <p className="wc-eyebrow">Explore</p>
            <h2 id="feature-nav-title" className="wc-section-title">
              从哪里开始
            </h2>
          </div>
          <p className="wc-section-note">三个入口，覆盖逛、查、问三件事。</p>
        </div>

        <ul className={styles.grid} data-layout="grid">
          {LINK_ENTRIES.map(({ key, href, title, description, action, Icon, tone }) => (
            <li key={key} className={`${styles.card} ${styles[tone]}`}>
              <Link className={styles.cardLink} href={href}>
                <span className={styles.icon}>
                  <Icon />
                </span>
                <span className={styles.cardTitle}>{title}</span>
                <span className={styles.cardText}>{description}</span>
                <span className={styles.action}>{action} →</span>
              </Link>
            </li>
          ))}

          <li className={`${styles.card} ${styles.accent}`}>
            <button type="button" className={styles.cardLink} onClick={open}>
              <span className={styles.icon}>
                <SparkIcon />
              </span>
              <span className={styles.cardTitle}>AI 助手</span>
              <span className={styles.cardText}>把行程、预算和疑问交给它。</span>
              <span className={styles.action}>打开占位面板 →</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  )
}
