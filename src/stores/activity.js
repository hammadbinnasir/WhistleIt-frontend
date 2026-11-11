import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { dmApi } from '@/features/dms/dmApi'

const WORKFLOWS_KEY = 'whistleit:activity-workflows'
// Mentions / activity items (read / unread) reload ke baad bhi
const ITEMS_KEY = 'whistleit:activity-items'
const MAX_STORED_ITEMS = 200
const SAVE_DELAY_MS = 250
const NOTIFICATIONS_TIMEOUT_MS = 10_000
let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${generatedId++}`
}

function toTime(value) {
  const time = new Date(value ?? 0).getTime()
  return Number.isNaN(time) ? 0 : time
}

function normalizeNotification(item) {
  if (!item || typeof item !== 'object') return null
  return {
    ...item,
    id: item.id ?? createId(),
    read: Boolean(item.read),
    createdAt: item.createdAt || item.created_at || new Date(0).toISOString(),
  }
}

// Never let a hanging request keep the "Loading activity…" banner on screen forever.
function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Activity is taking too long to load. Please retry.')),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// The DM API may not expose a notifications endpoint (or may name it differently).
// Activity still works without it: mentions are recorded locally as messages are sent.
function fetchNotifications() {
  const fetcher = ['notifications', 'getNotifications', 'fetchNotifications', 'listNotifications']
    .map((name) => dmApi?.[name])
    .find((candidate) => typeof candidate === 'function')
  if (!fetcher) return Promise.resolve([])
  return Promise.resolve().then(() => fetcher.call(dmApi))
}

function loadItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]')
    return Array.isArray(stored) ? stored.map(normalizeNotification).filter(Boolean) : []
  } catch {
    return []
  }
}

function loadWorkflows() {
  try {
    const stored = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((item) => item && typeof item === 'object') : []
  } catch (error) {
    console.error('Unable to load workflows from browser storage:', error)
    return []
  }
}

export const useActivityStore = defineStore('activity', () => {
  const items = ref(loadItems())
  // Har tabdeeli par foran likhne ki jagah thodi der baad ek dafa (main thread free rahe)
  let saveTimer = null
  watch(
    items,
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(ITEMS_KEY, JSON.stringify(items.value.slice(0, MAX_STORED_ITEMS)))
        } catch {
          /* storage full / blocked: memory mein to hai */
        }
      }, SAVE_DELAY_MS)
    },
    { deep: true },
  )
  const workflows = ref(loadWorkflows())
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  // createdAt may be missing or not a string; localeCompare on undefined used to throw
  // inside this computed and break every component that reads it.
  const sorted = computed(() =>
    [...items.value].filter(Boolean).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
  )
  const unreadCount = computed(() => items.value.filter((item) => item && !item.read).length)

  let initialization = null

  function init() {
    if (initialization) return initialization
    if (loaded.value) return Promise.resolve()

    loading.value = true
    error.value = ''
    initialization = withTimeout(fetchNotifications(), NOTIFICATIONS_TIMEOUT_MS)
      .then((notifications) => {
        const normalized = (Array.isArray(notifications) ? notifications : [])
          .map(normalizeNotification)
          .filter(Boolean)
        const existing = new Map(items.value.map((item) => [item.id, item]))
        const incomingIds = new Set(normalized.map((notification) => notification.id))
        items.value = [
          ...normalized.map((item) => existing.get(item.id) || item),
          ...[...existing.values()].filter((item) => !incomingIds.has(item.id)),
        ]
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
    if (initialization) return initialization
    loaded.value = false
    return init()
  }

  function setRead(id, read) {
    const item = items.value.find((activity) => activity?.id === id)
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








// import { computed, ref } from 'vue'
// import { defineStore } from 'pinia'
// import { dmApi } from '@/features/dms/dmApi'

// const WORKFLOWS_KEY = 'whistleit:activity-workflows'
// const NOTIFICATIONS_TIMEOUT_MS = 10_000
// let generatedId = 0

// function createId() {
//   return globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${generatedId++}`
// }

// function toTime(value) {
//   const time = new Date(value ?? 0).getTime()
//   return Number.isNaN(time) ? 0 : time
// }

// function normalizeNotification(item) {
//   if (!item || typeof item !== 'object') return null
//   return {
//     ...item,
//     id: item.id ?? createId(),
//     read: Boolean(item.read),
//     createdAt: item.createdAt || item.created_at || new Date(0).toISOString(),
//   }
// }

// // Never let a hanging request keep the "Loading activity…" banner on screen forever.
// function withTimeout(promise, ms) {
//   let timer
//   const timeout = new Promise((_, reject) => {
//     timer = setTimeout(
//       () => reject(new Error('Activity is taking too long to load. Please retry.')),
//       ms,
//     )
//   })
//   return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
// }

