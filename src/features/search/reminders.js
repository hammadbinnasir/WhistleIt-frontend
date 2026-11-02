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
      this.items.push({ id: crypto.randomUUID(), fired: false, ...reminder })
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
      const reminder = this.items.find((i) => i.id === id)
      if (reminder) this.deletedItems.unshift({ ...reminder, deletedAt: new Date().toISOString() })
      this.items = this.items.filter((i) => i.id !== id)
      this.persist()
      this.persistDeleted()
    },
    // Call once from the app shell (App.vue onMounted)
    startWatcher() {
      if (this.timer) return
      if ('Notification' in window && Notification.permission === 'default')
        Notification.requestPermission()
      const tick = () => {
        const ui = useUiStore()
        const now = Date.now()
        this.items.forEach((r) => {
          if (!r.fired && new Date(r.remindAt).getTime() <= now) {
            r.fired = true
            const title = r.title || `Reminder: ${r.conversationName}`
            ui.toast(title, r.text)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(title, { body: r.text })
            }
            this.persist()
          }
        })
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
