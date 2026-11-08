import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicProfileResponse } from '@/lib/contracts/profile'
import type { PostSummaryResponse } from '@/lib/contracts/posts'
import { UserPageContent } from './user-page-content'

const fetchMock = vi.fn()
const ID = '01K7USER0000000000000000000'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const profile: PublicProfileResponse = {
  publicId: ID,
  displayName: 'Grace Lin',
  avatarUrl: '',
  bio: 'Slow travel, long walks.',
  interests: ['hiking', 'food'],
}

const post: PostSummaryResponse = {
  publicId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  title: 'A real route',
  coverImage: '',
  tags: ['Walking'],
  status: 'published',
  authorPublicId: ID,
  createdAt: '2026-10-11T16:30:00+08:00',
  updatedAt: '2026-10-11T16:30:00+08:00',
  commentCount: 0,
  upVoteCount: 0,
  bookmarkCount: 0,
}

/** 资料与列表共用一个作者页端点族，靠路径是否带 `/posts` 分流。 */
const isPostsPath = (path: string) => path.includes('/posts')

function renderPage(publicId = ID) {
  return render(<UserPageContent publicId={publicId} />)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('用户页', () => {
  it('加载中展示资料骨架与帖子骨架，不发假内容', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))

    renderPage()

    expect(screen.getByText('Loading this member…')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Loading post')).toHaveLength(2)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('资料 404 只展示用户不存在，不再渲染列表区', async () => {
    fetchMock.mockImplementation(async () =>
      json({ code: 'PROFILE_NOT_FOUND', message: '用户不存在' }, 404),
    )

    renderPage()

    expect(await screen.findByRole('heading', { name: 'User not found' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Published posts' })).not.toBeInTheDocument()
    expect(screen.queryByText('No posts yet.')).not.toBeInTheDocument()
  })

  it('列表失败只影响列表区，重试后恢复而资料保持不动', async () => {
    let postsFail = true
    fetchMock.mockImplementation(async (path: string) => {
      if (!isPostsPath(path)) return json(profile)
      return postsFail
        ? new Response('upstream unavailable', { status: 502 })
        : json({ items: [post], nextCursor: null })
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Grace Lin' })).toBeInTheDocument()
    expect(await screen.findByText('Posts could not load. Please try again.')).toBeInTheDocument()

    postsFail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading posts' }))

    expect(await screen.findByTestId('post-card')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Grace Lin' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([path]) => !isPostsPath(path))).toHaveLength(1)
  })

  it('用户存在但没有已发布帖子：资料正常、列表展示空态', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      isPostsPath(path) ? json({ items: [], nextCursor: null }) : json(profile),
    )

    renderPage()

    expect(await screen.findByText('No posts yet.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Grace Lin' })).toBeInTheDocument()
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument()
  })

  it('正常态渲染四项资料与该用户的帖子卡片', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      isPostsPath(path) ? json({ items: [post], nextCursor: null }) : json(profile),
    )

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Grace Lin' })).toBeInTheDocument()
    expect(screen.getByText('Slow travel, long walks.')).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Interests' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['hiking', 'food'])

    expect(await screen.findByTestId('post-card')).toBeInTheDocument()
    // 作者区指向本页用户；帖子链接不带广场的排序词。
    expect(screen.getAllByRole('link', { name: 'Grace Lin' })[0]).toHaveAttribute('href', `/users/${ID}`)
    expect(screen.getByRole('link', { name: 'A real route' })).toHaveAttribute('href', `/posts/${post.publicId}`)
  })

  it('昵称为空时按 OQ2 兜底成 Member 加标识后四位', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      isPostsPath(path) ? json({ items: [], nextCursor: null }) : json({ ...profile, displayName: '   ' }),
    )

    renderPage()

    expect(await screen.findByRole('heading', { name: `Member ${ID.slice(-4)}` })).toBeInTheDocument()
  })
})
