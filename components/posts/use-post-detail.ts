'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { safeReturnTo } from '@/lib/auth/return-to'
import type { CommentResponse, PostInteractionStateResponse } from '@/lib/contracts/posts'
import { describePostsError, PostsApiError, PostsNetworkError, postsApi } from '@/lib/posts/posts-api'
import type { PostDetail } from '@/lib/posts/types'
import { commentValidationError, normalizeCommentContent } from '@/lib/posts/comment-input'

export interface ReadState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'not-found'
  data: T | null
  error: string | null
  stale: boolean
}

export interface CommentsData {
  items: CommentResponse[]
  nextCursor: string | null
}

export interface CommentDraft {
  content: string
  replyTo: CommentResponse | null
  ownerPublicId: string | null
  locked: boolean
}

function emptyDraft(): CommentDraft {
  return { content: '', replyTo: null, ownerPublicId: null, locked: false }
}

type Resource = 'detail' | 'comments' | 'personal'
type MutationKind = 'vote' | 'bookmark' | 'comment' | 'delete'
type MutationResult = 'success' | 'failed' | 'ignored'

interface View {
  key: string
  detail: ReadState<PostDetail>
  comments: ReadState<CommentsData>
  personal: ReadState<PostInteractionStateResponse>
  busy: boolean
  loadingMore: boolean
  mutationKind: MutationKind | null
  needsReview: boolean
  mutation: { status: 'idle' | 'writing' | 'refreshing' | 'success' | 'error' | 'uncertain'; message: string }
  sessionExpired: boolean
}

interface Ticket { generation: number; controller: AbortController | null }
interface Scope {
  key: string
  publicId: string
  accountPublicId: string | null
  view: View
  tickets: Record<Resource, Ticket>
  writeController: AbortController | null
  busy: boolean
}

function emptyRead<T>(): ReadState<T> {
  return { status: 'idle', data: null, error: null, stale: false }
}

function initialView(key: string, sessionExpired = false): View {
  return {
    key, detail: emptyRead(), comments: emptyRead(), personal: emptyRead(),
    busy: false, loadingMore: false, mutationKind: null, needsReview: false,
    mutation: { status: 'idle', message: '' }, sessionExpired,
  }
}

function cancelRead(scope: Scope, resource: Resource) {
  const ticket = scope.tickets[resource]
  ticket.generation += 1
  ticket.controller?.abort()
  ticket.controller = null
}

function isUnauthenticated(cause: unknown) {
  return cause instanceof PostsApiError && cause.status === 401 && cause.code === 'UNAUTHENTICATED'
}

