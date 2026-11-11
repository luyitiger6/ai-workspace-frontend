/**
 * 与后端 `service/profile/support/ProfileRules` 逐条对齐的资料口径。
 * 这里只做「能不能发出去」的即时提示与展示辅助，真正的接受与否仍由服务端决定。
 */

export const PROFILE_INPUT_LIMITS = {
  displayNameChars: 64,
  bioChars: 200,
  maxInterests: 5,
} as const

/**
 * Java `Character.isWhitespace` 判定的空白码点集合——`String.strip()`/`isBlank()` 的基准：
 * 含 U+0009–U+000D、U+001C–U+001F、U+0020、U+1680、U+2000–U+2006、U+2008–U+200A、
 * U+2028、U+2029、U+205F、U+3000；不含 U+00A0、U+2007、U+202F。
 */
const JAVA_WHITESPACE_CLASS =
  '[\\u0009-\\u000D\\u001C-\\u001F\\u0020\\u1680\\u2000-\\u2006\\u2008-\\u200A\\u2028\\u2029\\u205F\\u3000]'
const STRIP_PATTERN = new RegExp(`^${JAVA_WHITESPACE_CLASS}+|${JAVA_WHITESPACE_CLASS}+$`, 'g')

/** 与 Java `String.strip()` 一致：按 `Character.isWhitespace` 去首尾空白，全角空格同样在列。 */
export function stripWhitespace(value: string): string {
  return value.replace(STRIP_PATTERN, '')
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
