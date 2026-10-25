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

function todosContext() {
  return { params: Promise.resolve({ path: ['todos'] }) }
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
      new Request('http://localhost:3000/api/todos?page=1'),
      todosContext(),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [target, init] = fetchMock.mock.calls[0]
    expect(target).toBe('http://localhost:8989/api/todos?page=1')
    expect(init.method).toBe('GET')
    expect(init.cache).toBe('no-store')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('运行期修改 BACKEND_URL 后同一进程的新请求走新地址', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    process.env.BACKEND_URL = 'http://backend-a:9000'
    await GET(new Request('http://localhost:3000/api/todos'), todosContext())
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend-a:9000/api/todos')

    process.env.BACKEND_URL = 'http://backend-b:9001/'
    await GET(new Request('http://localhost:3000/api/todos'), todosContext())
    expect(fetchMock.mock.calls[1][0]).toBe('http://backend-b:9001/api/todos')
  })

  it('透传 POST 的方法、请求体、content-type 与响应状态', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, title: '新任务', done: false }, 201))

    const request = new Request('http://localhost:3000/api/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '新任务' }),
    })
    const response = await POST(request, todosContext())

    const [target, init] = fetchMock.mock.calls[0]
    expect(target).toBe('http://localhost:8989/api/todos')
    expect(init.method).toBe('POST')
    expect(init.headers.get('content-type')).toBe('application/json')
    expect(new TextDecoder().decode(init.body)).toBe('{"title":"新任务"}')
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 3, title: '新任务', done: false })
  })

  it('透传上游非 2xx 状态码与响应体', async () => {
    fetchMock.mockResolvedValue(
      new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } }),
    )

    const response = await GET(
      new Request('http://localhost:3000/api/todos/999'),
      { params: Promise.resolve({ path: ['todos', '999'] }) },
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(await response.text()).toBe('not found')
  })

  it('后端不可达时返回 502', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const response = await GET(new Request('http://localhost:3000/api/todos'), todosContext())

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: '后端服务不可达' })
  })
})
