import styles from './post-card-skeleton.module.css'

export function PostCardSkeleton() {
  return (
    <article className={styles.card} aria-busy="true" aria-label="Loading post">
      <div className={styles.cover} />
      <div className={styles.body}>
        <div className={styles.title} />
        <div className={styles.summary} />
        <div className={styles.summaryShort} />
        <div className={styles.meta} />
        <div className={styles.stats} />
      </div>
    </article>
  )
}
