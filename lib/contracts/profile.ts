/**
 * 个人资料接口的字段契约——前端唯一真源。
 *
 * 这里的每一个 interface 都逐字镜像后端 `web/profile/dto/*.java` 的 record，
 * 字段名与 record 组件名完全相同，两侧一律 camelCase。
 * 一致性不靠人盯：`harness/checks/10-contract-check.ps1` 会解析两侧的字段「名字 + 类型」
 * 做双向比对，并同在飞 change 的 `design.md`「## 契约」表做三方比对。
 *
 * 类型约定（由闸门按 Java↔TS 映射表强制）：
 * 1. `List<String>` 镜像为 `string[]`，`List<X>` 只有在 `X` 也是同目录 record 时镜像为 `X[]`；
 * 2. `UpdateProfileRequest` 的四个字段在后端全部可空：`null` 表示「未提交、保持原值」，
 *    空串 / 空数组表示「清空」——前端因此写成 `string | null` / `string[] | null`。
 */

/** GET /api/profile 的响应体：本人完整资料（不含 email / status 等账户内部字段）。 */
export interface ProfileResponse {
  publicId: string
  displayName: string
  avatarUrl: string
  bio: string
  interests: string[]
}

/** PUT /api/profile 的请求体：部分更新，字段可空，`null` 表示保持原值。 */
export interface UpdateProfileRequest {
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  interests: string[] | null
}

/** 公开名片：只含对外标识、昵称与头像三个字段，游客可读。 */
export interface ProfileCardResponse {
  publicId: string
  displayName: string
  avatarUrl: string
}

/**
 * GET /api/profiles/{publicId} 的响应体：公开用户页的四项资料。
 *
 * 与 `ProfileResponse` 字段此刻相同，但两侧是两个 record：本人读将来加私有字段时，
 * 公开读不应该跟着变（design D3）。前端也保持两份镜像，不把两者合并成一个类型。
 */
export interface PublicProfileResponse {
  publicId: string
  displayName: string
  avatarUrl: string
  bio: string
  interests: string[]
}

/** GET /api/profiles 的响应体：不存在或已注销的标识不出现。 */
export interface ProfileCardListResponse {
  items: ProfileCardResponse[]
}

/** GET /api/profile/interests 的响应体：兴趣标签清单，非空且是校验与展示的唯一真源。 */
export interface InterestListResponse {
  items: string[]
}

/** 个人资料端点路径，一律走同源 `/api` 代理，前端不直连后端主机。 */
export const PROFILE_ENDPOINTS = {
  me: '/api/profile',
  update: '/api/profile',
  cards: '/api/profiles',
  interests: '/api/profile/interests',
  publicProfile: (publicId: string) => `/api/profiles/${publicId}`,
} as const
