/**
 * 私信输入的纯逻辑：与后端 `DmInputRules` 同一口径的即时提示，以及把
 * 「用户页地址或公开标识」归一到公开标识。真正接受与否仍由服务端决定。
 */

/** 与后端 `DmInputRules` 的上限一致；按 Unicode 码点计。 */
export const MESSAGE_MAX_CHARS = 2000

/** ULID：Crockford Base32 的 26 位大写（后端 `Ulid.generate` 的产出形状）。 */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

/** 与 Java `String.strip()` 同覆盖范围：只去首尾 U+0000–U+0020。 */
export function stripWhitespace(value: string): string {
  return value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
}

/** 与 Java `String.codePointCount` 一致：代理对按一个字符计。 */
export function codePointLength(value: string): number {
  return [...value].length
}

/**
 * 从新建会话的输入里取出对方公开标识。
 *
 * 接受两种写法：直接粘贴 26 位公开标识，或粘贴用户页地址
 * （`/users/<id>`、`https://<host>/users/<id>?from=dm`）。
 * 取路径最后一段，形状对不上就返回 `null`——前端不猜「哪一段可能是 id」，
 * 也不把非法输入拼进请求。
 */
export function parsePeerPublicId(raw: string): string | null {
  const candidate = stripWhitespace(raw)
  if (candidate === '') return null
  if (ULID_PATTERN.test(candidate)) return candidate

  let pathname: string
  try {
    // 相对地址按一个占位源解析：表单里粘贴的通常是 `/users/...` 而不是完整 URL。
    pathname = new URL(candidate, 'http://wanderchain.invalid').pathname
  } catch {
    return null
  }
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? ''
  return ULID_PATTERN.test(segment) ? segment : null
}

/** 正文校验：去空白后非空、码点不超过上限；返回可直接展示的问题文案或 null。 */
export function describeMessageProblem(content: string): string | null {
  if (stripWhitespace(content) === '') {
    return 'Write something before sending.'
  }
  if (codePointLength(content) > MESSAGE_MAX_CHARS) {
    return `Messages must be ${MESSAGE_MAX_CHARS} characters or fewer.`
  }
  return null
}
