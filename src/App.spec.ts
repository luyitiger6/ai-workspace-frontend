import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from './api'
import App from './App.vue'

vi.mock('./api', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  completeTodo: vi.fn(),
}))

import { completeTodo, createTodo, getTodos } from './api'

const getTodosMock = vi.mocked(getTodos)
const createTodoMock = vi.mocked(createTodo)
const completeTodoMock = vi.mocked(completeTodo)

function makeTodo(id: number, title: string, done = false): Todo {
  return { id, title, done }
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载后渲染后端返回的待办列表', async () => {
    getTodosMock.mockResolvedValue([makeTodo(1, '买牛奶'), makeTodo(2, '写周报', true)])

    const wrapper = mount(App)
    await flushPromises()

    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('买牛奶')
    expect(items[1].text()).toContain('写周报')
    expect(items[1].text()).toContain('已完成')
  })

  it('提交表单调用创建接口并把新待办加入列表', async () => {
    getTodosMock.mockResolvedValue([])
    createTodoMock.mockResolvedValue(makeTodo(3, '新任务'))

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('input').setValue('新任务')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createTodoMock).toHaveBeenCalledWith('新任务')
    expect(wrapper.text()).toContain('新任务')
  })

  it('点击完成按钮调用完成接口并更新该条状态', async () => {
    getTodosMock.mockResolvedValue([makeTodo(1, '买牛奶')])
    completeTodoMock.mockResolvedValue(makeTodo(1, '买牛奶', true))

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('button.complete').trigger('click')
    await flushPromises()

    expect(completeTodoMock).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.find('button.complete').exists()).toBe(false)
  })
})
