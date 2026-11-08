'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import type { UpdateProfileRequest } from '@/lib/contracts/profile'
import {
  COVER_UPLOAD_ACCEPT,
  describeCoverFileProblem,
  describeMediaError,
  uploadCoverImage,
} from '@/lib/media/media-api'
import { isUnauthenticated, profileApi, ProfileApiError } from '@/lib/profile/profile-api'
import {
  PROFILE_INPUT_LIMITS,
  codePointLength,
  firstCharacter,
  isAbsoluteHttpUrl,
  stripWhitespace,
} from '@/lib/profile/profile-input'
import type { Profile } from '@/lib/profile/types'
import styles from './me.module.css'

type Phase = 'loading' | 'guest' | 'expired' | 'ready' | 'error'
type InterestsPhase = 'loading' | 'ready' | 'error'

interface FieldErrors {
  displayName?: string
  bio?: string
  avatarUrl?: string
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((value, index) => value === right[index])
}

function validateName(value: string): string | null {
  const stripped = stripWhitespace(value)
  if (stripped === '') return 'Display name is required.'
  if (codePointLength(stripped) > PROFILE_INPUT_LIMITS.displayNameChars) {
    return 'Display name must be 64 characters or fewer.'
  }
  return null
}

function validateBio(value: string): string | null {
  if (codePointLength(value) > PROFILE_INPUT_LIMITS.bioChars) {
    return 'Bio must be 200 characters or fewer.'
  }
  return null
}

function validateAvatar(value: string): string | null {
  if (value !== '' && !isAbsoluteHttpUrl(value)) {
    return 'Enter a full http(s) image address.'
  }
  return null
}

/** 人形占位图形：装饰性，读屏跳过，颜色由调用处 CSS 决定。 */
function PersonGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5Z"
      />
    </svg>
  )
}

/**
 * 个人中心的客户端主体：六态（加载 / 未登录 / 会话过期 / 已登录 / 空资料 / 读取失败）与
 * 四项资料表单。资料与标签走 `profileApi`（本阶段 Mock），auth 仍走真实 `/api/auth/me`。
 */
