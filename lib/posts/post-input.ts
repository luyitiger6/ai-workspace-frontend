import type { PostCreateRequest, PostStatus } from '@/lib/contracts/posts'

/**
 * 与后端 `service/post/support/PostInputRules` 逐条对齐的写帖口径。
 * 这里只做「能不能发出去」的即时提示，真正的接受与否仍由服务端决定；
 * 改动先改后端常量，再来同步这里。
 */
export const POST_INPUT_LIMITS = {
  titleChars: 120,
  contentBytes: 65535,
  tagCount: 10,
  tagChars: 32,
} as const

/** 表单里的原始输入：标签是一段文本，不是数组。 */
export interface PostDraftInput {
  title: string
  content: string
  coverImage: string
  tags: string
  status: PostStatus
}

export type PostInputField = 'title' | 'content' | 'coverImage' | 'tags'

export interface PostInputIssue {
  field: PostInputField
  message: string
}

export interface PostInputReview {
  /** 按后端校验顺序排列（标题 → 正文 → 封面 → 标签），第一条即提交时的阻塞原因。 */
  issues: PostInputIssue[]
  byField: Partial<Record<PostInputField, string>>
  request: PostCreateRequest
}

/** 与 Java `String.strip()` 同覆盖范围：只去首尾 U+0000–U+0020。 */
export function stripWhitespace(value: string): string {
  return value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
}

/** 与 Java `String.codePointCount` 一致：代理对按一个字符计。 */
export function codePointLength(value: string): number {
  return [...value].length
}

/** 与 Java `getBytes(UTF_8).length` 一致：正文上限按字节计，不是按 `length`。 */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/** 中英文逗号与换行都当分隔符：去空、按值去重，并保留首次出现的顺序。 */
export function splitTags(raw: string): string[] {
  const unique = new Set<string>()
  for (const entry of raw.split(/[,，\n\r]+/)) {
    const tag = stripWhitespace(entry)
    if (tag !== '') unique.add(tag)
  }
  return [...unique]
}

/** 空封面按空串提交（后端把它归一成 null）；非法地址返回 null 以便报错。 */
function normalizeCoverImage(raw: string): string | null {
  const candidate = stripWhitespace(raw)
  if (candidate === '') return ''
  try {
    const url = new URL(candidate)
    const httpish = url.protocol === 'http:' || url.protocol === 'https:'
    return httpish && url.hostname !== '' ? candidate : null
  } catch {
    return null
  }
}

export function reviewPostInput(input: PostDraftInput): PostInputReview {
  const title = stripWhitespace(input.title)
  const titleChars = codePointLength(title)
  const contentBytes = utf8ByteLength(input.content)
  const coverImage = normalizeCoverImage(input.coverImage)
  const tags = splitTags(input.tags)
  const issues: PostInputIssue[] = []

  if (titleChars < 1) {
    issues.push({ field: 'title', message: 'Add a title before saving.' })
  } else if (titleChars > POST_INPUT_LIMITS.titleChars) {
    issues.push({ field: 'title', message: `Titles must be ${POST_INPUT_LIMITS.titleChars} characters or fewer.` })
  }

  if (stripWhitespace(input.content) === '') {
    issues.push({ field: 'content', message: 'Write something in the body before saving.' })
  } else if (contentBytes > POST_INPUT_LIMITS.contentBytes) {
    issues.push({ field: 'content', message: `The body must be ${POST_INPUT_LIMITS.contentBytes} bytes or fewer.` })
  }

  if (coverImage === null) {
    issues.push({ field: 'coverImage', message: 'Cover image must be a full http:// or https:// address.' })
  }

  if (tags.length > POST_INPUT_LIMITS.tagCount) {
    issues.push({ field: 'tags', message: `Use ${POST_INPUT_LIMITS.tagCount} tags or fewer.` })
  } else if (tags.some(tag => codePointLength(tag) > POST_INPUT_LIMITS.tagChars)) {
    issues.push({ field: 'tags', message: `Each tag must be ${POST_INPUT_LIMITS.tagChars} characters or fewer.` })
  }

  const byField: Partial<Record<PostInputField, string>> = {}
  for (const issue of issues) {
    if (!byField[issue.field]) byField[issue.field] = issue.message
  }

  return {
    issues,
    byField,
    request: {
      title,
      // 正文按原样提交：后端只判非空与字节数，落库值就是调用方给的值。
      content: input.content,
      coverImage: coverImage ?? '',
      tags,
      status: input.status,
    },
  }
}
