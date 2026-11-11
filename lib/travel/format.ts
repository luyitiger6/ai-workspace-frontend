/**
 * 汇率数值的展示精度（spec「汇率数值的展示精度」）。
 *
 * 按数量级决定小数位：大于等于 1 保留两位，小于 1 保留四位。理由是展示效率——
 * 日元这类量级用两位已经能看出波动，而美元这类小于 1 的币种用两位会把差异抹平
 * （0.15 与 0.1495 在两位精度下看不出区别）。
 *
 * `toFixed` 不会产出科学计数法，因此 spec 那条约束在这里是结构性满足的，
 * 不需要额外分支。
 */
export function formatRate(value: number): string {
  // 理论上到不了这里：服务端已保证数值可用、且缺项即整体失败。
  // 但渲染层宁可显示占位符，也不能把 NaN 或 Infinity 直接印在页面上。
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(Math.abs(value) >= 1 ? 2 : 4)
}
