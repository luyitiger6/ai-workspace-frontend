'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SectionError } from '@/components/home/section-state'
import { PostCardSkeleton } from '@/components/posts/post-card-skeleton'
import { PostList } from '@/components/posts/post-list'
import { useInfinitePosts } from '@/components/posts/use-infinite-posts'
import { describePostsError, postsApi } from '@/lib/posts/posts-api'
import type { PostSortBy } from '@/lib/posts/types'
import { describeProfileError, isProfileNotFound, profileApi } from '@/lib/profile/profile-api'
import { firstCharacter } from '@/lib/profile/profile-input'
import type { AuthorCardEntry, PublicProfile } from '@/lib/profile/types'
import styles from './user-page.module.css'

/** 资料侧四态：加载 / 就绪 / 用户不存在 / 读取失败。列表侧独立于资料侧（design D2）。 */
type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: PublicProfile }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

/**
 * 昵称为空时按 OQ2 决策兜底：`Member` + 对外标识后四位，与名片 Mock 的文案一致。
 * 兜底只发生在展示层，接口返回什么就存什么。
 */
export function displayNameOf(profile: PublicProfile): string {
  const name = profile.displayName.trim()
  return name === '' ? `Member ${profile.publicId.slice(-4)}` : name
}

/**
 * 公开用户页的客户端视图：资料与列表并行发起，失败粒度彼此独立。
 *
 * 列表用 `useInfinitePosts` 复用广场那一套代次与游标处理（design D5），
 * `sortBy` 只作为 hook 内部的键，`byAuthor` 忽略它——后端固定按发布时刻倒序。
 */
export function UserPageContent({ publicId }: { publicId: string }) {
  const [attempt, setAttempt] = useState(0)
  const [profile, setProfile] = useState<ProfileState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setProfile({ status: 'loading' })
    profileApi.publicProfile(publicId, controller.signal)
      .then((data) => {
        if (active) setProfile({ status: 'ready', profile: data })
      })
      .catch((cause: unknown) => {
        // 切页或重试取消的请求不代表当前页面，取消异常不落成错误态。
        if (!active) return
        setProfile(
          isProfileNotFound(cause)
            ? { status: 'not-found' }
            : { status: 'error', message: describeProfileError(cause) },
        )
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [publicId, attempt])

  const load = useCallback(
    (_sortBy: PostSortBy, cursor: string | null, signal: AbortSignal) => postsApi.byAuthor(publicId, cursor, signal),
    [publicId],
  )
  const { state: feed, loadMore, retry: retryFeed } = useInfinitePosts({ sortBy: 'latest', load })

  // 列表项的作者恒为页主本人：直接用已取到的资料拼名片，不再多打一次名片端点。
  const authorCards = useMemo<ReadonlyMap<string, AuthorCardEntry>>(() => {
    if (profile.status !== 'ready') return new Map()
    const card = {
      publicId: profile.profile.publicId,
      displayName: displayNameOf(profile.profile),
      avatarUrl: profile.profile.avatarUrl,
    }
    return new Map([[card.publicId, { status: 'ready' as const, card }]])
  }, [profile])

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.inner}`}>
        {profile.status === 'loading' ? <ProfileSkeleton /> : null}

        {profile.status === 'not-found' ? (
          <section className={styles.notice}>
            <p className="wc-eyebrow">Community · Member</p>
            <h1 className={styles.title}>User not found</h1>
            <p className={styles.lead}>
              This user does not exist or has left. Browse the community instead.
            </p>
            <Link className="wc-button wc-button--primary" href="/posts">
              Browse all posts
            </Link>
          </section>
        ) : null}

        {profile.status === 'error' ? (
          <section className={styles.notice}>
            <p className="wc-eyebrow">Community · Member</p>
            <h1 className={styles.title}>This profile could not load</h1>
            <SectionError message={profile.message} />
            <button
              type="button"
              className="wc-button wc-button--primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry loading this profile
            </button>
          </section>
        ) : null}

        {profile.status === 'ready' ? (
          <>
            <header className={styles.head}>
              <p className="wc-eyebrow">Community · Member</p>
              <div className={styles.identity}>
                <Avatar profile={profile.profile} />
                <h1 className={styles.title}>{displayNameOf(profile.profile)}</h1>
              </div>
              {profile.profile.bio.trim() === '' ? (
                <p className={styles.note}>This member has not written a bio yet.</p>
              ) : (
                <p className={styles.lead}>{profile.profile.bio}</p>
              )}
              {profile.profile.interests.length > 0 ? (
                <ul className={styles.interests} aria-label="Interests">
                  {profile.profile.interests.map((tag, index) => (
                    <li key={`${index}-${tag}`}>{tag}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.note}>No interests listed yet.</p>
              )}
            </header>

            <section className={styles.feed} aria-labelledby="user-posts">
              <h2 id="user-posts" className={styles.sectionTitle}>
                Published posts
              </h2>

              {feed.status === 'loading' ? (
                <div className={styles.feedLoading} role="status" aria-busy="true">
                  <p>Loading posts…</p>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <PostCardSkeleton key={index} />
                  ))}
                </div>
              ) : null}

              {feed.status === 'error' ? (
                <div className={styles.feedError} role="alert">
                  <p>Posts could not load. Please try again.</p>
                  <button type="button" className="wc-button wc-button--ghost" onClick={retryFeed}>
                    Retry loading posts
                  </button>
                </div>
              ) : null}

              {feed.status === 'ready' ? (
                <PostList
                  items={feed.items}
                  authorCards={authorCards}
                  isLoadingMore={feed.isLoadingMore}
                  hasMore={feed.hasMore}
                  loadMoreError={feed.loadMoreError}
                  onLoadMore={loadMore}
                  onRetry={retryFeed}
                />
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}

function Avatar({ profile }: { profile: PublicProfile }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = profile.avatarUrl !== '' && failedUrl !== profile.avatarUrl
  if (!showImage) {
    return (
      <span className={styles.avatarInitial} aria-hidden="true">
        {firstCharacter(displayNameOf(profile))}
      </span>
    )
  }
  return (
    <img
      className={styles.avatar}
      src={profile.avatarUrl}
      alt=""
      loading="lazy"
      onError={() => setFailedUrl(profile.avatarUrl)}
    />
  )
}

/** 资料未就绪时只展示骨架，不等列表：列表在资料就绪后才渲染（design D6）。 */
function ProfileSkeleton() {
  return (
    <div className={styles.skeletonProfile} role="status" aria-busy="true">
      <p className={styles.note}>Loading this member…</p>
      <div className={styles.skeletonIdentity}>
        <span className={styles.skeletonAvatar} />
        <span className={styles.skeletonTitle} />
      </div>
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLineShort} />
      <div className={styles.skeletonFeed}>
        {Array.from({ length: 2 }).map((_, index) => (
          <PostCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
