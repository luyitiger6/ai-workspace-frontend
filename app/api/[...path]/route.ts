const DEFAULT_BACKEND_URL = 'http://localhost:8989'

/** 运行期读取后端地址：换后端只需改环境变量并重启进程，无需重建产物 */
function backendBaseUrl(): string {
  return (process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/+$/, '')
}

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
