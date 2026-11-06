import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActivityStore } from './activity'
import { useDmStore } from '@/features/dms/stores/dms'
import { setupDmsTestState } from '@/features/dms/test-utils'

describe('activity store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setupDmsTestState()
  })

  it('initializes without an unavailable notifications endpoint', async () => {
    const activity = useActivityStore()
    await activity.init()

    expect(activity.loaded).toBe(true)
    expect(activity.loading).toBe(false)
    expect(activity.error).toBe('')
    expect(activity.sorted).toEqual([])

    activity.addActivity({ title: 'Update', body: 'Activity item' })
    expect(activity.unreadCount).toBe(1)
    activity.markAllRead()
    expect(activity.unreadCount).toBe(0)
  })

  it('adds a mention activity when a DM message mentions someone', async () => {
    const activity = useActivityStore()
    const dms = useDmStore()
    await Promise.all([activity.init(), dms.init()])

    const conversation = await dms.startDm('u2')
    const message = dms.sendMessage(conversation.id, { content: '@someone hello' })

    expect(message.text).toBe('@someone hello')
    expect(activity.sorted[0]).toMatchObject({
      conversationId: conversation.id,
      type: 'mention',
      body: '@someone hello',
      read: false,
    })
  })
})
