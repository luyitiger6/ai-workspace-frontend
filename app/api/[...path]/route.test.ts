// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function samplesContext() {
  return { params: Promise.resolve({ path: ['samples'] }) }
}

describe('API 代理', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    delete process.env.BACKEND_URL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.BACKEND_URL
  })

  it('按默认后端地址拼接路径与查询串', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    const response = await GET(
      new Request('http://localhost:3000/api/samples?page=1'),
      samplesContext()
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [target, init] = fetchMock.mock.calls[0]
    expect(target).toBe('http://localhost:8989/api/samples?page=1')
    expect(init.method).toBe('GET')
    expect(init.cache).toBe('no-store')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('运行期修改 BACKEND_URL 后同一进程的新请求走新地址', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    process.env.BACKEND_URL = 'http://backend-a:9000'
    await GET(new Request('http://localhost:3000/api/samples'), samplesContext())
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend-a:9000/api/samples')

    process.env.BACKEND_URL = 'http://backend-b:9001/'
    await GET(new Request('http://localhost:3000/api/samples'), samplesContext())
    expect(fetchMock.mock.calls[1][0]).toBe('http://backend-b:9001/api/samples')
  })

  it('透传 POST 的方法、请求体、content-type 与响应状态', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, name: '示例条目' }, 201))

    const request = new Request('http://localhost:3000/api/samples', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '示例条目' }),
    })
    const response = await POST(request, samplesContext())

    const [target, init] = fetchMock.mock.calls[0]
    expect(target).toBe('http://localhost:8989/api/samples')
    expect(init.method).toBe('POST')
    expect(init.headers.get('content-type')).toBe('application/json')
    expect(new TextDecoder().decode(init.body)).toBe('{"name":"示例条目"}')
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 3, name: '示例条目' })
  })

  it('透传上游非 2xx 状态码与响应体', async () => {
    fetchMock.mockResolvedValue(
      new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } }),
    )

    const response = await GET(
      new Request('http://localhost:3000/api/samples/999'),
      { params: Promise.resolve({ path: ['samples', '999'] }) }
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(await response.text()).toBe('not found')
  })

  it('透传 429 状态、Retry-After 与错误体：限流响应对浏览器仍可解读', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }),
        {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '60' },
        },
      ),
    )

    const response = await POST(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', password: 'wrong' }),
      }),
      { params: Promise.resolve({ path: ['auth', 'login'] }) },
    )

    // 同源代理不得把 429 吞成 2xx/502，也不得丢掉 Retry-After（否则客户端不知道该等多久）。
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(await response.json()).toEqual({
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试',
    })
  })

  it('按白名单转发认证相关请求头，白名单外的头不带过去', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await POST(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'wc_session=header.payload.signature',
          origin: 'http://localhost:3000',
          referer: 'http://localhost:3000/login',
          'x-forwarded-for': '203.0.113.9',
          'x-custom': 'should-not-leak',
        },
        body: JSON.stringify({ email: 'a@example.com', password: 'password1' }),
      }),
      { params: Promise.resolve({ path: ['auth', 'login'] }) },
    )

    const forwarded = fetchMock.mock.calls[0][1].headers as Headers
    // 后端只从 cookie 读令牌、只从 origin / referer 做来源校验，这三个头丢了认证就静默失效。
    expect(forwarded.get('cookie')).toBe('wc_session=header.payload.signature')
    expect(forwarded.get('origin')).toBe('http://localhost:3000')
    expect(forwarded.get('referer')).toBe('http://localhost:3000/login')
    // 来源必须仍是浏览器直连的 origin：代理不得把客户端 IP 冒充成可信代理链的输入。
    expect(forwarded.get('x-forwarded-for')).toBeNull()
    expect(forwarded.get('x-custom')).toBeNull()
    expect(forwarded.has('host')).toBe(false)
  })

  it('上游多条 Set-Cookie 逐条回传，不被逗号合并成一条', async () => {
    const upstream = new Response(JSON.stringify({ publicId: '01J' }), {
      status: 200,
      headers: [
        ['content-type', 'application/json'],
        ['set-cookie', 'wc_session=header.payload.signature; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax'],
        ['set-cookie', 'wc_hint=1; Path=/; Max-Age=60'],
      ],
    })
    fetchMock.mockResolvedValue(upstream)

    const response = await POST(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', password: 'password1' }),
      }),
      { params: Promise.resolve({ path: ['auth', 'login'] }) },
    )

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toBe('wc_session=header.payload.signature; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax')
    expect(cookies[1]).toBe('wc_hint=1; Path=/; Max-Age=60')
  })

  it('后端不可达时返回 502', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const response = await GET(new Request('http://localhost:3000/api/samples'), samplesContext())

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: '后端服务不可达' })
  })
})
