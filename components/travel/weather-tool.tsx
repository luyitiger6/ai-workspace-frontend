'use client'

import { useCallback, useEffect, useState } from 'react'
import { describeTravelError, travelApi } from '@/lib/travel/travel-api'
import type { WeatherResponse } from '@/lib/contracts/travel'
import { TravelPopover } from './travel-popover'
import styles from './weather-tool.module.css'

/**
 * 城市清单是平台既有的七个城市，与后端 `TravelProperties.cities` 一一对应（spec 明写不允许自由输入）。
 * 这里写死而不是从后端拉：清单变了要同步改后端配置，拉取只会把一次配置错误变成一次运行时空白。
 */
const CITIES = [
  { slug: 'beijing', label: 'Beijing' },
  { slug: 'shanghai', label: 'Shanghai' },
  { slug: 'guangzhou', label: 'Guangzhou' },
  { slug: 'chengdu', label: 'Chengdu' },
  { slug: 'xian', label: "Xi'an" },
  { slug: 'hangzhou', label: 'Hangzhou' },
  { slug: 'sanya', label: 'Sanya' },
] as const

const DEFAULT_CITY = 'beijing'
const STORAGE_KEY = 'wanderchain.travel.weather.city'

type CitySlug = (typeof CITIES)[number]['slug']

function isSupportedCity(value: string | null): value is CitySlug {
  return CITIES.some((city) => city.slug === value)
}

/** 读到非法 slug 或存储被禁用（隐私模式会抛）时回落北京，不向界面抛错（design D9）。 */
function readStoredCity(): CitySlug {
  if (typeof window === 'undefined') return DEFAULT_CITY
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isSupportedCity(stored) ? stored : DEFAULT_CITY
  } catch {
    return DEFAULT_CITY
  }
}

function rememberCity(city: CitySlug) {
  try {
    window.localStorage.setItem(STORAGE_KEY, city)
  } catch {
    // 存不下就只在本次会话里生效，功能不因为禁用存储而失效
  }
}

/**
 * 观测时间按 UTC 展示并显式标注时区。
 * 后端给的是数据源的观测时刻（带 Z），换算成本地时间会让「17:15」在不同机器上变成不同数字，
 * 同一个结果在不同用户那里读起来像是两个数据。
 */
function formatObservedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hours}:${minutes} UTC`
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function WeatherPanel({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const [city, setCity] = useState<CitySlug>(DEFAULT_CITY)
  const [status, setStatus] = useState<Status>('idle')
  const [reading, setReading] = useState<WeatherResponse | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  // localStorage 只能在挂载后读：服务端渲染拿不到它，写进 initializer 会造成水合不一致。
  // 面板默认收起且收起时不取数，所以这次修正不会浪费一次请求。
  useEffect(() => {
    setCity(readStoredCity())
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const controller = new AbortController()
    let active = true
    setStatus('loading')
    // 先清空上一次结果：切换城市后失败时，屏幕上是失败提示而不是旧城市的天气
    setReading(null)
    setError('')

    travelApi
      .weather(city, controller.signal)
      .then((value) => {
        if (!active) return
        setReading(value)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        // 关闭浮层或再次切换时旧请求被取消，它的失败不再代表当前城市
        if (!active) return
        setError(describeTravelError(cause))
        setStatus('error')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [isOpen, city, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const onCityChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (!isSupportedCity(next)) return
    setCity(next)
    rememberCity(next)
  }, [])

  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <h2 className={styles.title}>Weather</h2>
        <button
          type="button"
          className={styles.close}
          onClick={close}
          aria-label="Close the weather tool"
        >
          ×
        </button>
      </div>

      <label className={styles.field} htmlFor="travel-weather-city">
        City
      </label>
      <select
        id="travel-weather-city"
        className={styles.select}
        value={city}
        onChange={onCityChange}
      >
        {CITIES.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.label}
          </option>
        ))}
      </select>

      <div className={styles.result}>
        {status === 'loading' ? (
          <p className={styles.muted} data-testid="weather-loading">
            Loading…
          </p>
        ) : null}

        {status === 'error' ? (
          <div data-testid="weather-error">
            <p className={styles.errorText}>{error}</p>
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          </div>
        ) : null}

        {status === 'ready' && reading ? (
          <dl className={styles.reading} data-testid="weather-reading">
            <div className={styles.row}>
              <dt>City</dt>
              <dd>{reading.cityName}</dd>
            </div>
            <div className={styles.row}>
              <dt>Temperature</dt>
              <dd>{Math.round(reading.temperatureC)}°C</dd>
            </div>
            <div className={styles.row}>
              <dt>Condition</dt>
              <dd>{reading.condition}</dd>
            </div>
            <div className={styles.row}>
              <dt>Wind</dt>
              <dd>{Math.round(reading.windSpeedKph)} km/h</dd>
            </div>
            <div className={styles.row}>
              <dt>Observed</dt>
              {/* 只陈述观测时刻，不写「live / now」：结果可能是服务端缓存，不能暗示实时 */}
              <dd>{formatObservedAt(reading.observedAt)}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  )
}

export function WeatherTool() {
  return (
    <TravelPopover
      label="Weather"
      triggerTestId="weather-trigger"
      panelTestId="weather-panel"
      icon={<SunIcon />}
    >
      {({ isOpen, close }) => <WeatherPanel isOpen={isOpen} close={close} />}
    </TravelPopover>
  )
}
