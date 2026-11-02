import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PostInteractionStateResponse } from '@/lib/contracts/posts'
import type { ReadState } from './use-post-detail'
import { PostInteractionBar } from './post-interaction-bar'

function readState(overrides: Partial<ReadState<PostInteractionStateResponse>> = {}): ReadState<PostInteractionStateResponse> {
  return { status: 'ready', data: { voteDirection: null, bookmarked: false }, error: null, stale: false, ...overrides }
}

function renderBar(overrides: Partial<Parameters<typeof PostInteractionBar>[0]> = {}) {
  const handlers = {
    onVote: vi.fn(),
    onBookmark: vi.fn(),
    onComment: vi.fn(),
    onLogin: vi.fn(),
    onRetry: vi.fn(),
  }
  const props = {
    authStatus: 'user' as const,
    personal: readState(),
    busy: false,
    disabled: false,
    sessionExpired: false,
    ...handlers,
    ...overrides,
  }
  const view = render(<PostInteractionBar {...props} />)
  return { ...handlers, ...view }
}

describe('PostInteractionBar', () => {
  it('已知态按服务端状态输出互斥的 aria-pressed', () => {
    renderBar({ personal: readState({ data: { voteDirection: 'down', bookmarked: true } }) })

    expect(screen.getByRole('button', { name: 'Upvote' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Downvote' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bookmark' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('未知态不冒充未互动：省略 aria-pressed', () => {
    renderBar({ personal: readState({ status: 'loading', data: null }) })

    for (const name of ['Upvote', 'Downvote', 'Bookmark']) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-pressed')
    }
    expect(screen.getByRole('status')).toHaveTextContent('Loading your interaction state…')
  })

  it('游客点击只触发登录引导，不发写请求', () => {
    const { onVote, onBookmark, onComment, onLogin } = renderBar({ authStatus: 'guest', personal: readState({ status: 'idle', data: null }) })

    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }))

    expect(onLogin).toHaveBeenCalledTimes(3)
    expect(onVote).not.toHaveBeenCalled()
    expect(onBookmark).not.toHaveBeenCalled()
    expect(onComment).not.toHaveBeenCalled()
    expect(screen.getByText('Log in to vote, bookmark, or join the conversation.')).toBeInTheDocument()
  })

  it('身份加载中四个按钮全部禁用', () => {
    renderBar({ authStatus: 'loading' })

    for (const name of ['Upvote', 'Downvote', 'Bookmark', 'Comment']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })

  it('个人状态读取失败保持未知态并提供重试', () => {
    const { onRetry, onVote } = renderBar({ personal: readState({ status: 'error', data: null, error: 'Cannot reach the server.' }) })

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server. Your vote and bookmark state is unknown.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry reading my state' }))
    expect(onRetry).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }))
    expect(onVote).not.toHaveBeenCalled()
  })

  it('未读取时提供显式读取入口', () => {
    const { onRetry } = renderBar({ personal: readState({ status: 'idle', data: null }) })

    fireEvent.click(screen.getByRole('button', { name: 'Read my interaction state' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('写入期间四个按钮全部禁用并标记 aria-busy', () => {
    const { onVote } = renderBar({ busy: true })

    for (const name of ['Upvote', 'Downvote', 'Bookmark', 'Comment']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByLabelText('Post interactions')).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }))
    expect(onVote).not.toHaveBeenCalled()
  })

  it('待刷新与会话过期都锁住写入', () => {
    const { unmount } = renderBar({ disabled: true })
    expect(screen.getByRole('button', { name: 'Upvote' })).toBeDisabled()
    unmount()

    renderBar({ sessionExpired: true })
    for (const name of ['Upvote', 'Downvote', 'Bookmark', 'Comment']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})
