'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { completeTodo, createTodo, getTodos, type Todo } from '../lib/api'

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function showError(e: unknown, fallback: string) {
    setError(e instanceof Error ? e.message : fallback)
  }

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setTodos(await getTodos())
    } catch (e) {
      showError(e, '加载待办失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) {
      return
    }
    setError('')
    try {
      const created = await createTodo(title)
      setTodos((prev) => [...prev, created])
      setNewTitle('')
    } catch (e) {
      showError(e, '新增待办失败')
    }
  }

  async function finishTodo(id: number) {
    setError('')
    try {
      const updated = await completeTodo(id)
      setTodos((prev) => prev.map((todo) => (todo.id === id ? updated : todo)))
    } catch (e) {
      showError(e, '完成待办失败')
    }
  }

  return (
    <main className="todo-app">
      <h1>待办事项</h1>

      <form className="todo-form" onSubmit={addTodo}>
        <input
          type="text"
          placeholder="输入新待办…"
          aria-label="新待办标题"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
        />
        <button type="submit">添加</button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="hint">加载中…</p>}

      {!loading && (
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? 'done' : undefined}>
              <span className="title">{todo.title}</span>
              {todo.done ? (
                <span className="badge">已完成</span>
              ) : (
                <button
                  type="button"
                  className="complete"
                  onClick={() => {
                    void finishTodo(todo.id)
                  }}
                >
                  完成
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && todos.length === 0 && (
        <p className="hint">还没有待办事项</p>
      )}
    </main>
  )
}
