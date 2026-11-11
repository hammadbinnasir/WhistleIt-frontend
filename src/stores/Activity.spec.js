import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActivityStore } from './activity'
import { useDmStore } from '@/features/dms/stores/dms'
import { dmApi } from '@/features/dms/dmApi'

describe('activity store', () => {
  const originalNotifications = dmApi.notifications

  function mockNotifications(implementation) {
    dmApi.notifications = vi.fn(implementation)
  }

  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    if (originalNotifications) dmApi.notifications = originalNotifications
    else delete dmApi.notifications
    vi.useRealTimers()
  })

  it('loads notifications and supports read filters and mark-all-read', async () => {
    mockNotifications(async () => [
      { id: 'n1', type: 'mention', read: false, createdAt: '2026-11-06T10:00:00.000Z' },
      { id: 'n2', type: 'message', read: false, createdAt: '2026-11-06T09:00:00.000Z' },
      { id: 'n3', type: 'message', read: true, createdAt: '2026-11-06T08:00:00.000Z' },
    ])
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

  it('sorts notifications that have no createdAt instead of throwing', async () => {
    mockNotifications(async () => [
      { id: 'no-date', type: 'mention' },
      { id: 'dated', type: 'mention', createdAt: '2026-01-01T00:00:00.000Z' },
      null,
    ])
    const activity = useActivityStore()
    await activity.init()

    expect(activity.sorted.map((item) => item.id)).toEqual(['dated', 'no-date'])
    expect(activity.loading).toBe(false)
  })

  it('loads without an error when dmApi has no notifications function', async () => {
    delete dmApi.notifications
    const activity = useActivityStore()
    await activity.init()

    expect(activity.loaded).toBe(true)
    expect(activity.error).toBe('')
    expect(activity.items).toEqual([])
  })

  it('stops loading with an error when notifications never respond', async () => {
    vi.useFakeTimers()
    mockNotifications(() => new Promise(() => {}))
    const activity = useActivityStore()
    const pending = activity.init()

    expect(activity.loading).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    await pending

    expect(activity.loading).toBe(false)
    expect(activity.error).toContain('too long')
  })
})