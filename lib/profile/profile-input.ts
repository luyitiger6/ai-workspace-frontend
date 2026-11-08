/**
 * 与后端 `service/profile/support/ProfileRules` 逐条对齐的资料口径。
 * 这里只做「能不能发出去」的即时提示与展示辅助，真正的接受与否仍由服务端决定。
 */

export const PROFILE_INPUT_LIMITS = {
  displayNameChars: 64,
  bioChars: 200,
  maxInterests: 5,
} as const

/** 与 Java `String.strip()` 同覆盖范围：只去首尾 U+0000–U+0020。 */
export function stripWhitespace(value: string): string {
  return value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
}

/** 与 Java `String.codePointCount` 一致：代理对按一个字符计。 */
export function codePointLength(value: string): number {
  return [...value].length
}

/**
 * 头像占位的首字符：取用户看到的第一个字符，emoji 不切半，拉丁转大写。
 * 值全空白或为空时返回空串，调用方据此改用人形占位。
 */
export function firstCharacter(value: string): string {
  const stripped = stripWhitespace(value)
  if (stripped === '') return ''
  return [...stripped][0].toUpperCase()
}

/** 头像地址预检：非空的合法 http(s) 绝对地址才算数，与服务端 `normalizeCoverImage` 同口径。 */
export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}
