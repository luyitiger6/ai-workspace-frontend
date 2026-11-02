import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommentResponse } from '@/lib/contracts/posts'
import type { CommentDraft } from './use-post-detail'
import { CommentComposer } from './comment-composer'

const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FAA'

function makeComment(id: string, overrides: Partial<CommentResponse> = {}): CommentResponse {
  return {
    publicId: id,
    postPublicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    parentPublicId: null,
    authorPublicId: '01ARZ3NDEKTSV4RRFFQ69G5FBB',
    content: 'Parent content',
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

function makeDraft(overrides: Partial<CommentDraft> = {}): CommentDraft {
  return { content: '', replyTo: null, ownerPublicId: OWNER, locked: false, ...overrides }
}

function renderComposer(overrides: Partial<Parameters<typeof CommentComposer>[0]> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onCancelReply: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue('success' as const),
  }
  const props = {
    draft: makeDraft(),
    disabled: false,
    busy: false,
    error: null,
    ...handlers,
    ...overrides,
  }
  const view = render(<CommentComposer {...props} />)
  return { ...handlers, ...view }
}

describe('CommentComposer', () => {
  it('初始不显示校验错误，计数器按去空白后的长度统计', () => {
    renderComposer({ draft: makeDraft({ content: '  hi  ' }) })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('2/2000')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your comment' })).not.toHaveAttribute('aria-invalid')
  })

  it('提交空内容不发请求，就地给出错误并把焦点送回输入框', () => {
    const { onSubmit } = renderComposer({ draft: makeDraft({ content: '   ' }) })
    const input = screen.getByRole('textbox', { name: 'Your comment' })

    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Write a comment before submitting.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'comment-help comment-error')
    expect(document.activeElement).toBe(input)
  })

  it('超过上限时不必提交就提示，且提交仍被拦住', () => {
    const { onSubmit } = renderComposer({ draft: makeDraft({ content: 'a'.repeat(2001) }) })

    expect(screen.getByRole('alert')).toHaveTextContent('Comments must be 2000 UTF-16 code units or fewer.')
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('修改内容后撤下上一次的校验提示', () => {
    renderComposer({ draft: makeDraft({ content: '' }) })

    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Your comment' }), { target: { value: 'hello' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('回复态展示被回复对象、切换文案并支持取消回复', () => {
    const { onCancelReply, onSubmit } = renderComposer({ draft: makeDraft({ content: 'Reply body', replyTo: makeComment('c1') }) })

    expect(screen.getByText('Replying to comment ID: c1')).toBeInTheDocument()
    expect(screen.getByText('Parent content')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveValue('Reply body')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }))
    expect(onCancelReply).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('锁定草稿禁用输入与提交并给出解锁说明', () => {
    renderComposer({ draft: makeDraft({ content: 'draft', locked: true }) })

    const input = screen.getByRole('textbox', { name: 'Your comment' })
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('aria-describedby', 'comment-help comment-locked')
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('This draft belongs to your previous session.')
  })

  it('写入期间禁用整表单并改用等待文案', () => {
    renderComposer({ draft: makeDraft({ content: 'hello' }), busy: true })

    expect(screen.getByRole('textbox', { name: 'Your comment' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled()
    expect(document.querySelector('form')).toHaveAttribute('aria-busy', 'true')
  })

  it('外部错误按 alert 展示并标注输入无效', () => {
    renderComposer({ draft: makeDraft({ content: 'hello' }), error: 'Cannot reach the server.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server.')
    expect(screen.getByRole('textbox', { name: 'Your comment' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('有效内容提交时只调用一次提交回调', async () => {
    const { onSubmit } = renderComposer({ draft: makeDraft({ content: 'hello' }) })

    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
