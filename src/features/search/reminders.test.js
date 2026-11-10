import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from './reminders'

const api = vi.hoisted(() => ({
  createReminder: vi.fn(),
  deleteReminder: vi.fn(),
  listReminders: vi.fn(),
}))
vi.mock('./remindersApi', () => api)

describe('reminders store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    api.createReminder.mockReset()
    api.deleteReminder.mockReset().mockResolvedValue()
    api.listReminders.mockReset().mockResolvedValue([])
    let id = 0
    api.createReminder.mockImplementation(async (reminder) => ({
      ...reminder,
      id: `server-${++id}`,
      fired: false,
    }))
  })

  it('moves due reminders out of the active list and makes them available in chat', async () => {
    const store = useRemindersStore()
    await store.add({
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

  it('keeps due reminders available after reloading the store', async () => {
    const store = useRemindersStore()
    await store.add({
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

  it('snoozes a due reminder back into the active list for five minutes', async () => {
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

    await store.snooze('due-1')

    expect(store.dueItems).toHaveLength(0)
    expect(store.items).toHaveLength(1)
    expect(store.items[0].fired).toBe(false)
    expect(new Date(store.items[0].remindAt).getTime()).toBeGreaterThanOrEqual(
      Date.now() + 5 * 60_000 - 100,
    )
  })

  it('dismisses an already-fired reminder locally without deleting it again from the API', async () => {
    const store = useRemindersStore()
    store.deletedItems.push({
      id: 'already-fired',
      fired: true,
      firedAt: new Date().toISOString(),
      dismissed: false,
      conversationId: 'general',
      text: 'Reminder has fired',
    })

    store.dismissDue('already-fired')

    expect(store.deletedItems[0]).toMatchObject({
      id: 'already-fired',
      dismissed: true,
      hideFromChat: true,
    })
    expect(api.deleteReminder).not.toHaveBeenCalled()
  })

  it('deletes an active reminder through the API before removing it locally', async () => {
    const store = useRemindersStore()
    await store.add({
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'active-message',
      text: 'Active reminder',
      remindAt: new Date(Date.now() + 60_000).toISOString(),
    })
    const id = store.items[0].id

    await store.remove(id)

    expect(api.deleteReminder).toHaveBeenCalledWith(id)
    expect(store.items).toHaveLength(0)
  })
})
