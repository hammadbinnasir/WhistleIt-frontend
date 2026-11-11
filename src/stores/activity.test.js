import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('@/features/dms/dmApi', () => ({ dmApi: {} }))
import { useActivityStore } from './activity'

describe('activity store persistence', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
  it('keeps mentions and their read state across a reload', async () => {
    vi.useFakeTimers()
    try {
      const a = useActivityStore()
      await a.init()
      a.recordMessageMentions({ text: 'hi @Aiman', conversationId: 'c1', conversationName: 'X', conversationType: 'dm' })
      a.setRead(a.items[0].id, true)
      await vi.advanceTimersByTimeAsync(300)
      setActivePinia(createPinia())
      const b = useActivityStore()
      expect(b.items).toHaveLength(1)
      expect(b.items[0]).toMatchObject({ type: 'mention', read: true, conversationId: 'c1' })
      expect(b.unreadCount).toBe(0)
    } finally { vi.useRealTimers() }
  })
})







// import { beforeEach, describe, expect, it } from 'vitest'
// import { createPinia, setActivePinia } from 'pinia'
// import { useActivityStore } from './activity'
// import { useDmStore } from '@/features/dms/stores/dms'
// import { setupDmsTestState } from '@/features/dms/test-utils'

// describe('activity store', () => {
//   beforeEach(() => {
//     setActivePinia(createPinia())
//     setupDmsTestState()
//   })

//   it('initializes without an unavailable notifications endpoint', async () => {
//     const activity = useActivityStore()
//     await activity.init()

//     expect(activity.loaded).toBe(true)
//     expect(activity.loading).toBe(false)
//     expect(activity.error).toBe('')
//     expect(activity.sorted).toEqual([])

//     activity.addActivity({ title: 'Update', body: 'Activity item' })
//     expect(activity.unreadCount).toBe(1)
//     activity.markAllRead()
//     expect(activity.unreadCount).toBe(0)
//   })

//   it('adds a mention activity when a DM message mentions someone', async () => {
//     const activity = useActivityStore()
//     const dms = useDmStore()
//     await Promise.all([activity.init(), dms.init()])

//     const conversation = await dms.startDm('u2')
//     const message = dms.sendMessage(conversation.id, { content: '@someone hello' })

//     expect(message.text).toBe('@someone hello')
//     expect(activity.sorted[0]).toMatchObject({
//       conversationId: conversation.id,
//       type: 'mention',
//       body: '@someone hello',
//       read: false,
//     })
//   })
// })
