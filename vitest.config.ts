import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    // 组件测试依赖 DOM，统一使用 jsdom 环境；代理测试用文件内注释切到 node 环境
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    passWithNoTests: true,
  },
})
