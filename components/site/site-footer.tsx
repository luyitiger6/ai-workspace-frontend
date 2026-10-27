import styles from './site-footer.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wc-container ${styles.inner}`}>
        <div>
          <p className={styles.brand}>wanderchain</p>
          <p className={styles.note}>Every trip, written as a route a person can follow.</p>
        </div>
        <p className={styles.meta}>MVP preview · Content comes from a local mock contract</p>
      </div>
    </footer>
  )
}
