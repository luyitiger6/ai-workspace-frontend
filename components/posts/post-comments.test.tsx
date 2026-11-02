import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommentResponse } from '@/lib/contracts/posts'
import type { CommentsData } from './use-post-detail'
import { PostComments } from './post-comments'

const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FAA'
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FBB'

function makeComment(id: string, overrides: Partial<CommentResponse> = {}): CommentResponse {
  return {
    publicId: id,
    postPublicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    parentPublicId: null,
    authorPublicId: OTHER,
    content: `Comment ${id}`,
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

function readyState(items: CommentResponse[], nextCursor: string | null = null): { state: Parameters<typeof PostComments>[0]['state'] } {
  return { state: { status: 'ready', data: { items, nextCursor } satisfies CommentsData, error: null, stale: false } }
}

function renderComments(overrides: Partial<Parameters<typeof PostComments>[0]> = {}) {
  const handlers = {
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onReload: vi.fn(),
    onReply: vi.fn(),
    onLogin: vi.fn(),
    onDelete: vi.fn().mockResolvedValue('success' as const),
  }
  const props = {
    authStatus: 'user' as const,
    accountPublicId: OWNER,
    busy: false,
    loadingMore: false,
    readOnly: false,
    disabled: false,
    sessionExpired: false,
    ...readyState([makeComment('c1')]),
    ...handlers,
    ...overrides,
  }
  return { ...handlers, ...render(<PostComments {...props} />) }
}

describe('PostComments', () => {
  it('空列表显示空态且不显示加载或到底提示', () => {
    renderComments(readyState([]))

    expect(screen.getByText('No comments yet.')).toBeInTheDocument()
    expect(screen.queryByText('Loading comments…')).not.toBeInTheDocument()
    expect(screen.queryByText('You have reached the end of the comments.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more comments' })).not.toBeInTheDocument()
  })

  it('展示缩略作者标识、创建时间与原始正文', () => {
    renderComments(readyState([makeComment('c1', { content: 'First line\nsecond line' })]))

    expect(screen.getByText('Author ID: 01ARZ3…5FBB')).toBeInTheDocument()
    expect(screen.getByText('Created', { exact: false })).toHaveTextContent('Created Oct 11')
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-10-11T16:30:00+08:00')
    expect(screen.getByText('First line', { exact: false }).textContent).toBe('First line\nsecond line')
  })

  it('有下一页时加载更多可触发，到底后换成提示', () => {
    const { onLoadMore, unmount } = renderComments(readyState([makeComment('c1')], 'cursor-2'))

    fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
    unmount()

    renderComments(readyState([makeComment('c1')], null))
    expect(screen.queryByRole('button', { name: 'Load more comments' })).not.toBeInTheDocument()
    expect(screen.getByText('You have reached the end of the comments.')).toBeInTheDocument()
  })

  it('分页进行中显示加载提示', () => {
    renderComments({ ...readyState([makeComment('c1')], 'cursor-2'), loadingMore: true })

    expect(screen.getByRole('status')).toHaveTextContent('Loading more comments…')
  })

  it('回复条目展示父标识、父正文预览与跳转，且不提供继续回复', () => {
    const parent = makeComment('c1', { content: 'Parent content' })
    const reply = makeComment('c2', { parentPublicId: 'c1', content: 'Reply content' })
    renderComments(readyState([parent, reply]))

    const items = screen.getAllByRole('listitem')
    const replyScope = within(items[1])

    expect(replyScope.getByText('In reply to comment ID: c1')).toBeInTheDocument()
    expect(replyScope.getByText('Parent content')).toBeInTheDocument()
    expect(replyScope.getByRole('link', { name: 'Go to parent comment' })).toHaveAttribute('href', '#comment-c1')
    expect(within(items[0]).getByRole('button', { name: 'Reply' })).toBeInTheDocument()
    expect(replyScope.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
  })

  it('父评论未加载时保留回复并提示上下文不可用', () => {
    renderComments(readyState([makeComment('c2', { parentPublicId: 'missing' })]))

    expect(screen.getByText('Parent context is unavailable. It may not be loaded or may no longer be available.')).toBeInTheDocument()
    expect(screen.getByText('Comment c2')).toBeInTheDocument()
  })

  it('删除入口只向本人评论渲染', () => {
    renderComments(readyState([makeComment('c1'), makeComment('c2', { authorPublicId: OWNER })]))

    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(within(items[1]).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('删除需要行内确认，取消不发请求', () => {
    const { onDelete } = renderComments(readyState([makeComment('c1', { authorPublicId: OWNER })]))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this comment? Its replies will remain.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete this comment? Its replies will remain.')).not.toBeInTheDocument()
  })

  it('确认删除调用一次删除回调并关闭确认', async () => {
    const { onDelete } = renderComments(readyState([makeComment('c1', { authorPublicId: OWNER })]))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByText('Delete this comment? Its replies will remain.')).not.toBeInTheDocument())
  })

  it('Escape 取消确认且不发请求', () => {
    const { onDelete } = renderComments(readyState([makeComment('c1', { authorPublicId: OWNER })]))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Delete this comment? Its replies will remain.' }), { key: 'Escape' })

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete this comment? Its replies will remain.')).not.toBeInTheDocument()
  })

  it('读取失败时保留已有条目并给出两个重试入口', () => {
    const { onRetry, onReload } = renderComments({
      state: { status: 'error', data: { items: [makeComment('c1')], nextCursor: null }, error: 'Cannot reach the server.', stale: false },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server.')
    expect(screen.getByText('Comment c1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry reading comments' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reload first page' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onReload).toHaveBeenCalledOnce()
  })

  it('只读模式不渲染回复与删除入口', () => {
    renderComments({ ...readyState([makeComment('c1', { authorPublicId: OWNER })]), readOnly: true })

    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('游客点击回复只触发登录引导', () => {
    const { onReply, onLogin } = renderComments({ ...readyState([makeComment('c1')]), authStatus: 'guest', accountPublicId: null })

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(onLogin).toHaveBeenCalledOnce()
    expect(onReply).not.toHaveBeenCalled()
  })
})
