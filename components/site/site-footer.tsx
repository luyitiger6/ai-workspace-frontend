import styles from './site-footer.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wc-container ${styles.inner}`}>
        <div>
          <p className={styles.brand}>wanderchain</p>
          <p className={styles.note}>把每一次出发，写成人能看懂的路线。</p>
        </div>
        <p className={styles.meta}>MVP 预览 · 内容来自本地 Mock 契约</p>
      </div>
    </footer>
  )
}
