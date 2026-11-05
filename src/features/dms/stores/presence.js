// import { defineStore } from 'pinia'
// import { ref } from 'vue'
// import { dmApi } from '@/features/dms/dmApi'

// export const STATES = {
//   online: 'Online',
//   away: 'Away',
//   offline: 'Offline',
// }

// function errorMessage(error) {
//   return error instanceof Error ? error.message : String(error)
// }

// export const usePresenceStore = defineStore('presence', () => {
//   const presenceById = ref({})
//   const loading = ref(false)
//   const error = ref('')
//   let initialization

//   async function init() {
//     if (initialization) return initialization

//     loading.value = true
//     error.value = ''
//     initialization = dmApi
//       .presence()
//       .then((presence) => {
//         presenceById.value = presence
//       })
//       .catch((cause) => {
//         error.value = errorMessage(cause)
//       })
//       .finally(() => {
//         loading.value = false
//         initialization = null
//       })

//     return initialization
//   }

//   function stateOf(userId) {
//     return presenceById.value[userId]?.state ?? 'offline'
//   }

//   function customOf(userId) {
//     return presenceById.value[userId]?.status ?? { emoji: '', text: '' }
//   }

//   function labelOf(userId) {
//     const state = STATES[stateOf(userId)]
//     const { emoji, text } = customOf(userId)
//     return [state, [emoji, text].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
//   }

//   function setMyState(state) {
//     if (!Object.hasOwn(STATES, state)) return
//     const current = presenceById.value[dmApi.meId()] ?? { status: { emoji: '', text: '' } }
//     presenceById.value[dmApi.meId()] = { ...current, state }
//   }

//   function setMyStatus(emoji, text) {
//     const id = dmApi.meId()
//     const current = presenceById.value[id] ?? { state: 'online' }
//     presenceById.value[id] = {
//       ...current,
//       status: { emoji: emoji.trim(), text: text.trim() },
//     }
//   }

//   function clearMyStatus() {
//     setMyStatus('', '')
//   }

//   return {
//     presenceById,
//     loading,
//     error,
//     init,
//     stateOf,
//     customOf,
//     labelOf,
//     setMyState,
//     setMyStatus,
//     clearMyStatus,
//   }
// })





import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'

export const STATES = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error?.message ?? error)
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
    initialization = dmApi
      .presence()
      .then((presence) => {
        // API ka data lo, lekin user ne jo apna status/state set kiya wo na mite
        const mine = presenceById.value[dmApi.meId()]
        presenceById.value = mine ? { ...presence, [dmApi.meId()]: mine } : presence
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
    const known = presenceById.value[userId]?.state
    if (known) return known
    return userId && userId === dmApi.meId() ? 'online' : 'offline'
  }

  function customOf(userId) {
    return presenceById.value[userId]?.status ?? { emoji: '', text: '' }
  }

  function labelOf(userId) {
    const state = STATES[stateOf(userId)]
    const { emoji, text } = customOf(userId)
    return [state, [emoji, text].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
  }

  function setMyState(state) {
    if (!Object.hasOwn(STATES, state)) return
    const current = presenceById.value[dmApi.meId()] ?? { status: { emoji: '', text: '' } }
    presenceById.value[dmApi.meId()] = { ...current, state }
  }

  function setMyStatus(emoji, text) {
    const id = dmApi.meId()
    const current = presenceById.value[id] ?? { state: 'online' }
    presenceById.value[id] = {
      ...current,
      status: { emoji: emoji.trim(), text: text.trim() },
    }
  }

  function clearMyStatus() {
    setMyStatus('', '')
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
