import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from '../lib/api'
import TodoApp from './TodoApp'

vi.mock('../lib/api', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  completeTodo: vi.fn(),
}))

import { completeTodo, createTodo, getTodos } from '../lib/api'

const getTodosMock = vi.mocked(getTodos)
const createTodoMock = vi.mocked(createTodo)
const completeTodoMock = vi.mocked(completeTodo)

function makeTodo(id: number, title: string, done = false): Todo {
  return { id, title, done }
}

describe('TodoApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载后渲染后端返回的待办列表', async () => {
    getTodosMock.mockResolvedValue([makeTodo(1, '买牛奶'), makeTodo(2, '写周报', true)])

    render(<TodoApp />)

    expect(await screen.findByText('买牛奶')).toBeInTheDocument()
    expect(screen.getByText('写周报')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('提交表单调用创建接口并把新待办加入列表', async () => {
    getTodosMock.mockResolvedValue([])
    createTodoMock.mockResolvedValue(makeTodo(3, '新任务'))
    const user = userEvent.setup()

    render(<TodoApp />)

    expect(await screen.findByText('还没有待办事项')).toBeInTheDocument()
    await user.type(screen.getByLabelText('新待办标题'), '新任务')
    await user.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() => expect(createTodoMock).toHaveBeenCalledWith('新任务'))
    expect(await screen.findByText('新任务')).toBeInTheDocument()
  })

  it('点击完成按钮调用完成接口并更新该条状态', async () => {
    getTodosMock.mockResolvedValue([makeTodo(1, '买牛奶')])
    completeTodoMock.mockResolvedValue(makeTodo(1, '买牛奶', true))
    const user = userEvent.setup()

    render(<TodoApp />)

    await user.click(await screen.findByRole('button', { name: '完成' }))

    await waitFor(() => expect(completeTodoMock).toHaveBeenCalledWith(1))
    expect(await screen.findByText('已完成')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完成' })).not.toBeInTheDocument()
  })

  it('请求失败时展示错误且保留已加载的列表', async () => {
    getTodosMock.mockResolvedValue([makeTodo(1, '买牛奶')])
    completeTodoMock.mockRejectedValue(new Error('请求失败：HTTP 500'))
    const user = userEvent.setup()

    render(<TodoApp />)

    await user.click(await screen.findByRole('button', { name: '完成' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请求失败：HTTP 500')
    expect(screen.getByText('买牛奶')).toBeInTheDocument()
  })
})
