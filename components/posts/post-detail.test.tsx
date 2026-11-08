import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/components/auth/auth-provider'
import type { MeResponse } from '@/lib/contracts/auth'
import type { CommentResponse } from '@/lib/contracts/posts'
import type { PostDetail as PostDetailModel } from '@/lib/posts/types'
import type { usePostDetail } from './use-post-detail'
import { PostDetail } from './post-detail'

const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FAA'
const POST_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

type DetailApi = ReturnType<typeof usePostDetail>
type View = DetailApi['view']

const harness = vi.hoisted(() => ({ detail: null as unknown }))
vi.mock('./use-post-detail', () => ({ usePostDetail: () => harness.detail }))
// 删除成功会离开详情页，测试里只需要一个可断言的跳转替身。
const routerMock = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'user',
    user: { publicId: OWNER, email: 'walker@example.com', displayName: 'Walker', status: 'active', createdAt: '2026-09-01T08:00:00+08:00' } satisfies MeResponse,
    login: vi.fn().mockResolvedValue(null),
    register: vi.fn().mockResolvedValue(null),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(null),
    setDisplayName: vi.fn(),
    expireSession: vi.fn(),
    logoutRevision: 0,
    ...overrides,
  }
}

function makePost(overrides: Partial<PostDetailModel> = {}): PostDetailModel {
  return {
    publicId: POST_ID,
    title: 'A walk through the old town',
    content: 'Body text',
    coverImage: 'https://example.com/cover.jpg',
    tags: ['Walking', 'Food'],
    status: 'published',
    authorPublicId: OWNER,
    createdAt: '2026-10-01T10:00:00+08:00',
    updatedAt: '2026-10-01T10:00:00+08:00',
    commentCount: 2,
    upVoteCount: 7,
    bookmarkCount: 3,
    ...overrides,
  }
}

function makeComment(id: string, overrides: Partial<CommentResponse> = {}): CommentResponse {
  return {
    publicId: id,
    postPublicId: POST_ID,
    parentPublicId: null,
    authorPublicId: OWNER,
    content: `Comment ${id}`,
    createdAt: '2026-10-11T16:30:00+08:00',
    updatedAt: '2026-10-11T16:30:00+08:00',
    ...overrides,
  }
}

function makeView(overrides: Partial<View> = {}): View {
  return {
    key: 'scope',
    detail: { status: 'ready', data: makePost(), error: null, stale: false },
    comments: { status: 'ready', data: { items: [makeComment('c1')], nextCursor: null }, error: null, stale: false },
    personal: { status: 'ready', data: { voteDirection: null, bookmarked: false }, error: null, stale: false },
    busy: false,
    loadingMore: false,
    mutationKind: null,
    needsReview: false,
    mutation: { status: 'idle', message: '' },
    sessionExpired: false,
    ...overrides,
  }
}

function makeDetail(options: { auth?: Partial<AuthContextValue>; view?: Partial<View>; draft?: Partial<DetailApi['draft']> } = {}): DetailApi {
  const view = makeView(options.view)
  return {
    auth: makeAuth(options.auth),
    view,
    canEdit: false,
    draft: { content: '', replyTo: null, ownerPublicId: OWNER, locked: false, ...options.draft },
    editContent: vi.fn(),
    chooseReply: vi.fn(),
    submitComment: vi.fn().mockResolvedValue('success'),
    deleteComment: vi.fn().mockResolvedValue('success'),
    deletePost: vi.fn().mockResolvedValue('success'),
    recheckSession: vi.fn().mockResolvedValue(undefined),
    toggleVote: vi.fn(),
    toggleBookmark: vi.fn(),
    retryDetail: vi.fn().mockResolvedValue(undefined),
    retryPersonal: vi.fn(),
    loadMoreComments: vi.fn(),
    retryComments: vi.fn(),
    reloadComments: vi.fn(),
  }
}

function renderDetail(detail: DetailApi, sortBy?: 'latest' | 'hottest' | 'mostDiscussed') {
  harness.detail = detail
  return render(<PostDetail publicId={POST_ID} sortBy={sortBy} />)
}

beforeEach(() => { harness.detail = null })

describe('PostDetail', () => {
  it('身份未定时只显示加载态，不渲染正文骨架', () => {
    renderDetail(makeDetail({ auth: { status: 'loading', user: null }, view: { detail: { status: 'idle', data: null, error: null, stale: false } } }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading post…')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('详情读取失败且无旧数据时给出错误与重试入口', () => {
    const detail = makeDetail({ view: { detail: { status: 'error', data: null, error: 'Cannot reach the server.', stale: false } } })
    renderDetail(detail)

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry reading post' }))
    expect(detail.retryDetail).toHaveBeenCalledOnce()
  })

  it('详情不存在时显示未找到页', () => {
    renderDetail(makeDetail({ view: { detail: { status: 'not-found', data: null, error: null, stale: false } } }))

    expect(screen.getByRole('heading', { level: 1, name: 'Post not found' })).toBeInTheDocument()
    expect(screen.getByText('This post is not available.')).toBeInTheDocument()
  })

  it('已发布帖子渲染标题、标签、时间、封面、统计与写入口', () => {
    renderDetail(makeDetail(), 'hottest')

    expect(screen.getByRole('heading', { level: 1, name: 'A walk through the old town' })).toBeInTheDocument()
    const tags = screen.getByRole('list', { name: 'Post tags' })
    expect(within(tags).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Walking', 'Food'])
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-10-01T10:00:00+08:00')
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(screen.getByLabelText('7 upvotes')).toBeInTheDocument()
    expect(screen.getByText('Your comment')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Back to all posts' })).toHaveAttribute('href', '/posts?sortBy=hottest')
  })

  it('封面加载失败时退回占位文案', () => {
    renderDetail(makeDetail())

    fireEvent.error(document.querySelector('img') as HTMLImageElement)
    expect(screen.getByText('No cover image')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('草稿详情为只读：隐藏互动条与发表入口，并提示仅本人可见', () => {
    renderDetail(makeDetail({ view: { detail: { status: 'ready', data: makePost({ status: 'draft' }), error: null, stale: false } } }))

    expect(screen.getByRole('status')).toHaveTextContent('Draft — only you can read this post. Interactions are unavailable.')
    expect(screen.queryByRole('button', { name: 'Upvote' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Your comment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
  })

  it('游客点击评论入口展开登录引导，并带上返回目标', () => {
    renderDetail(makeDetail({ auth: { status: 'guest', user: null } }))

    expect(screen.queryByText('Log in to continue. Your previous action will not be submitted automatically.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Log in to comment' }))

    const guide = screen.getByText('Log in to continue. Your previous action will not be submitted automatically.')
    expect(guide.closest('aside')).toHaveAttribute('id', 'post-login-guide')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/posts/${POST_ID}`)}`)
  })

  it('写结果未知时锁定互动并给出核对入口', () => {
    const detail = makeDetail({
      view: {
        needsReview: true,
        mutation: { status: 'uncertain', message: 'The write result is unknown. Check server data before taking another action; nothing will be sent again automatically.' },
      },
    })
    renderDetail(detail)

    expect(screen.getByRole('alert')).toHaveTextContent('The write result is unknown.')
    expect(screen.getByRole('button', { name: 'Upvote' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Check server data' }))
    expect(detail.retryDetail).toHaveBeenCalledOnce()
  })
})
