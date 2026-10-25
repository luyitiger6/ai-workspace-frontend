import Link from 'next/link'
import styles from './placeholder.module.css'

interface Props {
  eyebrow: string
  title: string
  description: string
}

/** 尚未开发的板块统一走这个占位页，保证入口不会落进 404。 */
export function PlaceholderPage({ eyebrow, title, description }: Props) {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <p className={styles.note}>这个板块正在建设中，先把首页逛熟。</p>
        <div className={styles.actions}>
          <Link className="wc-button wc-button--primary" href="/">
            回到首页
          </Link>
        </div>
      </div>
    </main>
  )
}
