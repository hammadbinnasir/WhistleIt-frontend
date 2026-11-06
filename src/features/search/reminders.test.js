import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from './reminders'

describe('reminders store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('moves due reminders out of the active list and makes them available in chat', () => {
    const store = useRemindersStore()
    store.add({
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Follow up with the team',
      remindAt: new Date(Date.now() - 1000).toISOString(),
    })

    store.checkDueReminders()

    expect(store.items).toHaveLength(0)
    expect(store.deletedItems).toHaveLength(1)
    expect(store.dueItems[0]).toMatchObject({
      fired: true,
      dismissed: false,
      text: 'Follow up with the team',
    })
  })

  it('checks reminders immediately when the watcher starts', () => {
    const store = useRemindersStore()
    store.items.push({
      id: 'overdue-1',
      fired: false,
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Follow up with the team',
      remindAt: new Date(Date.now() - 1000).toISOString(),
    })

    store.startWatcher()

    expect(store.items).toHaveLength(0)
    expect(store.dueItems).toHaveLength(1)
    store.stopWatcher()
  })

  it('keeps due reminders available after reloading the store', () => {
    const store = useRemindersStore()
    store.add({
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Still here after refresh',
      remindAt: new Date(Date.now() - 1000).toISOString(),
    })
    store.checkDueReminders()

    setActivePinia(createPinia())
    const reloadedStore = useRemindersStore()

    expect(reloadedStore.items).toHaveLength(0)
    expect(reloadedStore.dueItems).toHaveLength(1)
    expect(reloadedStore.dueItems[0].text).toBe('Still here after refresh')
  })

  it('snoozes a due reminder back into the active list for five minutes', () => {
    const store = useRemindersStore()
    store.deletedItems.push({
      id: 'due-1',
      fired: true,
      dismissed: false,
      conversationId: 'general',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Follow up with the team',
      remindAt: new Date(Date.now() - 1000).toISOString(),
      firedAt: new Date().toISOString(),
    })

    store.snooze('due-1')

    expect(store.dueItems).toHaveLength(0)
    expect(store.items).toHaveLength(1)
    expect(store.items[0].fired).toBe(false)
    expect(new Date(store.items[0].remindAt).getTime()).toBeGreaterThanOrEqual(
      Date.now() + 5 * 60_000 - 100,
    )
  })
})
