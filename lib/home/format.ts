export function formatCount(value: number): string {
  if (value >= 10000) {
    const scaled = (value / 10000).toFixed(1).replace(/\.0$/, '')
    return `${scaled} 万`
  }
  return value.toLocaleString('zh-CN')
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}