/** 三个读取区独立更新；全部写入和校准共用一个同步锁。 */
export function usePostDetail(publicId: string) {
  const auth = useAuth()
  const accountPublicId = auth.status === 'user' ? auth.user?.publicId ?? null : null
  const logoutRevision = auth.logoutRevision ?? 0
  const key = `${publicId}:${auth.status}:${accountPublicId ?? ''}:${logoutRevision}`
  const scopeRef = useRef<Scope | null>(null)
  const expiredAccountRef = useRef<string | null>(null)
  const reviewedAccountRef = useRef<string | null>(null)
  const previousIdentityRef = useRef({ publicId, logoutRevision })
  const draftRef = useRef<CommentDraft>(emptyDraft())
  const [draft, setDraft] = useState<CommentDraft>(emptyDraft)
  const [snapshot, setSnapshot] = useState<View>(() => initialView(key))
  const changeDraft = useCallback((value: CommentDraft) => {
    draftRef.current = value
    setDraft(value)
  }, [])

  const current = useCallback((scope: Scope) => scopeRef.current === scope, [])
  const update = useCallback((scope: Scope, patch: Partial<View>) => {
    if (!current(scope)) return
    scope.view = { ...scope.view, ...patch }
    setSnapshot(scope.view)
  }, [current])

  const sessionExpired = useCallback((scope: Scope) => {
    if (!current(scope)) return
    const needsReview = expiredAccountRef.current !== scope.accountPublicId
    expiredAccountRef.current = scope.accountPublicId
    cancelRead(scope, 'personal')
    update(scope, { personal: emptyRead(), sessionExpired: true })
    reviewedAccountRef.current = null
    if (draftRef.current.ownerPublicId === scope.accountPublicId) changeDraft({ ...draftRef.current, locked: true })
    // /me 即使仍确认同一账户，也不循环重发受保护读取或任何写入。
    if (needsReview) {
      void auth.refresh().then(account => {
        if (!account || account.publicId !== scope.accountPublicId) return
        const active = scopeRef.current
        if (!active || active.publicId !== scope.publicId || previousIdentityRef.current.logoutRevision !== logoutRevision) return
        reviewedAccountRef.current = account.publicId
        if (active.accountPublicId === account.publicId) update(active, { sessionExpired: false })
        if (draftRef.current.ownerPublicId === account.publicId) changeDraft({ ...draftRef.current, locked: false })
      })
    }
  }, [auth.refresh, changeDraft, current, logoutRevision, update])

  const readDetail = useCallback(async (scope: Scope): Promise<boolean> => {
    cancelRead(scope, 'detail')
    const ticket = scope.tickets.detail
    const generation = ticket.generation
    const controller = new AbortController()
    ticket.controller = controller
    const previous = scope.view.detail
    update(scope, { detail: { ...previous, status: 'loading', error: null, stale: previous.data !== null } })
    const valid = () => current(scope) && ticket.generation === generation
    try {
      const data = await postsApi.detail(scope.publicId, controller.signal)
      if (!valid()) return false
      // 访客意外收到草稿也不得显示正文；其它账户的草稿同样隐藏。
      if (data.status === 'draft' && data.authorPublicId !== scope.accountPublicId) {
        cancelRead(scope, 'comments')
        cancelRead(scope, 'personal')
        update(scope, {
          detail: { status: 'not-found', data: null, error: null, stale: false },
          comments: emptyRead(), personal: emptyRead(), sessionExpired: true,
        })
        return false
      }
      if (data.status === 'draft') {
        cancelRead(scope, 'personal')
        update(scope, { personal: emptyRead() })
      }
      update(scope, { detail: { status: 'ready', data, error: null, stale: false } })
      return true
    } catch (cause) {
      if (!valid()) return false
      if (cause instanceof PostsApiError && cause.status === 404) {
        cancelRead(scope, 'comments')
        cancelRead(scope, 'personal')
        update(scope, {
          detail: { status: 'not-found', data: null, error: null, stale: false },
          comments: emptyRead(), personal: emptyRead(),
        })
      } else {
        update(scope, { detail: { ...previous, status: 'error', error: describePostsError(cause), stale: previous.data !== null } })
        if (isUnauthenticated(cause)) sessionExpired(scope)
      }
      return false
    } finally {
      if (valid()) ticket.controller = null
    }
  }, [current, sessionExpired, update])

  const readPersonal = useCallback(async (scope: Scope): Promise<boolean> => {
    if (!scope.accountPublicId || scope.view.detail.data?.status !== 'published') return false
    cancelRead(scope, 'personal')
    const ticket = scope.tickets.personal
    const generation = ticket.generation
    const controller = new AbortController()
    ticket.controller = controller
    // 未完成的读取不能用旧选择或 null/false 冒充已确认状态。
    update(scope, { personal: { status: 'loading', data: null, error: null, stale: false } })
    const valid = () => current(scope) && ticket.generation === generation && scope.view.detail.status !== 'not-found'
    try {
      const data = await postsApi.readMyInteractions(scope.publicId, controller.signal)
      if (!valid()) return false
      expiredAccountRef.current = null
      reviewedAccountRef.current = scope.accountPublicId
      if (draftRef.current.ownerPublicId === scope.accountPublicId) changeDraft({ ...draftRef.current, locked: false })
      update(scope, { personal: { status: 'ready', data, error: null, stale: false }, sessionExpired: false })
      return true
    } catch (cause) {
      if (!valid()) return false
      update(scope, { personal: { status: 'error', data: null, error: describePostsError(cause), stale: false } })
      if (isUnauthenticated(cause)) sessionExpired(scope)
      else if (cause instanceof PostsApiError && cause.status === 404) await readDetail(scope)
      return false
    } finally {
      if (valid()) ticket.controller = null
    }
  }, [changeDraft, current, readDetail, sessionExpired, update])

  const readComments = useCallback(async (scope: Scope, append = false): Promise<boolean> => {
    if (!scope.view.detail.data || scope.view.detail.status === 'not-found') return false
    const previous = scope.view.comments
    const cursor = append ? previous.data?.nextCursor ?? null : null
    if (append && cursor === null) return false
    cancelRead(scope, 'comments')
    const ticket = scope.tickets.comments
    const generation = ticket.generation
    const controller = new AbortController()
    ticket.controller = controller
    update(scope, {
      loadingMore: append,
      comments: { ...previous, status: 'loading', error: null, stale: !append && previous.data !== null },
    })
    const valid = () => current(scope) && ticket.generation === generation && scope.view.detail.status !== 'not-found'
    try {
      const page = await postsApi.comments(scope.publicId, cursor, controller.signal)
      if (!valid()) return false
      const items = append ? [...previous.data?.items ?? []] : []
      const seen = new Set(items.map(item => item.publicId))
      for (const item of page.items) {
        if (!seen.has(item.publicId)) { seen.add(item.publicId); items.push(item) }
      }
      update(scope, { comments: { status: 'ready', data: { items, nextCursor: page.nextCursor }, error: null, stale: false } })
      return true
    } catch (cause) {
      if (!valid()) return false
      const error = cause instanceof PostsApiError && cause.code === 'VALIDATION_FAILED'
        ? 'The comments page cursor is invalid. Retry this page or explicitly reload comments.'
        : describePostsError(cause)
      update(scope, { comments: { ...previous, status: 'error', error, stale: !append && previous.data !== null } })
      if (isUnauthenticated(cause)) sessionExpired(scope)
      else if (cause instanceof PostsApiError && cause.status === 404) await readDetail(scope)
      return false
    } finally {
      if (valid()) { ticket.controller = null; update(scope, { loadingMore: false }) }
    }
  }, [current, readDetail, sessionExpired, update])

  useLayoutEffect(() => {
    const previous = previousIdentityRef.current
    if (previous.publicId !== publicId || previous.logoutRevision !== logoutRevision) {
      changeDraft(emptyDraft())
      expiredAccountRef.current = null
      reviewedAccountRef.current = null
    } else if (accountPublicId && draftRef.current.ownerPublicId && draftRef.current.ownerPublicId !== accountPublicId) {
      changeDraft(emptyDraft())
    } else if (auth.status === 'guest') {
      if (expiredAccountRef.current && draftRef.current.ownerPublicId === expiredAccountRef.current) {
        changeDraft({ ...draftRef.current, locked: true })
      } else changeDraft(emptyDraft())
    }
    previousIdentityRef.current = { publicId, logoutRevision }
    const scope: Scope = {
      key, publicId, accountPublicId, view: initialView(key, expiredAccountRef.current !== null),
      tickets: {
        detail: { generation: 0, controller: null },
        comments: { generation: 0, controller: null },
        personal: { generation: 0, controller: null },
      }, writeController: null, busy: false,
    }
    if (accountPublicId && expiredAccountRef.current !== accountPublicId) expiredAccountRef.current = null
    scope.view.sessionExpired = expiredAccountRef.current !== null && (!accountPublicId || reviewedAccountRef.current !== accountPublicId)
    scopeRef.current = scope
    setSnapshot(scope.view)
    return () => {
      scopeRef.current = null
      for (const resource of ['detail', 'comments', 'personal'] as const) cancelRead(scope, resource)
      scope.writeController?.abort()
    }
  }, [key, publicId, accountPublicId, auth.status, logoutRevision, changeDraft])

  useEffect(() => {
    const scope = scopeRef.current
    if (!scope || auth.status === 'loading') return
    if (!safeReturnTo(`/posts/${publicId}`)) {
      update(scope, { detail: { status: 'not-found', data: null, error: null, stale: false } })
      return
    }
    void (async () => {
      if (!await readDetail(scope) || !current(scope)) return
      const reads: Promise<boolean>[] = [readComments(scope)]
      if (accountPublicId && !scope.view.sessionExpired) reads.push(readPersonal(scope))
      await Promise.all(reads)
    })()
  }, [key, publicId, auth.status, accountPublicId, current, readComments, readDetail, readPersonal, update])

  const calibrate = useCallback(async (scope: Scope, kind: MutationKind) => {
    const resumeComments = scope.view.comments.status === 'loading'
    const resumePersonal = scope.view.personal.status === 'loading'
    const reads = [readDetail(scope)]
    if (kind === 'comment' || kind === 'delete') {
      reads.push(readComments(scope))
      if (resumePersonal) reads.push(readPersonal(scope))
    } else {
      reads.push(readPersonal(scope))
      // 写开始取消的首载/分页恢复原游标，不永远停在 loading 或丢弃已有页。
      if (resumeComments) reads.push(readComments(scope, scope.view.comments.data !== null && !scope.view.comments.stale))
    }
    const results = await Promise.all(reads)
    return current(scope) && scope.view.detail.status !== 'not-found' && results.every(Boolean)
  }, [current, readComments, readDetail, readPersonal])

  const mutate = useCallback(async (
    kind: MutationKind,
    write: (scope: Scope, signal: AbortSignal) => Promise<unknown>,
    onSuccess?: (scope: Scope) => void,
  ): Promise<MutationResult> => {
    const scope = scopeRef.current
    if (!scope || scope.busy || !scope.accountPublicId || scope.view.sessionExpired || scope.view.needsReview ||
      scope.view.detail.data?.status !== 'published' || scope.view.detail.stale) return 'ignored'
    if ((kind === 'vote' || kind === 'bookmark') && scope.view.personal.status !== 'ready') return 'ignored'
    scope.busy = true
    const controller = new AbortController()
    scope.writeController = controller
    for (const resource of ['detail', 'comments', 'personal'] as const) cancelRead(scope, resource)
    update(scope, { busy: true, loadingMore: false, mutationKind: kind, mutation: { status: 'writing', message: 'Submitting…' } })
    let succeeded = false
    try {
      await write(scope, controller.signal)
      if (!current(scope)) return 'ignored'
      succeeded = true
      onSuccess?.(scope)
      update(scope, { mutation: { status: 'refreshing', message: 'Submitted. Refreshing server data…' } })
      const refreshed = await calibrate(scope, kind)
      if (!current(scope)) return 'ignored'
      update(scope, { mutation: refreshed
        ? { status: 'success', message: 'Saved. Server data refreshed.' }
        : { status: 'error', message: 'Submitted, but refresh failed. Retry reading server data; do not submit again.' } })
      return 'success'
    } catch (cause) {
      if (!current(scope)) return 'ignored'
      const uncertain = cause instanceof PostsNetworkError || cause instanceof PostsApiError &&
        (cause.status >= 500 || cause.code === 'INVALID_RESPONSE')
      update(scope, { mutation: {
        status: uncertain ? 'uncertain' : 'error',
        message: uncertain
          ? 'The write result is unknown. Check server data before taking another action; nothing will be sent again automatically.'
          : kind === 'comment' && cause instanceof PostsApiError && cause.code === 'VALIDATION_FAILED'
            ? 'The comment content is invalid. Check its length and try again.' : describePostsError(cause),
      } })
      if (uncertain) {
        update(scope, {
          needsReview: true,
          detail: { ...scope.view.detail, stale: true },
          ...kind === 'vote' || kind === 'bookmark' ? {
            personal: { status: 'error' as const, data: null, error: 'Your interaction state needs to be checked.', stale: true },
          } : {},
        })
      }
      if (isUnauthenticated(cause)) sessionExpired(scope)
      else {
        // 操作 404 不代表帖子 404；只用详情复核决定全页未找到。
        await calibrate(scope, kind)
      }
      return 'failed'
    } finally {
      if (current(scope)) {
        scope.busy = false
        scope.writeController = null
        update(scope, { busy: false })
        if (!succeeded && scope.view.detail.status === 'loading') void readDetail(scope)
      }
    }
  }, [calibrate, current, readDetail, sessionExpired, update])

  const toggleVote = useCallback((direction: 'up' | 'down') => mutate('vote', (scope, signal) =>
    scope.view.personal.data?.voteDirection === direction
      ? postsApi.cancelVote(scope.publicId, signal) : postsApi.vote(scope.publicId, direction, signal)), [mutate])
  const toggleBookmark = useCallback(() => mutate('bookmark', (scope, signal) =>
    scope.view.personal.data?.bookmarked
      ? postsApi.cancelBookmark(scope.publicId, signal) : postsApi.bookmark(scope.publicId, signal)), [mutate])

  const editContent = useCallback((content: string) => {
    const scope = scopeRef.current
    if (!scope?.accountPublicId || scope.busy || draftRef.current.locked || scope.view.sessionExpired) return
    changeDraft({ ...draftRef.current, content, ownerPublicId: scope.accountPublicId })
  }, [changeDraft])
  const chooseReply = useCallback((comment: CommentResponse | null) => {
    const scope = scopeRef.current
    if (!scope?.accountPublicId || scope.busy || draftRef.current.locked || scope.view.sessionExpired) return
    if (comment && (comment.parentPublicId !== null || comment.postPublicId !== scope.publicId)) return
    changeDraft({ ...draftRef.current, replyTo: comment, ownerPublicId: scope.accountPublicId })
  }, [changeDraft])
  const submitComment = useCallback(async (): Promise<MutationResult> => {
    const input = draftRef.current
    const scope = scopeRef.current
    if (!scope || input.locked || input.ownerPublicId !== scope.accountPublicId || commentValidationError(input.content)) return 'ignored'
    return mutate('comment', (active, signal) => postsApi.createComment(active.publicId, {
      content: normalizeCommentContent(input.content), parentPublicId: input.replyTo?.publicId ?? null,
    }, signal), () => changeDraft(emptyDraft()))
  }, [changeDraft, mutate])
  const deleteComment = useCallback(async (comment: CommentResponse): Promise<MutationResult> => {
    const scope = scopeRef.current
    if (!scope?.accountPublicId || comment.authorPublicId !== scope.accountPublicId || comment.postPublicId !== scope.publicId) return 'ignored'
    return mutate('delete', (active, signal) => postsApi.deleteComment(active.publicId, comment.publicId, signal), active => {
      const data = active.view.comments.data
      if (data) update(active, { comments: { ...active.view.comments, data: { ...data, items: data.items.filter(item => item.publicId !== comment.publicId) }, stale: true } })
    })
  }, [mutate, update])
  const recheckSession = useCallback(async () => {
    const owner = draftRef.current.ownerPublicId
    const account = await auth.refresh()
    if (account) {
      const active = scopeRef.current
      if (!active || active.publicId !== publicId || previousIdentityRef.current.logoutRevision !== logoutRevision) return
      reviewedAccountRef.current = account.publicId
      if (active.accountPublicId === account.publicId) update(active, { sessionExpired: false })
      if (owner === account.publicId && draftRef.current.ownerPublicId === owner) changeDraft({ ...draftRef.current, locked: false })
    }
  }, [auth.refresh, changeDraft, logoutRevision, publicId, update])

  const retryDetail = useCallback(async () => {
    const scope = scopeRef.current
    if (!scope || scope.busy || auth.status === 'loading') return
    if (await readDetail(scope) && current(scope)) {
      const reads = [readComments(scope)]
      if (scope.accountPublicId && scope.view.detail.data?.status === 'published') reads.push(readPersonal(scope))
      const results = await Promise.all(reads)
      if (current(scope) && results.every(Boolean) && scope.view.needsReview) {
        update(scope, {
          needsReview: false,
          mutation: { status: 'idle', message: 'Server data checked. The previous write was not sent again. Review the result before submitting another action.' },
        })
      }
    }
  }, [auth.status, current, readComments, readDetail, readPersonal, update])
  const retryPersonal = useCallback(() => {
    const scope = scopeRef.current
    if (scope && !scope.busy) void readPersonal(scope)
  }, [readPersonal])
  const loadMoreComments = useCallback(() => {
    const scope = scopeRef.current
    if (scope && !scope.busy && !scope.tickets.comments.controller) void readComments(scope, true)
  }, [readComments])
  const retryComments = useCallback(() => {
    const scope = scopeRef.current
    if (scope && !scope.busy && !scope.tickets.comments.controller) {
      void readComments(scope, scope.view.comments.data !== null && !scope.view.comments.stale)
    }
  }, [readComments])
  const reloadComments = useCallback(() => {
    const scope = scopeRef.current
    if (scope && !scope.busy) void readComments(scope)
  }, [readComments])

  const view = snapshot.key === key ? snapshot : initialView(key)
  return {
    auth, view, draft, editContent, chooseReply, submitComment, deleteComment, recheckSession,
    toggleVote, toggleBookmark, retryDetail, retryPersonal, loadMoreComments, retryComments, reloadComments,
  }
}
