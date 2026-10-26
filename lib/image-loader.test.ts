import { describe, expect, it } from 'vitest'
import imageLoader from './image-loader'

const UNSPLASH =
  'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=70'

describe('图片 loader', () => {
  it('把宽度档位改写进 URL 的 w 参数', () => {
    const url = imageLoader({ src: UNSPLASH, width: 360 })

    expect(url).toContain('w=360')
    expect(url).not.toContain('w=900')
  })

  it('相对路径原样返回', () => {
    expect(imageLoader({ src: '/favicon.svg', width: 64 })).toBe('/favicon.svg')
  })

  it('未传 quality 时回落到 70，传了则用传入值', () => {
    expect(imageLoader({ src: UNSPLASH, width: 360 })).toContain('q=70')
    expect(imageLoader({ src: UNSPLASH, width: 360, quality: 55 })).toContain('q=55')
  })
})
