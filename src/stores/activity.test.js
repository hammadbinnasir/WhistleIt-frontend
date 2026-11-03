import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActivityStore } from './activity'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'

describe('activity store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
  })

  it('loads notifications and supports read filters and mark-all-read', async () => {
    const activity = useActivityStore()
    await activity.init()

    expect(activity.sorted.length).toBeGreaterThan(0)
    expect(activity.unreadCount).toBe(2)

    const unread = activity.sorted.find((item) => !item.read)
    activity.setRead(unread.id, true)
    expect(activity.unreadCount).toBe(1)

    activity.markAllRead()
    expect(activity.unreadCount).toBe(0)
  })

  it('does not create activity for a DM message without a mention', async () => {
    const activity = useActivityStore()
    const dms = useDmStore()
    await Promise.all([activity.init(), dms.init()])
    const originalCount = activity.sorted.length

    const message = dms.sendMessage('c1', { content: 'New DM message' })

    expect(message.text).toBe('New DM message')
    expect(activity.sorted).toHaveLength(originalCount)
  })

  it('records a mention activity when a DM message mentions the current user', async () => {
    const activity = useActivityStore()
    const dms = useDmStore()
    await Promise.all([activity.init(), dms.init()])

    const text = `Hello @${dms.usersById[dms.meId].name}`
    const message = dms.sendMessage('c1', { content: text })

    expect(message.text).toBe(text)
    expect(activity.sorted[0]).toMatchObject({
      type: 'mention',
      conversationId: expect.any(String),
      conversationType: 'dm',
      body: text,
      read: false,
    })
  })
})
