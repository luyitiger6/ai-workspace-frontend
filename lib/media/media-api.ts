import { MEDIA_ENDPOINTS, type MediaUploadResponse } from '@/lib/contracts/media'

export class MediaApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'MediaApiError'
  }
}

export class MediaNetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.')
    this.name = 'MediaNetworkError'
  }
}

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Your session has expired. Log in to continue.',
  VALIDATION_FAILED: 'That image cannot be uploaded. Use a JPEG, PNG or WebP file no larger than 5 MB.',
  CROSS_SITE_REJECTED: 'The request was rejected because its origin is not trusted.',
}

/** 上传失败的可读文案；未知错误码保留真实状态码，不虚构业务含义。 */
export function describeMediaError(cause: unknown): string {
  if (cause instanceof MediaNetworkError) return cause.message
  if (!(cause instanceof MediaApiError)) return 'Something went wrong. Please try again.'
  return MESSAGES[cause.code] ?? `Upload failed with status ${cause.status}. Please try again.`
}

/** 取消异常可来自浏览器/不同执行环境，不依赖 Error 构造器身份。 */
function isAbortError(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError'
}

/** 服务端上限的同口径镜像：只用于选择文件后的即时提示，真正的判定在服务端。 */
export const COVER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

/** 文件选择框的接受类型；不进接口契约，只影响浏览器的文件过滤器。 */
export const COVER_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp'

/** 选文件后先给出可立即读懂的拒绝理由；返回 null 表示可以提交给服务端。 */
export function describeCoverFileProblem(file: File): string | null {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > COVER_UPLOAD_MAX_BYTES) return 'That image is larger than 5 MB.'
  return null
}

/**
 * 上传一张封面图。
 *
 * 文件名与声明的 Content-Type 都只是随请求一起送过去的元数据，服务端按内容判型；
 * 这里不做客户端类型校验（按扩展名判型与「不采信客户端声明」自相矛盾）。
 */
export async function uploadCoverImage(file: File, signal?: AbortSignal): Promise<MediaUploadResponse> {
  const form = new FormData()
  form.append('file', file, file.name)
  let response: Response
  try {
    response = await fetch(MEDIA_ENDPOINTS.upload, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      body: form,
      signal,
    })
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new MediaNetworkError()
  }
  if (!response.ok) {
    let code = 'UNKNOWN'
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json() as { code?: unknown; message?: unknown } | null
      if (typeof body?.code === 'string') code = body.code
      if (typeof body?.message === 'string') message = body.message
    } catch (cause) {
      if (isAbortError(cause)) throw cause
      // 非 JSON 上游失败保留真实状态码。
    }
    throw new MediaApiError(response.status, code, message)
  }
  try {
    return await response.json() as MediaUploadResponse
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new MediaApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
}
