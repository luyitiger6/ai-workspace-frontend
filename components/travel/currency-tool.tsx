'use client'

import { useCallback, useEffect, useState } from 'react'
import { describeTravelError, travelApi } from '@/lib/travel/travel-api'
import type { CurrencyResponse } from '@/lib/contracts/travel'
import { formatRate } from '@/lib/travel/format'
import { TravelPopover } from './travel-popover'
import styles from './currency-tool.module.css'

/**
 * 数据源对署名有明确义务（spec「汇率的署名义务」），链接与文案都写死在这里，
 * 不放进配置：改了要跟着 spec 一起改，配置化只会让漏改更难发现。
 */
const ATTRIBUTION_URL = 'https://www.exchangerate-api.com'

const CURRENCY_LABELS: Record<string, string> = {
  JPY: 'Japanese yen',
  USD: 'US dollar',
  EUR: 'Euro',
  THB: 'Thai baht',
  HKD: 'Hong Kong dollar',
}

/** 更新日期按 UTC 取：源站每天只更新一次，换成本地日期会让同一份数据在东西半球显示不同天。 */
function formatUpdatedOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toISOString().slice(0, 10)
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9 8l3 4 3-4M12 12v5M9.5 13.5h5M9.5 15.5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function CurrencyPanel({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [table, setTable] = useState<CurrencyResponse | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isOpen) return

    const controller = new AbortController()
    let active = true
    setStatus('loading')
    // 失败时屏幕上是提示而不是上一轮的数字：汇率是数值，留旧值最容易被当成新值
    setTable(null)
    setError('')

    travelApi
      .currency(controller.signal)
      .then((value) => {
        if (!active) return
        setTable(value)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(describeTravelError(cause))
        setStatus('error')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [isOpen, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <h2 className={styles.title}>Exchange rates</h2>
        <button
          type="button"
          className={styles.close}
          onClick={close}
          aria-label="Close the exchange rates tool"
        >
          ×
        </button>
      </div>

      <p className={styles.lead}>1 {table?.base ?? 'CNY'} buys</p>

      {status === 'loading' ? (
        <p className={styles.muted} data-testid="currency-loading">
          Loading…
        </p>
      ) : null}

      {status === 'error' ? (
        <div data-testid="currency-error">
          <p className={styles.errorText}>{error}</p>
          <button type="button" className={styles.retry} onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}

      {status === 'ready' && table ? (
        <>
          <dl className={styles.rates} data-testid="currency-rates">
            {table.rates.map((rate) => (
              <div className={styles.row} key={rate.code}>
                <dt>
                  <span className={styles.code}>{rate.code}</span>
                  <span className={styles.label}>{CURRENCY_LABELS[rate.code] ?? rate.code}</span>
                </dt>
                <dd>{formatRate(rate.value)}</dd>
              </div>
            ))}
          </dl>
          {/* 只写更新日期：数据源每天更新一次，这里出现「live / real-time」就是撒谎 */}
          <p className={styles.stamp}>Updated {formatUpdatedOn(table.updatedAt)}</p>
        </>
      ) : null}

      <p className={styles.attribution}>
        Rates by{' '}
        <a href={ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer">
          ExchangeRate-API
        </a>
      </p>
    </div>
  )
}

export function CurrencyTool() {
  return (
    <TravelPopover
      label="Exchange rates"
      triggerTestId="currency-trigger"
      panelTestId="currency-panel"
      icon={<CoinIcon />}
    >
      {({ isOpen, close }) => <CurrencyPanel isOpen={isOpen} close={close} />}
    </TravelPopover>
  )
}
