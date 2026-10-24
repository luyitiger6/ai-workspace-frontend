<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { completeTodo, createTodo, getTodos, type Todo } from './api'

const todos = ref<Todo[]>([])
const newTitle = ref('')
const loading = ref(false)
const error = ref('')

function showError(e: unknown, fallback: string) {
  error.value = e instanceof Error ? e.message : fallback
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    todos.value = await getTodos()
  } catch (e) {
    showError(e, '加载待办失败')
  } finally {
    loading.value = false
  }
}

async function addTodo() {
  const title = newTitle.value.trim()
  if (!title) {
    return
  }
  error.value = ''
  try {
    const created = await createTodo(title)
    todos.value.push(created)
    newTitle.value = ''
  } catch (e) {
    showError(e, '新增待办失败')
  }
}

async function finishTodo(id: number) {
  error.value = ''
  try {
    const updated = await completeTodo(id)
    const index = todos.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      todos.value[index] = updated
    }
  } catch (e) {
    showError(e, '完成待办失败')
  }
}

onMounted(refresh)
</script>

<template>
  <main class="todo-app">
    <h1>待办事项</h1>

    <form class="todo-form" @submit.prevent="addTodo">
      <input
        v-model="newTitle"
        type="text"
        placeholder="输入新待办…"
        aria-label="新待办标题"
      />
      <button type="submit">添加</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="loading" class="hint">加载中…</p>

    <ul v-else class="todo-list">
      <li v-for="todo in todos" :key="todo.id" :class="{ done: todo.done }">
        <span class="title">{{ todo.title }}</span>
        <button v-if="!todo.done" class="complete" @click="finishTodo(todo.id)">
          完成
        </button>
        <span v-else class="badge">已完成</span>
      </li>
    </ul>

    <p v-if="!loading && !error && todos.length === 0" class="hint">
      还没有待办事项
    </p>
  </main>
</template>