// // The DM API may not expose a notifications endpoint (or may name it differently).
// // Activity still works without it: mentions are recorded locally as messages are sent.
// function fetchNotifications() {
//   const fetcher = ['notifications', 'getNotifications', 'fetchNotifications', 'listNotifications']
//     .map((name) => dmApi?.[name])
//     .find((candidate) => typeof candidate === 'function')
//   if (!fetcher) return Promise.resolve([])
//   return Promise.resolve().then(() => fetcher.call(dmApi))
// }

// function loadWorkflows() {
//   try {
//     const stored = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]')
//     return Array.isArray(stored) ? stored.filter((item) => item && typeof item === 'object') : []
//   } catch (error) {
//     console.error('Unable to load workflows from browser storage:', error)
//     return []
//   }
// }

// export const useActivityStore = defineStore('activity', () => {
//   const items = ref([])
//   const workflows = ref(loadWorkflows())
//   const loading = ref(false)
//   const loaded = ref(false)
//   const error = ref('')

//   // createdAt may be missing or not a string; localeCompare on undefined used to throw
//   // inside this computed and break every component that reads it.
//   const sorted = computed(() =>
//     [...items.value].filter(Boolean).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
//   )
//   const unreadCount = computed(() => items.value.filter((item) => item && !item.read).length)

//   let initialization = null

//   function init() {
//     if (initialization) return initialization
//     if (loaded.value) return Promise.resolve()

//     loading.value = true
//     error.value = ''
//     initialization = withTimeout(fetchNotifications(), NOTIFICATIONS_TIMEOUT_MS)
//       .then((notifications) => {
//         const normalized = (Array.isArray(notifications) ? notifications : [])
//           .map(normalizeNotification)
//           .filter(Boolean)
//         const existing = new Map(items.value.map((item) => [item.id, item]))
//         const incomingIds = new Set(normalized.map((notification) => notification.id))
//         items.value = [
//           ...normalized.map((item) => existing.get(item.id) || item),
//           ...[...existing.values()].filter((item) => !incomingIds.has(item.id)),
//         ]
//         loaded.value = true
//       })
//       .catch((cause) => {
//         error.value = cause instanceof Error ? cause.message : String(cause)
//       })
//       .finally(() => {
//         loading.value = false
//         initialization = null
//       })

//     return initialization
//   }

//   function refresh() {
//     if (initialization) return initialization
//     loaded.value = false
//     return init()
//   }

//   function setRead(id, read) {
//     const item = items.value.find((activity) => activity?.id === id)
//     if (item) item.read = Boolean(read)
//   }

//   function markAllRead() {
//     items.value = items.value.map((item) => ({ ...item, read: true }))
//   }

//   function addActivity(activity) {
//     items.value.unshift({
//       id: createId(),
//       type: 'message',
//       read: false,
//       createdAt: new Date().toISOString(),
//       ...activity,
//     })
//   }

//   function recordMessageMentions({ text, conversationId, conversationName, conversationType }) {
//     const mentionedUsers = [
//       ...new Set(
//         [...String(text || '').matchAll(/(?:^|\s)@([\p{L}\p{N}_.-]+)/gu)].map((match) => match[1]),
//       ),
//     ]
//     if (!mentionedUsers.length) return

//     addActivity({
//       type: 'mention',
//       conversationId: String(conversationId),
//       conversationName,
//       conversationType,
//       title: `You mentioned ${mentionedUsers.map((user) => `@${user}`).join(', ')}`,
//       body: text,
//     })
//   }

//   function persistWorkflows() {
//     try {
//       localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows.value))
//     } catch (error) {
//       console.error('Unable to save workflows to browser storage:', error)
//     }
//   }

//   function createWorkflow(workflow) {
//     const created = {
//       id: createId(),
//       enabled: true,
//       createdAt: new Date().toISOString(),
//       ...workflow,
//     }
//     workflows.value.unshift(created)
//     persistWorkflows()
//     return created
//   }

//   function toggleWorkflow(id) {
//     const workflow = workflows.value.find((item) => item.id === id)
//     if (!workflow) return
//     workflow.enabled = !workflow.enabled
//     persistWorkflows()
//   }

//   function removeWorkflow(id) {
//     workflows.value = workflows.value.filter((item) => item.id !== id)
//     persistWorkflows()
//   }

//   return {
//     items,
//     workflows,
//     loading,
//     loaded,
//     error,
//     sorted,
//     unreadCount,
//     init,
//     refresh,
//     setRead,
//     markAllRead,
//     addActivity,
//     recordMessageMentions,
//     createWorkflow,
//     toggleWorkflow,
//     removeWorkflow,
//   }
// })