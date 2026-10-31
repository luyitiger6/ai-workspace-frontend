/** 与 Java String.trim() 一致，只去掉首尾 U+0000–U+0020。 */
export function normalizeCommentContent(content: string): string {
  return content.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
}

export function commentValidationError(content: string): string | null {
  const length = normalizeCommentContent(content).length
  if (length === 0) return 'Write a comment before submitting.'
  if (length > 2000) return 'Comments must be 2000 UTF-16 code units or fewer.'
  return null
}
