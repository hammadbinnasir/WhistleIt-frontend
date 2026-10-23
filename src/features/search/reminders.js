import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useUiStore } from '@/stores/ui'

const STORAGE_KEY = 'whistleit-reminders-v1'
let watcher = null

function loadReminders() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (error) {
    console.error('Unable to read saved reminders.', error)
  }
  return [
    {
      id: 'welcome-frontend',
      conversationId: 'frontend',
      conversationName: 'Frontend Team Cmi 2',
      conversationType: 'channel',
      messageId: 'msg-1',
      text: 'Welcome to the frontend team! The sprint plan and project files are ready to review.',
      remindAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      note: 'Review the sprint plan',
      deleted: false,
      completed: false,
    },
  ]
}

export const useRemindersStore = defineStore('reminders', () => {
  const ui = useUiStore()
  const reminders = ref(loadReminders())
  const activeReminders = computed(() => reminders.value.filter((reminder) => !reminder.deleted))
  const deletedReminders = computed(() => reminders.value.filter((reminder) => reminder.deleted))

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders.value))
    } catch (error) {
      console.error('Unable to save reminders.', error)
    }
  }

  function addReminder(message, remindAt, note = '') {
    reminders.value.unshift({
      id: globalThis.crypto?.randomUUID?.() || `reminder-${Date.now()}`,
      conversationId: message.conversationId,
      conversationName: message.conversationName,
      conversationType: message.conversationType || 'channel',
      messageId: message.messageId,
      text: message.text,
      remindAt,
      note,
      deleted: false,
      completed: false,
    })
    persist()
  }

  function updateReminder(id, changes) {
    const reminder = reminders.value.find((item) => item.id === id)
    if (!reminder) return
    Object.assign(reminder, changes)
    persist()
  }

  function removeReminder(id) {
    updateReminder(id, { deleted: true })
  }

  function restoreReminder(id) {
    updateReminder(id, { deleted: false })
  }

  function checkDueReminders() {
    const dueReminders = reminders.value.filter(
      (reminder) => !reminder.deleted && !reminder.completed && new Date(reminder.remindAt) <= new Date(),
    )
    dueReminders.forEach((reminder) => {
      reminder.completed = true
      const toastId = globalThis.crypto?.randomUUID?.() || `reminder-toast-${Date.now()}`
      ui.toasts.push({
        id: toastId,
        title: `Reminder: ${reminder.conversationName}`,
        body: reminder.note || reminder.text,
      })
      setTimeout(() => {
        ui.toasts = ui.toasts.filter((toast) => toast.id !== toastId)
      }, 6000)
    })
    if (dueReminders.length) persist()
  }

  function startWatcher() {
    if (watcher) return
    checkDueReminders()
    watcher = setInterval(checkDueReminders, 15_000)
  }

  function stopWatcher() {
    if (!watcher) return
    clearInterval(watcher)
    watcher = null
  }

  return {
    reminders,
    activeReminders,
    deletedReminders,
    addReminder,
    updateReminder,
    removeReminder,
    restoreReminder,
    startWatcher,
    stopWatcher,
  }
})
