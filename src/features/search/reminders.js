import { defineStore } from 'pinia'
import { useUiStore } from '@/stores/ui'

const KEY = 'whistleit:reminders'
const DELETED_KEY = 'whistleit:deleted-reminders'
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch (error) {
    console.error('Unable to load reminders from browser storage:', error)
    return []
  }
}

const loadDeleted = () => {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY)) || []
  } catch (error) {
    console.error('Unable to load deleted reminders from browser storage:', error)
    return []
  }
}

// Mock-first store. When backend endpoints are live, swap the bodies of
// add/update/remove for calls to lib/api (reminders endpoints) and keep the same shape.
export const useRemindersStore = defineStore('reminders', {
  state: () => ({ items: load(), deletedItems: loadDeleted(), timer: null }),
  getters: {
    sorted: (s) => [...s.items].sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt)),
    dueItems: (s) =>
      s.deletedItems.filter((reminder) => reminder.fired && reminder.firedAt && !reminder.dismissed),
  },
  actions: {
    persist() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.items))
      } catch (error) {
        console.error('Unable to save reminders to browser storage:', error)
      }
    },
    persistDeleted() {
      try {
        localStorage.setItem(DELETED_KEY, JSON.stringify(this.deletedItems))
      } catch (error) {
        console.error('Unable to save deleted reminders:', error)
      }
    },
    // reminder = { conversationId, conversationName, conversationType: 'channel'|'dm', messageId, text, remindAt }
    add(reminder) {
      this.items.push({
        ...reminder,
        id: crypto.randomUUID(),
        fired: false,
        conversationId: String(reminder.conversationId ?? 'general'),
        conversationType: reminder.conversationType === 'dm' ? 'dm' : 'channel',
      })
      this.persist()
    },
    update(id, patch) {
      const r = this.items.find((i) => i.id === id)
      if (r) {
        Object.assign(r, patch, { fired: false })
        this.persist()
      }
    },
    remove(id) {
      const deletedAt = new Date().toISOString()
      const reminder = this.items.find((item) => item.id === id)
      if (reminder) {
        this.deletedItems.unshift({ ...reminder, deletedAt, dismissed: true })
      } else {
        const firedReminder = this.deletedItems.find((item) => item.id === id && item.firedAt)
        if (firedReminder) {
          firedReminder.deletedAt = deletedAt
          firedReminder.dismissed = true
        }
      }
      this.items = this.items.filter((i) => i.id !== id)
      this.persist()
      this.persistDeleted()
    },
    dismissDue(id) {
      const reminder = this.deletedItems.find((item) => item.id === id && item.fired && item.firedAt)
      if (!reminder) return
      reminder.dismissed = true
      this.persistDeleted()
    },
    snooze(id, duration = 5 * 60_000) {
      const reminderIndex = this.deletedItems.findIndex(
        (item) => item.id === id && item.fired && item.firedAt && !item.dismissed,
      )
      if (reminderIndex === -1) return
      const [reminder] = this.deletedItems.splice(reminderIndex, 1)
      const scheduledReminder = { ...reminder }
      delete scheduledReminder.deletedAt
      delete scheduledReminder.firedAt
      delete scheduledReminder.dismissed
      this.items.push({
        ...scheduledReminder,
        fired: false,
        remindAt: new Date(Date.now() + duration).toISOString(),
      })
      this.persist()
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

      this.persist()
      this.persistDeleted()
    },
    // Call once from the app shell (App.vue onMounted)
    startWatcher() {
      if (this.timer) return
      if ('Notification' in window && Notification.permission === 'default')
        Notification.requestPermission()
      const tick = () => {
        this.checkDueReminders()
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
