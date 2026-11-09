import { beforeEach, describe, expect, it } from 'vitest'
import { MOCK_SELF_PUBLIC_ID, dmApi, resetMockDm, USE_MOCK_DM } from './dm-api'

/**
 * Mock 分支：默认开关、以及「新建 → 发送 → 列表摘要 → 已读」这条页面主链路。
 *
 * 这里断言的是行为与后端一致（新会话没有预览、发送只记自己、摘要取最后一条），
 * 不是内部实现——页面在 Mock 下的取值因此可以直接搬到真接口联调。
 */
beforeEach(() => resetMockDm())

describe('Mock 私信端点层', () => {
  it('默认走 Mock，不需要任何环境变量', () => {
    expect(USE_MOCK_DM).toBe(true)
  })

  it('新建会话：对方名片来自标识，未发消息时没有预览但已有活跃时间', async () => {
    const conversation = await dmApi.create('01PEER00000000000000000001')
    expect(conversation.peer).toEqual({
      publicId: '01PEER00000000000000000001',
      displayName: 'Member 0001',
      avatarUrl: '',
    })
    expect(conversation).toMatchObject({ messageCount: 0, unreadCount: 0, lastMessagePreview: null })
    expect(conversation.lastMessageAt).toBe(conversation.createdAt)
    expect(await dmApi.conversations()).toEqual([conversation])
  })

  it('重复发起同一对方返回同一个会话，不新建第二条', async () => {
    const first = await dmApi.create('01PEER00000000000000000001')
    const again = await dmApi.create('01PEER00000000000000000001')
    expect(again.publicId).toBe(first.publicId)
    expect(await dmApi.conversations()).toHaveLength(1)
  })

  it('与自己发起被拒：400 / DM_SELF_CONVERSATION', async () => {
    await expect(dmApi.create(MOCK_SELF_PUBLIC_ID)).rejects.toMatchObject({
      status: 400,
      code: 'DM_SELF_CONVERSATION',
    })
  })

  it('发送消息：原文入库、消息数累加、摘要取最后一条、未读不动别人的', async () => {
    const conversation = await dmApi.create('01PEER00000000000000000001')
    const sent = await dmApi.send(conversation.publicId, ' 你好\n世界 ')
    expect(sent).toMatchObject({ content: ' 你好\n世界 ', senderPublicId: MOCK_SELF_PUBLIC_ID })
    const [summary] = await dmApi.conversations()
    expect(summary).toMatchObject({ messageCount: 1, unreadCount: 0, lastMessagePreview: ' 你好\n世界 ' })
    expect(summary.lastMessageAt).toBe(sent.createdAt)
  })

  it('消息分页最新在前，游标往后取更早的一页', async () => {
    const conversation = await dmApi.create('01PEER00000000000000000001')
    const sent: string[] = []
    for (let i = 1; i <= 25; i += 1) {
      sent.push((await dmApi.send(conversation.publicId, `第 ${i} 条`)).publicId)
    }

    const first = await dmApi.messages(conversation.publicId)
    expect(first.items).toHaveLength(20)
    expect(first.items[0].content).toBe('第 25 条')
    expect(first.hasMore).toBe(true)

    const second = await dmApi.messages(conversation.publicId, first.nextCursor)
    expect(second.items.map((item) => item.content)).toEqual(['第 5 条', '第 4 条', '第 3 条', '第 2 条', '第 1 条'])
    expect(second.nextCursor).toBeNull()
    expect(second.hasMore).toBe(false)
    expect(new Set([...first.items, ...second.items].map((item) => item.publicId)).size).toBe(sent.length)
  })

  it('空正文与超长正文都拒绝，且不写进消息列表', async () => {
    const conversation = await dmApi.create('01PEER00000000000000000001')
    await expect(dmApi.send(conversation.publicId, '   ')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    })
    await expect(dmApi.send(conversation.publicId, '😀'.repeat(2001))).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    })
    expect((await dmApi.messages(conversation.publicId)).items).toEqual([])
  })

  it('emoji 按码点计数：2000 个接受，2001 个拒绝', async () => {
    const conversation = await dmApi.create('01PEER00000000000000000001')
    const accepted = await dmApi.send(conversation.publicId, '😀'.repeat(2000))
    expect(Array.from(accepted.content)).toHaveLength(2000)
  })

  it('未知会话读取、发送、标记已读都是 404 / DM_CONVERSATION_NOT_FOUND', async () => {
    const missing = 'mock-conv-does-not-exist'
    for (const run of [
      () => dmApi.messages(missing),
      () => dmApi.send(missing, '你好'),
      () => dmApi.markRead(missing),
    ]) {
      await expect(run()).rejects.toMatchObject({ status: 404, code: 'DM_CONVERSATION_NOT_FOUND' })
    }
  })

  it('标记已读返回清零后的摘要，未读总数按会话累加', async () => {
    const conversation = await dmApi.create('01PEER00000000000000000001')
    await dmApi.send(conversation.publicId, '你好')
    expect((await dmApi.markRead(conversation.publicId)).unreadCount).toBe(0)
    expect(await dmApi.unreadCount()).toBe(0)
    await dmApi.create('01PEER00000000000000000002')
    expect(await dmApi.unreadCount()).toBe(0)
  })

  it('Mock 没有后端可连：订阅返回可调用的取消函数，且不产生副作用', () => {
    let called = 0
    const stop = dmApi.stream('mock-conv-1', { onMessage: () => { called += 1 } })
    expect(typeof stop).toBe('function')
    expect(() => stop()).not.toThrow()
    expect(called).toBe(0)
  })
})
