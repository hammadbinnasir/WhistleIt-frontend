import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDmStore } from './dms'

describe('dms store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads conversations and users from the DMs API', async () => {
    const dms = useDmStore()

    await dms.init()

    expect(dms.error).toBe('')
    expect(dms.usersById[dms.meId]).toBeDefined()
    expect(dms.sorted).toHaveLength(7)
    expect(dms.titleOf(dms.sorted[0])).toBeTruthy()
  })

  it('opens existing conversations and starts a group conversation', async () => {
    const dms = useDmStore()
    await dms.init()

    const existing = dms.startDm('u2')
    expect(existing.id).toBe('c1')
    expect(dms.activeId).toBe('c1')

    const group = dms.startGroup(['u3', 'u4'], 'Project team')
    expect(group.type).toBe('group')
    expect(group.name).toBe('Project team')
    expect(group.members).toContain(dms.meId)
    expect(dms.activeId).toBe(group.id)
  })

  it('cancels a scheduled message without removing other conversation messages', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = dms.startDm('u2')
    const originalMessageCount = conversation.messages.length
    const scheduled = dms.sendMessage(conversation.id, {
      content: 'Later',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    })

    expect(dms.cancelScheduledMessage(conversation.id, scheduled.id)).toBe(true)
    expect(conversation.messages).toHaveLength(originalMessageCount)
    expect(dms.cancelScheduledMessage(conversation.id, 'missing-message')).toBe(false)
  })
})
