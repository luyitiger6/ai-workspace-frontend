import { describe, expect, it } from 'vitest'
import { CITIES } from './cities'
import { ATTRACTIONS, EDITOR_PICKS, POSTS } from './mock-data'

/**
 * 双语内容字段的完整性守卫：界面只展示英文字段，
 * 因此英文缺失或混入中文都会直接暴露为界面缺陷。
 */
const HAN = /\p{Script=Han}/u

function nonBlank(value: string): boolean {
  return value.trim().length > 0
}

interface BilingualRecord {
  readonly label: string
  readonly fields: ReadonlyArray<readonly [name: string, zh: string, en: string]>
}

const records: readonly BilingualRecord[] = [
  ...CITIES.map((city) => ({
    label: `city:${city.slug}`,
    fields: [
      ['name', city.name, city.nameEn],
      ['tagline', city.tagline, city.taglineEn],
    ] as const,
  })),
  ...EDITOR_PICKS.map((pick) => ({
    label: `editor-pick:${pick.id}`,
    fields: [
      ['title', pick.title, pick.titleEn],
      ['summary', pick.summary, pick.summaryEn],
      ['editor', pick.editor, pick.editorEn],
    ] as const,
  })),
  ...POSTS.map((post) => ({
    label: `post:${post.id}`,
    fields: [
      ['title', post.title, post.titleEn],
      ['author', post.author, post.authorEn],
    ] as const,
  })),
  ...ATTRACTIONS.map((item) => ({
    label: `attraction:${item.id}`,
    fields: [['name', item.name, item.nameEn]] as const,
  })),
]

describe('双语内容字段完整性', () => {
  it('城市白名单与三类内容都有记录', () => {
    expect(CITIES.length).toBeGreaterThan(0)
    expect(EDITOR_PICKS.length).toBeGreaterThan(0)
    expect(POSTS.length).toBeGreaterThan(0)
    expect(ATTRACTIONS.length).toBeGreaterThan(0)
  })

  for (const record of records) {
    it(`${record.label} 的中英文字段都非空白`, () => {
      for (const [name, zh, en] of record.fields) {
        expect(nonBlank(zh), `${record.label}.${name} 中文为空`).toBe(true)
        expect(nonBlank(en), `${record.label}.${name} 英文为空`).toBe(true)
      }
    })

    it(`${record.label} 的英文字段不含中文字符`, () => {
      for (const [name, , en] of record.fields) {
        expect(HAN.test(en), `${record.label}.${name} 含中文字符：${en}`).toBe(false)
      }
    })
  }
})
