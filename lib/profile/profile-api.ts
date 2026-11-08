import {
  PROFILE_ENDPOINTS,
  type InterestListResponse,
  type ProfileCardListResponse,
  type ProfileResponse,
  type UpdateProfileRequest,
} from '@/lib/contracts/profile'
import { toProfile, toProfileCard, type Profile, type ProfileCard } from './types'

/**
 * 资料数据的唯一调用点。
 *
 * 本阶段资料三项（本人资料、名片批量、标签清单）走 Mock，auth（`/api/auth/me`）继续真接口。
 * 切换点是下面的 `USE_MOCK_PROFILE`：联调时把它翻成 `false` 即切真接口，页面与组件不感知这一层。
 * 唯一开关：默认（未设环境变量）为 Mock；设 `NEXT_PUBLIC_PROFILE_MOCK=0` 即切真接口——
 * E2E 契约测试用这一环境变量走真接口 + Playwright 桩，手动开发与单元测试保持 Mock。
 * Mock 收敛在本文件内，不散落到组件里。
 */
export const USE_MOCK_PROFILE = process.env.NEXT_PUBLIC_PROFILE_MOCK !== '0'

export class ProfileApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'ProfileApiError'
  }
}

export class ProfileNetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.')
    this.name = 'ProfileNetworkError'
  }
}

/** 是否因为会话失效被拒：读取或保存各自据此切到「会话过期」态。 */
export function isUnauthenticated(cause: unknown): boolean {
  return cause instanceof ProfileApiError && cause.code === 'UNAUTHENTICATED'
}

/** 错误码到界面文案的映射。未知码回落到状态码兜底，不臆造文案。 */
export function describeProfileError(cause: unknown): string {
  if (cause instanceof ProfileNetworkError) return cause.message
  if (!(cause instanceof ProfileApiError)) return 'Something went wrong. Please try again.'
  const messages: Record<string, string> = {
    UNAUTHENTICATED: 'Your session has expired. Log in to continue.',
    VALIDATION_FAILED: 'Some fields are not valid. Check them and try again.',
    CROSS_SITE_REJECTED: 'The request was rejected because its origin is not trusted.',
  }
  return messages[cause.code] ?? `Request failed with status ${cause.status}. Please try again.`
}

/** 取消异常可来自浏览器/不同执行环境，不依赖 Error 构造器身份。 */
function isAbortError(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new ProfileNetworkError()
  }
  if (!response.ok) {
    let code = 'UNKNOWN'
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { code?: unknown; message?: unknown } | null
      if (typeof body?.code === 'string') code = body.code
      if (typeof body?.message === 'string') message = body.message
    } catch (cause) {
      if (isAbortError(cause)) throw cause
      // 非 JSON 上游失败保留真实状态码，不虚构业务错误。
    }
    throw new ProfileApiError(response.status, code, message)
  }
  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new ProfileApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
}

// ---------------------------------------------------------------------------
// 真接口实现（联调阶段启用）
// ---------------------------------------------------------------------------

async function fetchMyProfileReal(signal?: AbortSignal): Promise<Profile> {
  return toProfile(await request<ProfileResponse>(PROFILE_ENDPOINTS.me, { signal }))
}

async function updateMyProfileReal(input: UpdateProfileRequest, signal?: AbortSignal): Promise<Profile> {
  return toProfile(await request<ProfileResponse>(PROFILE_ENDPOINTS.update, {
    method: 'PUT',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
}

async function fetchProfileCardsReal(publicIds: string[], signal?: AbortSignal): Promise<ProfileCard[]> {
  const query = new URLSearchParams({ publicIds: publicIds.join(',') })
  const page = await request<ProfileCardListResponse>(`${PROFILE_ENDPOINTS.cards}?${query}`, { signal })
  return page.items.map(toProfileCard)
}

async function fetchInterestsReal(signal?: AbortSignal): Promise<string[]> {
  const page = await request<InterestListResponse>(PROFILE_ENDPOINTS.interests, { signal })
  return page.items
}

// ---------------------------------------------------------------------------
// Mock 实现（本阶段启用；取值与后端 `InterestCatalog` 保持一致，避免联调视觉跳变）
// ---------------------------------------------------------------------------

export const MOCK_INTERESTS: string[] = [
  'hiking',
  'food',
  'photography',
  'budget travel',
  'camping',
  'cycling',
  'museums',
  'nightlife',
  'beaches',
  'mountains',
  'city walks',
  'local culture',
  'wildlife',
  'road trips',
  'volunteering',
  'luxury',
]

const MOCK_PROFILE: Profile = {
  publicId: '01JME0000000000000000000',
  displayName: 'Editor Lan',
  avatarUrl: '',
  bio: 'City walk enthusiast.',
  interests: ['hiking', 'food'],
}

/** 本阶段 mock 需要「保存后再次进入仍是保存后的值」，所以保留一份进程内可变副本。 */
let mockProfile: Profile = { ...MOCK_PROFILE }

async function mockFetchMyProfile(): Promise<Profile> {
  return { ...mockProfile }
}

async function mockUpdateMyProfile(input: UpdateProfileRequest): Promise<Profile> {
  mockProfile = {
    ...mockProfile,
    displayName: input.displayName ?? mockProfile.displayName,
    avatarUrl: input.avatarUrl ?? mockProfile.avatarUrl,
    bio: input.bio ?? mockProfile.bio,
    interests: input.interests ?? mockProfile.interests,
  }
  return { ...mockProfile }
}

/** 名片 mock：每个被请求的标识都给一张「无头像」名片，昵称取标识后四位，便于肉眼区分。 */
async function mockFetchProfileCards(publicIds: string[]): Promise<ProfileCard[]> {
  return publicIds.map((id) => ({
    publicId: id,
    displayName: `Member ${id.slice(-4)}`,
    avatarUrl: '',
  }))
}

async function mockFetchInterests(): Promise<string[]> {
  return [...MOCK_INTERESTS]
}

// ---------------------------------------------------------------------------
// 唯一出口：页面与组件只 import `profileApi`，不感知 mock / 真接口的分流。
// ---------------------------------------------------------------------------

export const profileApi = {
  me: USE_MOCK_PROFILE ? mockFetchMyProfile : fetchMyProfileReal,
  update: USE_MOCK_PROFILE ? mockUpdateMyProfile : updateMyProfileReal,
  cards: USE_MOCK_PROFILE ? mockFetchProfileCards : fetchProfileCardsReal,
  interests: USE_MOCK_PROFILE ? mockFetchInterests : fetchInterestsReal,
}
