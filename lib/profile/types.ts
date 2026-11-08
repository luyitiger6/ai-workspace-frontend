import type { ProfileCardResponse, ProfileResponse } from '@/lib/contracts/profile'

/**
 * 个人资料在界面层的形状：字段来自 `lib/contracts/profile.ts` 的镜像，
 * 不做任何「服务端缺什么就补什么」的兜底——资料四项之外一律不出现。
 */
export interface Profile {
  publicId: string
  displayName: string
  avatarUrl: string
  bio: string
  interests: string[]
}

/** 公开名片：只含对外标识、昵称与头像，游客可读。 */
export interface ProfileCard {
  publicId: string
  displayName: string
  avatarUrl: string
}

/**
 * 作者名片的三态。`missing` 同时覆盖「名片未返回」「账户已注销」与「返回昵称为空白」；
 * 请求失败在列表层合并为同一呈现，不在此层做永久缺失标记。
 */
export type AuthorCardStatus = 'pending' | 'ready' | 'missing'

export interface AuthorCardEntry {
  status: AuthorCardStatus
  /** 只有 `ready` 时非空；`pending` / `missing` 时为空。 */
  card: ProfileCard | null
}

/** 显式选择真实字段，不补假摘要、邮箱或账户状态。 */
export function toProfile(dto: ProfileResponse): Profile {
  return {
    publicId: dto.publicId,
    displayName: dto.displayName,
    avatarUrl: dto.avatarUrl,
    bio: dto.bio,
    interests: dto.interests,
  }
}

/** 名片适配层：字段逐项镜像，不新增、不减省。 */
export function toProfileCard(dto: ProfileCardResponse): ProfileCard {
  return {
    publicId: dto.publicId,
    displayName: dto.displayName,
    avatarUrl: dto.avatarUrl,
  }
}
