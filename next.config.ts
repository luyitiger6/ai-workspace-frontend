import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone 产物自带最小依赖与 server.js，供容器运行
  output: 'standalone',
}

export default nextConfig
