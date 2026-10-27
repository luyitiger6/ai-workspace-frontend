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
        <p className={styles.note}>This section is still being built. Start from the homepage.</p>
        <div className={styles.actions}>
          <Link className="wc-button wc-button--primary" href="/">
            Back to homepage
          </Link>
        </div>
      </div>
    </main>
  )
}
