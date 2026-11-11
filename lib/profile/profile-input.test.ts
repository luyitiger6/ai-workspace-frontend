import { describe, expect, it } from 'vitest'
import {
  codePointLength,
  firstCharacter,
  isAbsoluteHttpUrl,
  PROFILE_INPUT_LIMITS,
  stripWhitespace,
} from './profile-input'

describe('stripWhitespace', () => {
  it('与 Java Character.isWhitespace 同集合：全角与 Unicode 空白被去除', () => {
    expect(stripWhitespace('  name  ')).toBe('name')
    expect(stripWhitespace('\u3000\u3000')).toBe('')
    expect(stripWhitespace('\u2003name\u205F')).toBe('name')
    expect(stripWhitespace('\u2028name\u2029')).toBe('name')
  })

  it('Java 不算空白的码点保留：控制字符、NBSP、窄空格不删', () => {
    expect(stripWhitespace('\u0000name\u0001')).toBe('\u0000name\u0001')
    expect(stripWhitespace('\u00A0name\u00A0')).toBe('\u00A0name\u00A0')
    expect(stripWhitespace('\u2007name\u202F')).toBe('\u2007name\u202F')
  })
})

describe('PROFILE_INPUT_LIMITS', () => {
  it('与后端 ProfileRules 的数值一致', () => {
    expect(PROFILE_INPUT_LIMITS.displayNameChars).toBe(64)
    expect(PROFILE_INPUT_LIMITS.bioChars).toBe(200)
    expect(PROFILE_INPUT_LIMITS.maxInterests).toBe(5)
  })
})

describe('codePointLength', () => {
  it('代理对按一个字符计', () => {
    expect(codePointLength('')).toBe(0)
    expect(codePointLength('ab')).toBe(2)
    expect(codePointLength('😀')).toBe(1)
    expect(codePointLength('a😀')).toBe(2)
  })
})

describe('firstCharacter', () => {
  it('全角空格包裹的昵称取到真实首字符', () => {
    expect(firstCharacter('\u3000alice\u3000')).toBe('A')
  })

  it('纯空白返回空串，调用方据此改用人形占位', () => {
    expect(firstCharacter('\u3000')).toBe('')
    expect(firstCharacter('\u2003')).toBe('')
    expect(firstCharacter('')).toBe('')
  })
})

describe('isAbsoluteHttpUrl', () => {
  it('只接受 http(s) 绝对地址', () => {
    expect(isAbsoluteHttpUrl('https://cdn.example/a.png')).toBe(true)
    expect(isAbsoluteHttpUrl('http://cdn.example/a.png')).toBe(true)
    expect(isAbsoluteHttpUrl('/relative/a.png')).toBe(false)
    expect(isAbsoluteHttpUrl('ftp://cdn.example/a.png')).toBe(false)
    expect(isAbsoluteHttpUrl('')).toBe(false)
  })
})
