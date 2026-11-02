import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { dmApi } from '@/features/dms/dmApi'

const WORKFLOWS_KEY = 'whistleit:activity-workflows'
let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${generatedId++}`
}

function loadWorkflows() {
  try {
    return JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]')
  } catch (error) {
    console.error('Unable to load workflows from browser storage:', error)
    return []
  }
}

export const useActivityStore = defineStore('activity', () => {
  const items = ref([])
  const workflows = ref(loadWorkflows())
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  const sorted = computed(() =>
    [...items.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
  const unreadCount = computed(() => items.value.filter((item) => !item.read).length)

  let initialization

  function init() {
    if (initialization) return initialization
    if (loaded.value) return Promise.resolve()

    loading.value = true
    error.value = ''
    initialization = dmApi
      .notifications()
      .then((notifications) => {
        const existing = new Map(items.value.map((item) => [item.id, item]))
        items.value = notifications.map((item) => existing.get(item.id) || item)
        items.value.push(
          ...[...existing.values()].filter(
            (item) => !notifications.some((notification) => notification.id === item.id),
          ),
        )
        loaded.value = true
      })
      .catch((cause) => {
        error.value = cause instanceof Error ? cause.message : String(cause)
      })
      .finally(() => {
        loading.value = false
        initialization = null
      })

    return initialization
  }

  function refresh() {
    loaded.value = false
    return init()
  }

  function setRead(id, read) {
    const item = items.value.find((activity) => activity.id === id)
    if (item) item.read = Boolean(read)
  }

  function markAllRead() {
    items.value = items.value.map((item) => ({ ...item, read: true }))
  }

  function addActivity(activity) {
    items.value.unshift({
      id: createId(),
      type: 'message',
      read: false,
      createdAt: new Date().toISOString(),
      ...activity,
    })
  }

  function recordMessageMentions({ text, conversationId, conversationName, conversationType }) {
    const mentionedUsers = [
      ...new Set(
        [...String(text || '').matchAll(/(?:^|\s)@([\p{L}\p{N}_.-]+)/gu)].map((match) => match[1]),
      ),
    ]
    if (!mentionedUsers.length) return

    addActivity({
      type: 'mention',
      conversationId: String(conversationId),
      conversationName,
      conversationType,
      title: `You mentioned ${mentionedUsers.map((user) => `@${user}`).join(', ')}`,
      body: text,
    })
  }

  function persistWorkflows() {
    try {
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows.value))
    } catch (error) {
      console.error('Unable to save workflows to browser storage:', error)
    }
  }

  function createWorkflow(workflow) {
    const created = {
      id: createId(),
      enabled: true,
      createdAt: new Date().toISOString(),
      ...workflow,
    }
    workflows.value.unshift(created)
    persistWorkflows()
    return created
  }

  function toggleWorkflow(id) {
    const workflow = workflows.value.find((item) => item.id === id)
    if (!workflow) return
    workflow.enabled = !workflow.enabled
    persistWorkflows()
  }

  function removeWorkflow(id) {
    workflows.value = workflows.value.filter((item) => item.id !== id)
    persistWorkflows()
  }

  return {
    items,
    workflows,
    loading,
    loaded,
    error,
    sorted,
    unreadCount,
    init,
    refresh,
    setRead,
    markAllRead,
    addActivity,
    recordMessageMentions,
    createWorkflow,
    toggleWorkflow,
    removeWorkflow,
  }
})
