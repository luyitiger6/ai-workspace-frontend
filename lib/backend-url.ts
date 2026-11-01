const DEFAULT_BACKEND_URL = 'http://localhost:8989'

/**
 * 后端地址的唯一读法：换后端只需改环境变量并重启进程，无需重建产物。
 *
 * 同源代理（`app/api/[...path]/route.ts`）与搜索页的服务端取数共用这一个入口。
 * 客户端组件不要用它——浏览器里没有 `BACKEND_URL`，同源代理才是客户端的唯一出口。
 */
export function backendBaseUrl(): string {
  return (process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/+$/, '')
}
