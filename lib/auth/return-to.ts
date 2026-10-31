/** 参数已经由 URLSearchParams 解码一次；不再解码，不规范化未知地址。 */
export function safeReturnTo(next: string | null | undefined): string | null {
  if (!next || next.length !== 33) return null
  return /^\/posts\/[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(next) ? next : null
}

/** 互转与互动引导只携带允许列表中的目标，不携带账户或输入。 */
export function authHref(mode: 'login' | 'register', next?: string | null): string {
  const target = safeReturnTo(next)
  return target ? `/${mode}?${new URLSearchParams({ next: target })}` : `/${mode}`
}
