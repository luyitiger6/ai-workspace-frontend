import type { ImageLoaderProps } from 'next/image'

/**
 * 自定义图片 loader：把 next/image 算出的宽度档位直接写进 Unsplash 的 w 参数，
 * 由 Unsplash CDN 出图，请求不经过 Next 的 /_next/image 优化端点。
 * 非绝对 URL（未来的本地图片）原样返回，避免 new URL 抛错。
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!/^https?:\/\//i.test(src)) {
    return src
  }

  const url = new URL(src)
  url.searchParams.set('w', String(width))
  url.searchParams.set('q', String(quality ?? 70))
  url.searchParams.set('auto', 'format')
  url.searchParams.set('fit', 'crop')
  return url.toString()
}
