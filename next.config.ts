import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone 产物自带最小依赖与 server.js，供容器运行
  output: 'standalone',
  images: {
    // 自定义 loader 把宽度档位写进图片来源的尺寸参数，出图交给图片 CDN，不经过 /_next/image
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
}

export default nextConfig
