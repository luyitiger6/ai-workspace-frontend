'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import {
  describeDmError,
  dmApi,
  isUnauthenticated,
  type DmConversation,
} from '@/lib/dm/dm-api'
import { parsePeerPublicId } from '@/lib/dm/dm-input'
import { formatDate } from '@/lib/home/format'
import styles from './messages.module.css'

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: DmConversation[] }

/** 没有消息的会话按创建时间参与同一排序（spec「按最近活跃时间倒序」）。 */
function activityTime(conversation: DmConversation): number {
  const parsed = Date.parse(conversation.lastMessageAt ?? conversation.createdAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** 后端已按最近活跃倒序；这里只保证同刻时顺序稳定，不改变业务顺序。 */
function sortConversations(items: DmConversation[]): DmConversation[] {
  return [...items].sort((left, right) => {
    const diff = activityTime(right) - activityTime(left)
    if (diff !== 0) return diff
    return left.publicId < right.publicId ? -1 : left.publicId > right.publicId ? 1 : 0
  })
}

function initialOf(displayName: string): string {
  return [...displayName.trim()][0]?.toUpperCase() ?? '?'
}

/**
 * 会话列表页（tasks 6.1）。
 *
 * 登录态未确认时不动接口，确认是游客后跳登录；进入后先取列表再渲染。
 * 新建会话只接受「用户页地址或公开标识」，解析交给 `parsePeerPublicId`，
 * 不把形状不明的输入拼进请求——服务端 404 与 400 的文案由 `describeDmError` 统一翻译。
 */
export function MessagesContent() {
  const router = useRouter()
  const { status: authStatus, expireSession } = useAuth()
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [peerInput, setPeerInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [failedAvatars, setFailedAvatars] = useState<Record<string, string>>({})

  useEffect(() => {
    if (authStatus === 'guest') router.replace('/login')
  }, [authStatus, router])

  useEffect(() => {
    if (authStatus !== 'user') return
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })
    dmApi
      .conversations(controller.signal)
      .then(items => {
        if (active) setState({ status: 'ready', items: sortConversations(items) })
      })
      .catch(cause => {
        if (!active) return
        if (isUnauthenticated(cause)) {
          expireSession()
          return
        }
        setState({ status: 'error', message: describeDmError(cause) })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [authStatus, expireSession, reloadKey])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const peerPublicId = parsePeerPublicId(peerInput)
      if (!peerPublicId) {
        setFormError("That doesn't look like a member address.")
        return
      }
      setFormError(null)
      setSubmitting(true)
      try {
        const conversation = await dmApi.create(peerPublicId)
        router.push(`/messages/${conversation.publicId}`)
      } catch (cause) {
        if (isUnauthenticated(cause)) {
          expireSession()
          return
        }
        setFormError(describeDmError(cause))
      } finally {
        setSubmitting(false)
      }
    },
    [peerInput, router, expireSession],
  )

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <div className={styles.head}>
          <div>
            <p className="wc-eyebrow">Messages</p>
            <h1 className={styles.title}>Direct messages</h1>
          </div>
        </div>

        {authStatus === 'loading' ? (
          <div className={styles.loading} role="status">
            <p>Checking your session…</p>
          </div>
        ) : null}

        {authStatus === 'guest' ? (
          <div className={styles.loading} role="status">
            <p>Please log in to read your messages.</p>
          </div>
        ) : null}

        {authStatus === 'user' ? (
          <>
            <form className={`wc-card ${styles.createCard}`} onSubmit={handleSubmit} noValidate>
              <label className={styles.createLabel} htmlFor="dm-peer-input">
                Start a conversation
              </label>
              <p className={styles.createHint}>Paste a member page address or public ID.</p>
              <div className={styles.createRow}>
                <input
                  id="dm-peer-input"
                  className={styles.input}
                  value={peerInput}
                  onChange={event => setPeerInput(event.target.value)}
                  placeholder="/users/01… or 01…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" className="wc-button wc-button--primary" disabled={submitting}>
                  {submitting ? 'Opening…' : 'Open chat'}
                </button>
              </div>
              {formError ? (
                <p className={styles.fieldError} role="alert">
                  {formError}
                </p>
              ) : null}
            </form>

            {state.status === 'loading' ? (
              <div className={styles.loading} role="status">
                <p>Loading messages…</p>
              </div>
            ) : null}

            {state.status === 'error' ? (
              <div className={styles.error} role="alert">
                <p>{state.message}</p>
                <button
                  type="button"
                  className="wc-button wc-button--primary"
                  onClick={() => setReloadKey(key => key + 1)}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {state.status === 'ready' && state.items.length === 0 ? (
              <div className={styles.empty}>
                <p>No conversations yet.</p>
                <p>Start one with a member&apos;s page address above.</p>
              </div>
            ) : null}

            {state.status === 'ready' && state.items.length > 0 ? (
              <ul className={styles.list}>
                {state.items.map(conversation => {
                  const { peer } = conversation
                  const stamp = conversation.lastMessageAt ?? conversation.createdAt
                  const showAvatar =
                    peer.avatarUrl !== '' && failedAvatars[conversation.publicId] !== peer.avatarUrl
                  return (
                    <li key={conversation.publicId}>
                      <Link className={`wc-card ${styles.item}`} href={`/messages/${conversation.publicId}`}>
                        {showAvatar ? (
                          <img
                            className={styles.avatar}
                            src={peer.avatarUrl}
                            alt=""
                            width={48}
                            height={48}
                            loading="lazy"
                            onError={() =>
                              setFailedAvatars(current => ({
                                ...current,
                                [conversation.publicId]: peer.avatarUrl,
                              }))
                            }
                          />
                        ) : (
                          <span className={styles.avatarFallback} aria-hidden="true">
                            {initialOf(peer.displayName)}
                          </span>
                        )}
                        <span className={styles.itemBody}>
                          <span className={styles.itemTop}>
                            <span className={styles.name}>{peer.displayName}</span>
                            <time className={styles.time} dateTime={stamp}>
                              {formatDate(stamp)}
                            </time>
                          </span>
                          <span className={styles.preview}>
                            {conversation.lastMessagePreview ?? 'No messages yet.'}
                          </span>
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <span className={styles.unread}>
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                            <span className="wc-visually-hidden"> unread</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}
