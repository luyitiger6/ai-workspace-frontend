import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest 未开启 globals，RTL 的自动清理不会注册，需显式在用例间卸载组件
afterEach(() => {
  cleanup()
})
