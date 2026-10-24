import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 开发环境将 /api 转发到后端（application.yml 端口 8989），
      // 避免跨域，生产环境由部署方反向代理承担同样职责
      '/api': 'http://localhost:8989',
    },
  },
  test: {
    // 组件测试依赖 DOM，统一使用 jsdom 环境
    environment: 'jsdom',
  },
})
