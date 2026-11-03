import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from '@/features/dms/stores/dms'

export const STATES = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
}

const MY_PRESENCE_KEY = 'whistleit:my-presence'
const EMPTY_STATUS = { emoji: '', text: '' }

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function readMyPresence() {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(MY_PRESENCE_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return null

    const result = {}
    if (Object.hasOwn(STATES, stored.state)) result.state = stored.state
    if (
      stored.status &&
      typeof stored.status.emoji === 'string' &&
      typeof stored.status.text === 'string'
    ) {
      result.status = stored.status
    }
    return Object.keys(result).length ? result : null
  } catch (cause) {
    console.warn('Unable to load saved presence', cause)
    return null
  }
}

export const usePresenceStore = defineStore('presence', () => {
  const presenceById = ref({})
  const loading = ref(false)
  const error = ref('')
  let initialization

  async function init() {
    if (initialization) return initialization

    loading.value = true
    error.value = ''
    initialization = useDmStore()
      .init()
      .then(() => {
        const dms = useDmStore()
        const id = dmApi.meId()
        const stored = readMyPresence()
        const current = presenceById.value[id]
        const myPresence = {
          state: 'online',
          ...stored,
          ...current,
          status: { ...stored?.status, ...current?.status },
        }
        presenceById.value = Object.fromEntries(
          dms.users.map((user) => [user.id, { state: 'offline' }]),
        )
        if (id) presenceById.value[id] = myPresence
      })
      .catch((cause) => {
        error.value = errorMessage(cause)
      })
      .finally(() => {
        loading.value = false
        initialization = null
      })

    return initialization
  }

  function stateOf(userId) {
    return presenceById.value[userId]?.state ?? 'offline'
  }

  function customOf(userId) {
    const status = presenceById.value[userId]?.status
    if (
      status?.expiresAt &&
      (!Number.isFinite(Date.parse(status.expiresAt)) || Date.parse(status.expiresAt) <= Date.now())
    ) {
      return { ...EMPTY_STATUS }
    }
    return { ...EMPTY_STATUS, ...status }
  }

  function labelOf(userId) {
    return STATES[stateOf(userId)]
  }

  function setMyState(state) {
    if (!Object.hasOwn(STATES, state)) return
    const id = dmApi.meId()
    if (!id) return
    const current = presenceById.value[id] ?? { status: { emoji: '', text: '' } }
    presenceById.value[id] = { ...current, state }
    persistMyPresence()
  }

  function setMyStatus(emoji, text, clearAfter = null) {
    const id = dmApi.meId()
    if (!id) return
    const current = presenceById.value[id] ?? { state: 'online' }
    const expiresAt =
      clearAfter === '30m'
        ? new Date(Date.now() + 30 * 60_000).toISOString()
        : clearAfter === '1h'
          ? new Date(Date.now() + 60 * 60_000).toISOString()
          : clearAfter === 'today'
            ? (() => {
                const endOfToday = new Date()
                endOfToday.setHours(24, 0, 0, 0)
                return endOfToday.toISOString()
              })()
            : null

    presenceById.value[id] = {
      ...current,
      status: { emoji: emoji.trim(), text: text.trim(), expiresAt },
    }
    persistMyPresence()
  }

  function clearMyStatus() {
    setMyStatus('', '')
  }

  function persistMyPresence() {
    const id = dmApi.meId()
    if (!id) return
    const current = presenceById.value[id] ?? {}
    try {
      globalThis.localStorage.setItem(
        MY_PRESENCE_KEY,
        JSON.stringify({ state: current.state, status: current.status ?? EMPTY_STATUS }),
      )
    } catch (cause) {
      console.warn('Unable to save presence', cause)
    }
  }

  return {
    presenceById,
    loading,
    error,
    init,
    stateOf,
    customOf,
    labelOf,
    setMyState,
    setMyStatus,
    clearMyStatus,
  }
})
