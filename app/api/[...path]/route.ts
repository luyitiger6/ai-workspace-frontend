import { backendBaseUrl } from '@/lib/backend-url'

/**
 * 按白名单转发给后端的请求头。
 *
 * 这三个头缺任意一个，认证链路都会在端到端上静默失效：cookie 是令牌的唯一载体，
 * origin 与 referer 是后端来源校验的输入。白名单之外的头一律不转发——
 * host 尤其不能带过去，否则后端看到的请求主机名来自前端而不是转发目标。
 */
const FORWARDED_REQUEST_HEADERS = ['cookie', 'origin', 'referer'] as const

/**
 * 按白名单回传的响应头。
 *
 * 只有缓存相关的两项：没有它们，封面图会退化成每次渲染都重新下载；
 * content-length 不在名单里——流式转发下长度与实际字节不一致会造成截断。
 */
const FORWARDED_RESPONSE_HEADERS = ['cache-control', 'etag'] as const

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  const search = new URL(request.url).search
  // 逐段编码后拼到配置的 origin 之后，客户端无法把请求导向其他主机
  const target = `${backendBaseUrl()}/api/${path.map(encodeURIComponent).join('/')}${search}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }
  const accept = request.headers.get('accept')
  if (accept) {
    headers.set('accept', accept)
  }
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) {
      headers.set(name, value)
    }
  }

  const method = request.method
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    })
  } catch {
    return Response.json({ error: '后端服务不可达' }, { status: 502 })
  }

  const responseHeaders = new Headers()
  const upstreamContentType = upstream.headers.get('content-type')
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType)
  }
  // 429 的 Retry-After 必须一并透传：浏览器直连的是本代理而非后端，
  // 丢掉这个头，限流响应对客户端就不再可解读（该等多久无从得知）。
  const upstreamRetryAfter = upstream.headers.get('retry-after')
  if (upstreamRetryAfter) {
    responseHeaders.set('retry-after', upstreamRetryAfter)
  }
  // Set-Cookie 必须逐条回传：认证令牌只从这个头出去。
  // 用 get() 取值会把多条 cookie 按逗号合并成一条，属性随之错位，浏览器要么存不下要么存错。
  for (const setCookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', setCookie)
  }
  // 封面图这类不变资源的缓存头必须透传：图片经本代理出口，丢掉缓存头就等于每次渲染都重新下载。
  // content-length 刻意不透传：流式转发下长度一旦与实际字节不一致反而会截断。
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) {
      responseHeaders.set(name, value)
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context)
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context)
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context)
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context)
}

export function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context)
}
