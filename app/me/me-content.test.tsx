import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AiAssistantProvider } from '@/components/home/ai-assistant'
import { MediaApiError, uploadCoverImage } from '@/lib/media/media-api'
import { ProfileApiError, profileApi } from '@/lib/profile/profile-api'
import { MeContent } from './me-content'

// 保存成功会离开本页，测试里只需要一个可断言的跳转替身。
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

// 上传走 Mock，只替掉 uploadCoverImage；判型、错误文案等真身保留。
vi.mock('@/lib/media/media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media/media-api')>()
  return { ...actual, uploadCoverImage: vi.fn() }
})

// 资料三项走 Mock（本阶段），这里只替掉 profileApi 四个方法；错误类型与分流函数保留真身。
vi.mock('@/lib/profile/profile-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/profile/profile-api')>()
  return {
    ...actual,
    profileApi: {
      me: vi.fn(),
      update: vi.fn(),
      cards: vi.fn(),
      interests: vi.fn(),
    },
  }
})

const fetchMock = vi.fn()

const ME_BODY = {
  publicId: '01JME0000000000000000000',
  email: 'editor@wanderchain.dev',
  displayName: 'Editor Lan',
  status: 'active',
  createdAt: '2026-10-29T03:00:00Z',
}

const PROFILE = {
  publicId: '01JME0000000000000000000',
  displayName: 'Editor Lan',
  avatarUrl: '',
  bio: 'City walk enthusiast.',
  interests: ['hiking'],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** 登录态由 GET /me 决定；退出后由后端清 cookie，这里让 /me 转而返回 401。 */
function stubMe(body: unknown, status = 200) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input)
    if (url === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }
    return jsonResponse(body, status)
  })
}

function renderPage() {
  return render(
    <AuthProvider>
      <AiAssistantProvider>
        <MeContent />
      </AiAssistantProvider>
    </AuthProvider>,
  )
}

describe('个人中心', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    routerMock.push.mockReset()
    routerMock.replace.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(profileApi.me).mockReset()
    vi.mocked(profileApi.update).mockReset()
    vi.mocked(profileApi.interests).mockReset()
    vi.mocked(profileApi.cards).mockReset()
    vi.mocked(uploadCoverImage).mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未登录时不发起 GET /api/profile', async () => {
    stubMe({ code: 'UNAUTHENTICATED', message: '未认证' }, 401)

    renderPage()

    expect(await screen.findByText('Log in to manage your profile.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    expect(profileApi.me).not.toHaveBeenCalled()
  })

  it('保存成功后跳转广场并同步顶栏昵称', async () => {
    stubMe(ME_BODY)
    vi.mocked(profileApi.me).mockResolvedValue(PROFILE)
    vi.mocked(profileApi.interests).mockResolvedValue(['hiking', 'food'])
    vi.mocked(profileApi.update).mockResolvedValue({ ...PROFILE, displayName: 'New Name' })

    renderPage()

    const nameInput = await screen.findByLabelText('Display name')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // 跳转本身是完成信号：落到广场，不显示保存提示；顶栏昵称在跳转前已同步。
    await vi.waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/posts'))
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument()
    expect(screen.getByText('New Name')).toBeInTheDocument()
  })

  it('已登录时表单展示四项当前资料', async () => {
    stubMe(ME_BODY)
    vi.mocked(profileApi.me).mockResolvedValue({ ...PROFILE, avatarUrl: 'https://cdn.example.com/me.png' })
    vi.mocked(profileApi.interests).mockResolvedValue(['hiking', 'food'])

    renderPage()

    // 四项同源于 GET /api/profile：昵称、头像地址、简介、已选标签。
    expect(await screen.findByLabelText('Display name')).toHaveValue('Editor Lan')
    expect(screen.getByLabelText('Image URL')).toHaveValue('https://cdn.example.com/me.png')
    expect(screen.getByLabelText('Bio')).toHaveValue('City walk enthusiast.')
    expect(screen.getByRole('checkbox', { name: 'hiking' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'food' })).not.toBeChecked()
  })

  it('上传成功后回填头像地址并显示预览', async () => {
    stubMe(ME_BODY)
    vi.mocked(profileApi.me).mockResolvedValue(PROFILE)
    vi.mocked(profileApi.interests).mockResolvedValue(['hiking'])
    vi.mocked(uploadCoverImage).mockResolvedValue({
      url: 'https://cdn.example.com/uploaded.png',
      contentType: 'image/png',
      size: 3,
    })

    const { container } = renderPage()

    const file = new File(['abc'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(await screen.findByLabelText('Upload image'), { target: { files: [file] } })

    await vi.waitFor(() => expect(uploadCoverImage).toHaveBeenCalledWith(file))
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Image URL')).toHaveValue('https://cdn.example.com/uploaded.png'),
    )
    expect(container.querySelector('img[src="https://cdn.example.com/uploaded.png"]')).not.toBeNull()
  })

  it('上传失败保留已填地址并给出可读提示', async () => {
    stubMe(ME_BODY)
    vi.mocked(profileApi.me).mockResolvedValue({ ...PROFILE, avatarUrl: 'https://cdn.example.com/old.png' })
    vi.mocked(profileApi.interests).mockResolvedValue(['hiking'])
    vi.mocked(uploadCoverImage).mockRejectedValue(
      new MediaApiError(400, 'VALIDATION_FAILED', 'That image cannot be uploaded.'),
    )

    renderPage()

    expect(await screen.findByLabelText('Image URL')).toHaveValue('https://cdn.example.com/old.png')
    const file = new File(['abc'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [file] } })

    expect(
      await screen.findByText(
        'That image cannot be uploaded. Use a JPEG, PNG or WebP file no larger than 5 MB.',
      ),
    ).toBeInTheDocument()
    // 失败不得清掉用户已经填好的地址。
    expect(screen.getByLabelText('Image URL')).toHaveValue('https://cdn.example.com/old.png')
  })

  it('服务端 400 校验拒绝时保留输入', async () => {
    stubMe(ME_BODY)
    vi.mocked(profileApi.me).mockResolvedValue(PROFILE)
    vi.mocked(profileApi.interests).mockResolvedValue(['hiking', 'food'])
    vi.mocked(profileApi.update).mockRejectedValue(
      new ProfileApiError(400, 'VALIDATION_FAILED', 'Some fields are not valid.'),
    )

    renderPage()

    const nameInput = await screen.findByLabelText('Display name')
    fireEvent.change(nameInput, { target: { value: 'Retained Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Some fields are not valid. Check them and try again.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('Retained Name')
  })
})
