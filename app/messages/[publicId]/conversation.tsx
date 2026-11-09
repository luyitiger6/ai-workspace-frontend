'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import {
  describeDmError,
  dmApi,
  isUnauthenticated,
  type DmConversation,
  type DmMessage,
  type DmStreamHandlers,
} from '@/lib/dm/dm-api'
import { describeMessageProblem } from '@/lib/dm/dm-input'
import { formatDate } from '@/lib/home/format'
import styles from './conversation.module.css'

type ThreadState = 'loading' | 'error' | 'ready'

function timeValue(iso: string): number {
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** 接口按创建时间倒序返回；页面反向渲染成自上而下的时间顺序，最新一条在底部。 */
function compareMessages(left: DmMessage, right: DmMessage): number {
  const diff = timeValue(left.createdAt) - timeValue(right.createdAt)
  if (diff !== 0) return diff
  return left.publicId < right.publicId ? -1 : left.publicId > right.publicId ? 1 : 0
}

/** 推送与重连补拉都会带回已有消息：按 publicId 去重，重复项采用最后一次内容。 */
function mergeMessages(current: DmMessage[], incoming: DmMessage[]): DmMessage[] {
  const byId = new Map(current.map(message => [message.publicId, message]))
  for (const message of incoming) byId.set(message.publicId, message)
  return [...byId.values()].sort(compareMessages)
}

/**
 * 会话页（tasks 6.2）。
 *
 * 进入即标记已读：`markRead` 与首页消息并发发出，前者顺带返回对方名片（没有单独的
 * 单会话 GET）。列表从接口的倒序反向成升序渲染，发送与推送都走同一合并函数去重。
 *
 * 推送只在本页建立：`EventSource` 自带重连，`onOpen`（含首次与每次重连）都重拉
 * 首页合并——既补齐断线期间漏掉的消息，也覆盖「首屏取数之后、连接建立之前」的空窗。
 * 会话列表页不建立会话级连接（spec「未打开会话时不建立推送」）。
 */
export function Conversation({ publicId }: { publicId: string }) {
  const router = useRouter()
  const { status: authStatus, expireSession } = useAuth()
  const [threadState, setThreadState] = useState<ThreadState>('loading')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [summary, setSummary] = useState<DmConversation | null>(null)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [earlierError, setEarlierError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<DmConversation | null>(null)
  const messagesRef = useRef<DmMessage[]>([])

  useEffect(() => {
    summaryRef.current = summary
  }, [summary])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (authStatus === 'guest') {
      router.replace('/login')
      return
    }
    if (authStatus !== 'user') return
    const controller = new AbortController()
    let active = true
    setThreadState('loading')
    Promise.all([
      dmApi.markRead(publicId, controller.signal),
      dmApi.messages(publicId, null, controller.signal),
    ])
      .then(([conversation, page]) => {
        if (!active) return
        setSummary(conversation)
        setMessages(mergeMessages([], page.items))
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setThreadState('ready')
      })
      .catch(cause => {
        if (!active) return
        if (isUnauthenticated(cause)) {
          expireSession()
          return
        }
        setLoadError(describeDmError(cause))
        setThreadState('error')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [authStatus, publicId, expireSession, reloadKey, router])

  const refreshLatest = useCallback(async () => {
    try {
      const page = await dmApi.messages(publicId)
      const wasEmpty = messagesRef.current.length === 0
      setMessages(current => mergeMessages(current, page.items))
      // 首屏为空时，重连窗口里可能已经积累了不止一页消息：此时才接管新游标。
      if (wasEmpty) {
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
      }
    } catch {
      // 补拉失败不打断已渲染的会话：下一次重连（onOpen）还会再拉。
    }
  }, [publicId])

  useEffect(() => {
    if (threadState !== 'ready') return
    const handlers: DmStreamHandlers = {
      onMessage: message => {
        setMessages(current => mergeMessages(current, [message]))
        if (summaryRef.current !== null && message.senderPublicId === summaryRef.current.peer.publicId) {
          // 会话页在前台时，对方的新消息视为已读：静默推进已读位置，未读不在列表里累积。
          void dmApi
            .markRead(publicId)
            .then(conversation => setSummary(conversation))
            .catch(() => {})
        }
      },
      onOpen: () => {
        void refreshLatest()
      },
    }
    return dmApi.stream(publicId, handlers)
  }, [threadState, publicId, refreshLatest])

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, threadState])

  const loadEarlier = useCallback(async () => {
    if (cursor === null || loadingEarlier) return
    setLoadingEarlier(true)
    setEarlierError(null)
    try {
      const page = await dmApi.messages(publicId, cursor)
      setMessages(current => mergeMessages(current, page.items))
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch (cause) {
      setEarlierError(describeDmError(cause))
    } finally {
      setLoadingEarlier(false)
    }
  }, [cursor, loadingEarlier, publicId])

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const problem = describeMessageProblem(draft)
      if (problem !== null) {
        setSendError(problem)
        return
      }
      setSendError(null)
      setSending(true)
      try {
        const message = await dmApi.send(publicId, draft)
        setMessages(current => mergeMessages(current, [message]))
        setDraft('')
      } catch (cause) {
        if (isUnauthenticated(cause)) {
          expireSession()
          return
        }
        setSendError(describeDmError(cause))
      } finally {
        setSending(false)
      }
    },
    [draft, publicId, expireSession],
  )

  return (
    <main id="main-content" className={styles.main}>
      <div className={`wc-container ${styles.container}`}>
        <div className={styles.head}>
          <Link className={styles.back} href="/messages">
            Back to messages
          </Link>
          <h1 className={styles.title}>{summary ? summary.peer.displayName : 'Conversation'}</h1>
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

        {authStatus === 'user' && threadState === 'loading' ? (
          <div className={styles.loading} role="status">
            <p>Loading conversation…</p>
          </div>
        ) : null}

        {authStatus === 'user' && threadState === 'error' ? (
          <div className={styles.error} role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="wc-button wc-button--primary"
              onClick={() => setReloadKey(key => key + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}

        {authStatus === 'user' && threadState === 'ready' ? (
          <section className={styles.thread} aria-label="Messages">
            <div className={styles.log} ref={scrollRef}>
              {hasMore ? (
                <div className={styles.earlier}>
                  <button
                    type="button"
                    className="wc-button wc-button--ghost"
                    onClick={loadEarlier}
                    disabled={loadingEarlier}
                  >
                    {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
                  </button>
                  {earlierError ? (
                    <p className={styles.fieldError} role="alert">
                      {earlierError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {messages.length === 0 ? <p className={styles.empty}>No messages yet. Say hello.</p> : null}

              <ol className={styles.messages} aria-live="polite">
                {messages.map(message => {
                  const mine = summary !== null && message.senderPublicId !== summary.peer.publicId
                  return (
                    <li key={message.publicId} className={mine ? styles.mine : styles.theirs}>
                      <p className={styles.bubble}>{message.content}</p>
                      <time className={styles.stamp} dateTime={message.createdAt}>
                        {formatDate(message.createdAt)}
                      </time>
                    </li>
                  )
                })}
              </ol>
            </div>

            <form className={styles.composer} onSubmit={handleSend} noValidate>
              <label className="wc-visually-hidden" htmlFor="dm-message-input">
                Message
              </label>
              <textarea
                id="dm-message-input"
                className={styles.textarea}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                rows={2}
                placeholder="Write a message…"
              />
              <button type="submit" className="wc-button wc-button--primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>

            {sendError ? (
              <p className={styles.fieldError} role="alert">
                {sendError}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  )
}
