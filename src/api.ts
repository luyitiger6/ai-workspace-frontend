/**
 * 后端 Todo API 的 fetch 封装。
 * 开发环境经 vite server.proxy 转发到 http://localhost:8989，
 * 生产环境由部署方将 /api 指向后端服务。
 */
export interface Todo {
  id: number
  title: string
  done: boolean
}

const BASE_URL = '/api/todos'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, init)
  if (!response.ok) {
    throw new Error(`请求失败：HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getTodos(): Promise<Todo[]> {
  return request<Todo[]>('')
}

export function createTodo(title: string): Promise<Todo> {
  return request<Todo>('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export function completeTodo(id: number): Promise<Todo> {
  return request<Todo>(`/${id}/complete`, { method: 'POST' })
}
