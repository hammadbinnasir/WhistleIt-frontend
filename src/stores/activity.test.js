import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActivityStore } from './activity'
import { useDmStore } from '@/features/dms/stores/dms'

describe('activity store', () => {
  beforeEach(() => setActivePinia(createPinia()))

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

  it('adds a new activity when a demo DM message arrives', async () => {
    const activity = useActivityStore()
    const dms = useDmStore()
    await Promise.all([activity.init(), dms.init()])

    const message = dms.receiveDemo()

    expect(message.text).toBe('You have a new message.')
    expect(activity.sorted[0]).toMatchObject({
      conversationId: expect.any(String),
      body: message.text,
      read: false,
    })
  })
})
