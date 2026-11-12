import { defineStore } from 'pinia'
import { useUiStore } from '@/stores/ui'
import { createReminder, deleteReminder, listReminders } from './remindersApi'

const DELETED_KEY = 'whistleit:deleted-reminders'
const PENDING_KEY = 'whistleit:pending-reminders'
function loadStoredReminders(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch (error) {
    console.error(`Unable to load reminders from browser storage (${key}):`, error)
    return []
  }
}
const loadDeleted = () => {
  return loadStoredReminders(DELETED_KEY)
}

export const useRemindersStore = defineStore('reminders', {
  state: () => ({
    items: [],
    deletedItems: loadDeleted(),
    pendingItems: loadStoredReminders(PENDING_KEY),
    fetchRequestId: 0,
    timer: null,
    loading: false,
  }),
  getters: {
    sorted: (s) => [...s.items].sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt)),
    dueItems: (s) =>
      s.deletedItems.filter(
        (reminder) => reminder.fired && reminder.firedAt && !reminder.dismissed,
      ),
  },
  actions: {
    async fetch() {
      const requestId = ++this.fetchRequestId
      this.loading = true
      try {
        const processedIds = new Set(this.deletedItems.map((reminder) => String(reminder.id)))
        const reminders = (await listReminders()).filter(
          (reminder) => !processedIds.has(String(reminder.id)),
        )
        if (requestId !== this.fetchRequestId) return

        const serverIds = new Set(reminders.map((reminder) => String(reminder.id)))
        this.pendingItems = this.pendingItems.filter(
          (reminder) =>
            !serverIds.has(String(reminder.id)) && !processedIds.has(String(reminder.id)),
        )
        this.persistPending()
        this.items = [...reminders, ...this.pendingItems]
        this.checkDueReminders()
      } finally {
        if (requestId === this.fetchRequestId) this.loading = false
      }
    },
    persistDeleted() {
      try {
        localStorage.setItem(DELETED_KEY, JSON.stringify(this.deletedItems))
      } catch (error) {
        console.error('Unable to save deleted reminders:', error)
      }
    },
    persistPending() {
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(this.pendingItems))
      } catch (error) {
        console.error('Unable to save pending reminders:', error)
      }
    },
    // reminder = { conversationId, conversationName, conversationType: 'channel'|'dm', messageId, text, remindAt }
    async add(reminder) {
      const created = await createReminder(reminder)
      if (created) {
        const id = String(created.id)
        this.pendingItems = [...this.pendingItems.filter((item) => String(item.id) !== id), created]
        this.persistPending()
        this.items = [...this.items.filter((item) => String(item.id) !== id), created]
        return created
      }

      await this.fetch()
      const saved = this.items.find(
        (item) =>
          String(item.messageId) === String(reminder.messageId) &&
          String(item.remindAt) === String(reminder.remindAt),
      )
      if (!saved) throw new Error('The server did not return the created reminder.')
      return saved
    },
    update(id, patch) {
      const reminder = this.items.find((item) => String(item.id) === String(id))
      if (reminder) Object.assign(reminder, patch, { fired: false })
    },
    async remove(id) {
      const reminder = this.items.find((item) => String(item.id) === String(id))
      if (reminder) await deleteReminder(id)

      const deletedAt = new Date().toISOString()
      if (reminder) {
        this.deletedItems.unshift({
          ...reminder,
          deletedAt,
          dismissed: true,
          hideFromChat: true,
        })
      } else {
        const firedReminder = this.deletedItems.find(
          (item) => String(item.id) === String(id) && item.firedAt,
        )
        if (firedReminder) {
          firedReminder.deletedAt = deletedAt
          firedReminder.dismissed = true
        }
      }
      this.items = this.items.filter((item) => String(item.id) !== String(id))
      this.pendingItems = this.pendingItems.filter((item) => String(item.id) !== String(id))
      this.persistPending()
      this.persistDeleted()
    },
    dismissDue(id) {
      const reminder = this.deletedItems.find(
        (item) => item.id === id && item.fired && item.firedAt,
      )
      if (!reminder) return
      reminder.dismissed = true
      reminder.hideFromChat = true
      this.persistDeleted()
    },
    async snooze(id, { remindAt = new Date(Date.now() + 5 * 60_000).toISOString(), title } = {}) {
      const reminderIndex = this.deletedItems.findIndex(
        (item) => item.id === id && item.fired && item.firedAt && !item.dismissed,
      )
      if (reminderIndex === -1) return
      const reminder = this.deletedItems[reminderIndex]
      const scheduledReminder = { ...reminder }
      delete scheduledReminder.id
      delete scheduledReminder.deletedAt
      delete scheduledReminder.firedAt
      delete scheduledReminder.dismissed
      delete scheduledReminder.hideFromChat
      delete scheduledReminder.fired
      await this.add({
        ...scheduledReminder,
        ...(title !== undefined ? { title } : {}),
        remindAt,
      })
      this.deletedItems.splice(reminderIndex, 1)
      this.persistDeleted()
    },
    checkDueReminders() {
      const now = Date.now()
      const dueReminders = this.items.filter(
        (reminder) => new Date(reminder.remindAt).getTime() <= now,
      )
      if (!dueReminders.length) return

      const dueIds = new Set(dueReminders.map((reminder) => reminder.id))
      this.items = this.items.filter((reminder) => !dueIds.has(reminder.id))
      this.pendingItems = this.pendingItems.filter((reminder) => !dueIds.has(reminder.id))
      this.persistPending()
      const ui = useUiStore()
      for (const reminder of dueReminders) {
        const firedAt = new Date(now).toISOString()
        if (!reminder.fired) {
          const title = reminder.title || `Reminder: ${reminder.conversationName}`
          ui.toast(title, reminder.text)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: reminder.text })
          }
        }

        const dueReminder = {
          ...reminder,
          fired: true,
          firedAt: reminder.firedAt || firedAt,
          deletedAt: firedAt,
          dismissed: false,
        }
        const existingIndex = this.deletedItems.findIndex((item) => item.id === reminder.id)
        if (existingIndex === -1) this.deletedItems.unshift(dueReminder)
        else this.deletedItems[existingIndex] = dueReminder
      }

      this.persistDeleted()
    },
    // Call once from the app shell (App.vue onMounted)
    startWatcher() {
      if (this.timer) return
      if ('Notification' in window && Notification.permission === 'default')
        Notification.requestPermission()
      const tick = () => {
        this.checkDueReminders()
        if (!document.hidden && !this.loading) {
          void this.fetch().catch((error) => {
            console.error('Unable to refresh reminders:', error)
          })
        }
      }
      tick()
      this.timer = setInterval(tick, 15000)
    },
    stopWatcher() {
      clearInterval(this.timer)
      this.timer = null
    },
  },
})
