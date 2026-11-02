/**
 * 媒体接口的字段契约——前端唯一真源。
 *
 * 这里的 interface 与后端 `web/media/dto/MediaUploadResponse.java` 逐字段镜像：
 * 字段名相同、类型经 Java→TS 映射表归一后相同，两侧一致由
 * `harness/checks/10-contract-check.ps1` 双向比对，不靠人盯。
 *
 * 后端响应刻意只用 String 与 long：闸门对映射表之外的类型（嵌套类型、集合泛型）
 * 是 fail-closed 判红，这里因此也只出现 string 与 number。
 */

/** POST /api/media 的响应体：可对外发布的绝对地址、按内容判定的类型、字节数。 */
export interface MediaUploadResponse {
  url: string
  contentType: string
  size: number
}

/** 媒体端点的相对路径（同源代理下使用）。 */
export const MEDIA_ENDPOINTS = {
  upload: '/api/media',
} as const
