const countFormatter = new Intl.NumberFormat('en-US')

/**
 * 内容时间统一按中国时区展示：ISO 串带 +08:00 偏移，
 * 若不锁时区，服务端（UTC）与浏览器（本地）会算出不同日期。
 */
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Shanghai',
})

export function formatCount(value: number): string {
  return countFormatter.format(value)
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}
