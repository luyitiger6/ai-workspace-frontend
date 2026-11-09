import { describe, expect, it } from 'vitest'
import {
  codePointLength,
  describeMessageProblem,
  MESSAGE_MAX_CHARS,
  parsePeerPublicId,
  stripWhitespace,
} from './dm-input'

const PEER = `01PEER${'0'.repeat(19)}1`

describe('parsePeerPublicId', () => {
  it('直接粘贴公开标识时原样返回', () => {
    expect(parsePeerPublicId(PEER)).toBe(PEER)
    expect(parsePeerPublicId(`  ${PEER}  `)).toBe(PEER)
  })

  it('从相对用户页地址取最后一段', () => {
    expect(parsePeerPublicId(`/users/${PEER}`)).toBe(PEER)
    expect(parsePeerPublicId(`/users/${PEER}/`)).toBe(PEER)
  })

  it('从完整地址带查询参数时取最后一段', () => {
    expect(parsePeerPublicId(`https://wanderchain.example/users/${PEER}?from=feed`)).toBe(PEER)
  })

  it('形状对不上即返回 null，不猜哪一段可能是标识', () => {
    expect(parsePeerPublicId('')).toBeNull()
    expect(parsePeerPublicId('   ')).toBeNull()
    expect(parsePeerPublicId('hello')).toBeNull()
    expect(parsePeerPublicId('/users/not-a-ulid')).toBeNull()
    expect(parsePeerPublicId(`/users/${PEER}/posts`)).toBeNull()
    expect(parsePeerPublicId(PEER.toLowerCase())).toBeNull()
  })
})

describe('stripWhitespace', () => {
  it('只去首尾 U+0000–U+0020，与 Java strip 同覆盖范围', () => {
    expect(stripWhitespace('  hello\n')).toBe('hello')
    expect(stripWhitespace('\u0000hi\u0001')).toBe('hi')
    expect(stripWhitespace('\u00A0hi\u00A0')).toBe('\u00A0hi\u00A0')
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

describe('describeMessageProblem', () => {
  it('空与纯空白返回同一条提示', () => {
    expect(describeMessageProblem('')).toBe('Write something before sending.')
    expect(describeMessageProblem(' \n\t\r')).toBe('Write something before sending.')
  })

  it('正常正文与首尾空白不拦截', () => {
    expect(describeMessageProblem('hello')).toBeNull()
    expect(describeMessageProblem('  hello  ')).toBeNull()
  })

  it('按码点计长：2000 接受，2001 拒绝', () => {
    expect(describeMessageProblem('a'.repeat(MESSAGE_MAX_CHARS))).toBeNull()
    expect(describeMessageProblem('a'.repeat(MESSAGE_MAX_CHARS + 1))).toBe(
      `Messages must be ${MESSAGE_MAX_CHARS} characters or fewer.`,
    )
  })

  it('emoji 按一个码点计，不被 UTF-16 长度提前拒绝', () => {
    expect(describeMessageProblem('😀'.repeat(MESSAGE_MAX_CHARS))).toBeNull()
    expect(describeMessageProblem('😀'.repeat(MESSAGE_MAX_CHARS + 1))).toBe(
      `Messages must be ${MESSAGE_MAX_CHARS} characters or fewer.`,
    )
  })
})
