import styles from './section-state.module.css'

/** 内容区块共用的三态展示：加载、失败、空数据。 */
export function SectionLoading({ label }: { label: string }) {
  return (
    <p className={styles.state} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </p>
  )
}

export function SectionError({ message }: { message: string }) {
  return (
    <p className={`${styles.state} ${styles.error}`} role="alert">
      {message}
    </p>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <p className={`${styles.state} ${styles.empty}`}>{message}</p>
}