export function MeContent() {
  const baseId = useId()
  const router = useRouter()
  const { status, expireSession, setDisplayName } = useAuth()

  const [phase, setPhase] = useState<Phase>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  // 已保存的资料快照：脏检测与「只保存改动字段」都拿它做基准。
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayNameState] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])

  // 兴趣标签清单（服务端常量，本阶段 Mock）。
  const [catalog, setCatalog] = useState<string[] | null>(null)
  const [interestsPhase, setInterestsPhase] = useState<InterestsPhase>('loading')
  const [interestsRetry, setInterestsRetry] = useState(0)

  // 头像预览：与输入分离，只在失焦 / 提交 / 上传成功时提交。
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewBroken, setPreviewBroken] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // 表单提交与错误。
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [topError, setTopError] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const bioInputRef = useRef<HTMLTextAreaElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const loginLinkRef = useRef<HTMLAnchorElement>(null)

  // 会话确认 → 已登录时读取资料；资料读取失败（非登录失效）进入 error，Retry 走 reloadToken。
  useEffect(() => {
    if (status === 'loading') {
      setPhase('loading')
      return
    }
    if (status === 'guest') {
      setPhase(current => (current === 'expired' ? current : 'guest'))
      return
    }
    let active = true
    setPhase('loading')
    void (async () => {
      try {
        const profile = await profileApi.me()
        if (!active) return
        setSavedProfile(profile)
        setDisplayNameState(profile.displayName)
        setBio(profile.bio)
        setAvatarUrl(profile.avatarUrl)
        setPreviewUrl(profile.avatarUrl)
        setSelectedInterests(profile.interests)
        setPreviewBroken(false)
        setUploadError(null)
        setPhase('ready')
      } catch (cause) {
        if (!active) return
        if (isUnauthenticated(cause)) {
          expireSession()
          setPhase('expired')
        } else {
          setPhase('error')
        }
      }
    })()
    return () => {
      active = false
    }
  }, [status, reloadToken, expireSession])

  // 兴趣标签清单：独立于资料表单，失败不阻塞其余字段保存；会话失效同样回到过期态。
  useEffect(() => {
    if (phase !== 'ready') return
    let active = true
    setInterestsPhase('loading')
    setCatalog(null)
    void profileApi.interests().then(
      (list) => {
        if (!active) return
        setCatalog(list)
        setSelectedInterests(current => current.filter(tag => list.includes(tag)))
        setInterestsPhase('ready')
      },
      (cause) => {
        if (!active) return
        if (isUnauthenticated(cause)) {
          expireSession()
          setPhase('expired')
          return
        }
        setInterestsPhase('error')
      },
    )
    return () => {
      active = false
    }
  }, [phase, interestsRetry, expireSession])

  // 会话过期态：原焦点控件已消失，焦点落到登录链接。
  useEffect(() => {
    if (phase === 'expired') loginLinkRef.current?.focus()
  }, [phase])

  // 地址一变就重新尝试加载预览：上一次的「打不开」不该继承到新地址。
  useEffect(() => {
    setPreviewBroken(false)
  }, [previewUrl])

  const nameCount = codePointLength(stripWhitespace(displayName))
  const bioCount = codePointLength(bio)
  const isEmptyName = stripWhitespace(displayName) === ''
  const previewChar = firstCharacter(displayName)

  const staleInterests =
    catalog !== null && savedProfile !== null
      ? savedProfile.interests.filter(tag => !catalog.includes(tag))
      : []

  const interestsChanged =
    catalog !== null &&
    savedProfile !== null &&
    !sameSet(selectedInterests, savedProfile.interests.filter(tag => catalog.includes(tag)))

  const isDirty =
    savedProfile !== null &&
    (displayName !== savedProfile.displayName ||
      bio !== savedProfile.bio ||
      avatarUrl !== savedProfile.avatarUrl ||
      interestsChanged)

  const touch = (patch: Partial<{ displayName: string; bio: string; avatarUrl: string }>) => {
    if (patch.displayName !== undefined) setDisplayNameState(patch.displayName)
    if (patch.bio !== undefined) setBio(patch.bio)
    if (patch.avatarUrl !== undefined) setAvatarUrl(patch.avatarUrl)
    setTopError(null)
    setFieldErrors({})
  }

  /** 失焦 / 提交时提交预览：空 → 占位；合法 http(s) → 显示；非法 → 保留上一张并提示。 */
  const commitAvatarPreview = (value: string) => {
    if (value === '') {
      setPreviewUrl('')
      setFieldErrors(current => ({ ...current, avatarUrl: undefined }))
      return
    }
    if (isAbsoluteHttpUrl(value)) {
      setPreviewUrl(value)
      setFieldErrors(current => ({ ...current, avatarUrl: undefined }))
    } else {
      setFieldErrors(current => ({ ...current, avatarUrl: 'Enter a full http(s) image address.' }))
    }
  }

  /** 选完文件立即上传，成功后回填地址并刷新预览；失败不动已填地址（spec「上传失败保留原值」）。 */
  const pickAvatar = async (file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    const problem = describeCoverFileProblem(file)
    if (problem) {
      setUploadError(problem)
      return
    }
    setUploading(true)
    try {
      const stored = await uploadCoverImage(file)
      setAvatarUrl(stored.url)
      setPreviewUrl(stored.url)
      setTopError(null)
      setFieldErrors(current => ({ ...current, avatarUrl: undefined }))
    } catch (cause) {
      setUploadError(describeMediaError(cause))
    } finally {
      setUploading(false)
      if (avatarFileRef.current) avatarFileRef.current.value = ''
    }
  }

  const toggleInterest = (tag: string) => {
    setSelectedInterests(current =>
      current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag],
    )
    setTopError(null)
  }

  const retryInterests = () => setInterestsRetry(value => value + 1)

  const focusFirstError = (errors: FieldErrors) => {
    if (errors.avatarUrl) avatarInputRef.current?.focus()
    else if (errors.displayName) nameInputRef.current?.focus()
    else bioInputRef.current?.focus()
  }

  const recheckErrors = (): FieldErrors => {
    const errors: FieldErrors = {}
    const nameIssue = validateName(displayName)
    if (nameIssue) errors.displayName = nameIssue
    const bioIssue = validateBio(bio)
    if (bioIssue) errors.bio = bioIssue
    const avatarIssue = validateAvatar(avatarUrl)
    if (avatarIssue) errors.avatarUrl = avatarIssue
    return errors
  }

  const buildRequest = (): UpdateProfileRequest => {
    const request: UpdateProfileRequest = {
      displayName: null,
      avatarUrl: null,
      bio: null,
      interests: null,
    }
    if (savedProfile === null) return request
    if (displayName !== savedProfile.displayName) request.displayName = displayName
    if (avatarUrl !== savedProfile.avatarUrl) request.avatarUrl = avatarUrl
    if (bio !== savedProfile.bio) request.bio = bio
    if (interestsChanged) request.interests = selectedInterests
    return request
  }

  const applySaved = (updated: Profile) => {
    setSavedProfile(updated)
    setDisplayNameState(updated.displayName)
    setBio(updated.bio)
    setAvatarUrl(updated.avatarUrl)
    setPreviewUrl(updated.avatarUrl)
    setPreviewBroken(false)
    setSelectedInterests(updated.interests.filter(tag => (catalog ?? []).includes(tag)))
    setFieldErrors({})
    setUploadError(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || uploading) return
    setTopError(null)

    const errors: FieldErrors = {}
    const nameIssue = validateName(displayName)
    if (nameIssue) errors.displayName = nameIssue
    const bioIssue = validateBio(bio)
    if (bioIssue) errors.bio = bioIssue
    const avatarIssue = validateAvatar(avatarUrl)
    if (avatarIssue) errors.avatarUrl = avatarIssue

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusFirstError(errors)
      if (!avatarIssue) commitAvatarPreview(avatarUrl)
      return
    }

    commitAvatarPreview(avatarUrl)
    setFieldErrors({})
    setSubmitting(true)
    try {
      const updated = await profileApi.update(buildRequest())
      applySaved(updated)
      setDisplayName(updated.displayName)
      setSubmitting(false)
      router.push('/posts')
    } catch (cause) {
      setSubmitting(false)
      if (isUnauthenticated(cause)) {
        expireSession()
        setPhase('expired')
        return
      }
      if (cause instanceof ProfileApiError && cause.code === 'VALIDATION_FAILED') {
        const next = recheckErrors()
        if (Object.keys(next).length > 0) {
          setFieldErrors(next)
          focusFirstError(next)
        } else {
          setTopError('Some fields are not valid. Check them and try again.')
        }
        return
      }
      if (cause instanceof ProfileApiError && cause.code === 'CROSS_SITE_REJECTED') {
        setTopError('The request was rejected because its origin is not trusted.')
        return
      }
      setTopError('Profile could not be saved. Please try again.')
    }
  }

  const nameDescribedBy = [
    `${baseId}-name-count`,
    ...(isEmptyName ? [`${baseId}-name-hint`] : []),
    ...(fieldErrors.displayName ? [`${baseId}-name-error`] : []),
  ].join(' ')
  const bioDescribedBy = [
    `${baseId}-bio-count`,
    ...(fieldErrors.bio ? [`${baseId}-bio-error`] : []),
  ].join(' ')
  const avatarDescribedBy = fieldErrors.avatarUrl ? `${baseId}-avatar-error` : undefined

  const renderAvatarPreview = () => {
    if (previewUrl !== '' && !previewBroken) {
      return (
        <img
          className={styles.previewImage}
          src={previewUrl}
          alt=""
          onError={() => setPreviewBroken(true)}
        />
      )
    }
    if (previewChar !== '') {
      return <span className={styles.previewChar}>{previewChar}</span>
    }
    return <PersonGlyph className={styles.previewPerson} />
  }

  const renderInterests = () => {
    if (interestsPhase === 'loading') {
      return (
        <p className={styles.hint} role="status">
          Loading interests…
        </p>
      )
    }
    if (interestsPhase === 'error') {
      return (
        <div className={styles.interestsError}>
          <p className={styles.error} role="alert">
            Interests could not load.
          </p>
          <button type="button" className="wc-button wc-button--ghost" onClick={retryInterests}>
            Retry
          </button>
          {savedProfile && savedProfile.interests.length > 0 ? (
            <div className={styles.tagGroup} aria-label="Your selected interests">
              {savedProfile.interests.map(tag => (
                <span key={tag} className={styles.readonlyChip}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )
    }

    const maxReached = selectedInterests.length >= PROFILE_INPUT_LIMITS.maxInterests
    return (
      <>
        <div className={styles.tagGroup} role="group" aria-labelledby={`${baseId}-interests`}>
          {(catalog ?? []).map(tag => {
            const checked = selectedInterests.includes(tag)
            const disabled = !checked && maxReached
            return (
              <div key={tag} className={styles.tag}>
                <input
                  id={`${baseId}-interest-${tag}`}
                  type="checkbox"
                  className={styles.tagInput}
                  checked={checked}
                  disabled={submitting || disabled}
                  onChange={() => toggleInterest(tag)}
                />
                <label className={styles.tagLabel} htmlFor={`${baseId}-interest-${tag}`}>
                  {tag}
                </label>
              </div>
            )
          })}
        </div>
        {maxReached ? <p className={styles.hint}>You have selected the maximum of 5 interests.</p> : null}
        {staleInterests.length > 0 ? (
          <>
            <p className={styles.hint}>Some saved interests are no longer available.</p>
            <div className={styles.tagGroup}>
              {staleInterests.map(tag => (
                <span key={tag} className={styles.readonlyChip}>
                  {tag}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </>
    )
  }

  const renderForm = () => (
    <form className={styles.form} onSubmit={event => void submit(event)} aria-busy={submitting} noValidate>
      <div className={styles.avatarRow}>
        <div className={styles.preview} aria-hidden="true">
          {renderAvatarPreview()}
        </div>
        <div className={styles.avatarControls}>
          <div className={styles.uploadRow}>
            <input
              ref={avatarFileRef}
              id={`${baseId}-avatarFile`}
              type="file"
              accept={COVER_UPLOAD_ACCEPT}
              className={styles.fileInput}
              disabled={submitting || uploading}
              aria-busy={uploading}
              onChange={event => void pickAvatar(event.target.files?.[0])}
            />
            <label className={styles.fileLabel} htmlFor={`${baseId}-avatarFile`}>
              Upload image
            </label>
            {uploading ? (
              <p className={styles.uploading} role="status">
                Uploading…
              </p>
            ) : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${baseId}-avatarUrl`}>
              Image URL
            </label>
            <input
              ref={avatarInputRef}
              id={`${baseId}-avatarUrl`}
              type="url"
              className={styles.input}
              value={avatarUrl}
              disabled={submitting}
              aria-invalid={fieldErrors.avatarUrl ? true : undefined}
              aria-describedby={avatarDescribedBy}
              onChange={event => touch({ avatarUrl: event.target.value })}
              onBlur={() => commitAvatarPreview(avatarUrl)}
            />
            {fieldErrors.avatarUrl ? (
              <p id={`${baseId}-avatar-error`} className={styles.error} role="alert">
                {fieldErrors.avatarUrl}
              </p>
            ) : null}
          </div>
          {uploadError ? (
            <p className={styles.error} role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${baseId}-name`}>
          Display name
        </label>
        <input
          ref={nameInputRef}
          id={`${baseId}-name`}
          type="text"
          className={styles.input}
          value={displayName}
          disabled={submitting}
          aria-invalid={fieldErrors.displayName ? true : undefined}
          aria-describedby={nameDescribedBy}
          onChange={event => touch({ displayName: event.target.value })}
        />
        <p id={`${baseId}-name-count`} className={nameCount > PROFILE_INPUT_LIMITS.displayNameChars ? styles.countOver : styles.count}>
          {nameCount} / {PROFILE_INPUT_LIMITS.displayNameChars}
        </p>
        {isEmptyName ? (
          <p id={`${baseId}-name-hint`} className={styles.hint}>
            Your posts show &quot;Author unavailable&quot; until you add a display name.
          </p>
        ) : null}
        {fieldErrors.displayName ? (
          <p id={`${baseId}-name-error`} className={styles.error} role="alert">
            {fieldErrors.displayName}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${baseId}-bio`}>
          Bio
        </label>
        <textarea
          ref={bioInputRef}
          id={`${baseId}-bio`}
          rows={6}
          className={styles.textarea}
          value={bio}
          disabled={submitting}
          aria-invalid={fieldErrors.bio ? true : undefined}
          aria-describedby={bioDescribedBy}
          onChange={event => touch({ bio: event.target.value })}
        />
        <p id={`${baseId}-bio-count`} className={bioCount > PROFILE_INPUT_LIMITS.bioChars ? styles.countOver : styles.count}>
          {bioCount} / {PROFILE_INPUT_LIMITS.bioChars}
        </p>
        {fieldErrors.bio ? (
          <p id={`${baseId}-bio-error`} className={styles.error} role="alert">
            {fieldErrors.bio}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <span className={styles.label} id={`${baseId}-interests`}>
          Interests
        </span>
        <p className={styles.hint}>Choose up to 5.</p>
        {renderInterests()}
      </div>

      {topError ? (
        <p className={styles.error} role="alert">
          {topError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className="wc-button wc-button--primary" disabled={submitting || !isDirty}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
        {!isDirty && !submitting ? (
          <p className={styles.hint}>No unsaved changes.</p>
        ) : null}
      </div>
    </form>
  )

  const renderGuide = (expired: boolean) => (
    <div className={styles.notice}>
      {expired ? (
        <p className={styles.expiredAlert} role="alert">
          Your session has expired. Log in to continue.
        </p>
      ) : null}
      <p className={styles.noticeText}>Log in to manage your profile.</p>
      <Link ref={loginLinkRef} className="wc-button wc-button--primary" href="/login">
        Log in
      </Link>
    </div>
  )

  const renderSkeleton = () => (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlockBio} />
      <div className={styles.skeletonBlockShort} />
      <div className={styles.skeletonBlockTall} />
    </div>
  )

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main id="main-content" className={styles.main}>
        <div className={`wc-container ${styles.container}`}>
          <div className={styles.head}>
            <p className="wc-eyebrow">Account</p>
            <h1 className={styles.title}>My profile</h1>
          </div>

          {phase === 'loading' ? (
            <>
              <div className={styles.loadingStatus} role="status" aria-live="polite">
                Loading your profile…
              </div>
              <div aria-busy="true">{renderSkeleton()}</div>
            </>
          ) : null}

          {phase === 'guest' ? renderGuide(false) : null}
          {phase === 'expired' ? renderGuide(true) : null}

          {phase === 'error' ? (
            <div className={styles.notice}>
              <p className={styles.expiredAlert} role="alert">
                Your profile could not load. Please try again.
              </p>
              <button
                type="button"
                className="wc-button wc-button--primary"
                onClick={() => setReloadToken(value => value + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}

          {phase === 'ready' ? renderForm() : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
