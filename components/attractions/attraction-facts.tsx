import type { AttractionDetail } from '@/lib/attractions/types'
import styles from './attraction-detail.module.css'

/** 缺失项的英文占位：事实卡不留空，也不因为一个字段缺失就中断整页。 */
const MISSING = 'Not confirmed yet.'

interface Fact {
  term: string
  value: string
  note?: string
}

/**
 * 八项决策事实按「先解决能不能去、再解决怎么去、最后决定待多久」排序。
 * 中文地址单独成项并带用途标注：它是唯一允许出现中文字符的位置。
 */
function facts(detail: AttractionDetail): Fact[] {
  return [
    { term: 'Tickets', value: detail.ticketInfoEn ?? MISSING },
    { term: 'Opening hours', value: detail.openingHoursEn ?? MISSING },
    { term: 'Booking', value: detail.bookingInfoEn ?? MISSING },
    { term: 'Payment', value: detail.paymentInfoEn ?? MISSING },
    { term: 'Address', value: detail.addressEn ?? MISSING },
    {
      term: 'Address in Chinese',
      value: detail.addressCn ?? MISSING,
      note: 'Show this to a taxi driver.',
    },
    { term: 'Getting there', value: detail.transitEn ?? MISSING },
    { term: 'Suggested visit', value: detail.suggestedDurationEn ?? MISSING },
  ]
}

export function AttractionFacts({ detail }: { detail: AttractionDetail }) {
  return (
    <dl className={styles.facts}>
      {facts(detail).map((fact) => (
        <div key={fact.term} className={styles.fact}>
          <dt className={styles.term}>{fact.term}</dt>
          <dd className={styles.value}>
            {fact.value}
            {fact.note ? <span className={styles.note}>{fact.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
