/**
 * 后端 Todo API 的 fetch 封装。
 * 浏览器只请求同源的 /api/todos，由 app/api/[...path]/route.ts 代理到后端。
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
