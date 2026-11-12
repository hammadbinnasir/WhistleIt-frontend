import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'

export const STATES = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
  dnd: 'Do not disturb',
}

// Har itne ms baad sab users ka live status dobara
const POLL_INTERVAL = 15_000
// Itne ms baad apna status server ko dobara (backend ko pata rahe ke main abhi bhi online hoon)
const HEARTBEAT_INTERVAL = 60_000
// Itni der mouse/keyboard na chale to khud "Away"
const IDLE_AFTER = 5 * 60_000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
// Itni der se status update nahi hua aur "online" likha hai: tab band ho gaya tha (offline na pahuncha)
const STALE_ONLINE_MS = 3 * 60_000

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error?.message ?? error)
}

// "online" / "active" / true -> 'online' ... (samajh na aaye to null)
function stateFrom(value) {
  if (value && typeof value === 'object') {
    return stateFrom(value.state ?? value.mode ?? value.status)
  }
  if (value === true || value === 1) return 'online'
  if (value === false || value === 0) return 'offline'
  const word = String(value ?? '').trim().toLowerCase()
  if (['online', 'active', 'available'].includes(word)) return 'online'
  if (word === 'dnd') return 'dnd'
  if (['away', 'idle', 'busy'].includes(word)) return 'away'
  if (['offline', 'inactive', 'invisible'].includes(word)) return 'offline'
  return null
}

const httpStatusOf = (error) =>
  Number(error?.status ?? error?.response?.status ?? error?.details?.status ?? 0)

export const usePresenceStore = defineStore('presence', () => {
  const teamsStore = useTeamsStore()
  const dms = useDmStore()

  const presenceById = ref({})
  const profileStatusById = ref({})
  const loading = ref(false)
  // HomeView header `presence.error` ho to status chhupa kar "Direct message" dikhata hai.
  // Members list fail hone par bhi status (GET status / default Offline) dikh sakta hai,
  // isliye wo error alag `membersError` mein rehta hai aur `error` header ko nahi rokta.
  const error = ref('')
  const membersError = ref('') // /company/{company}/members (status ke liye) ka error
  const statusError = ref('') // apna status (PUT) ka last error

  let initialization
  let pollTimer = null
  let heartbeatTimer = null
  let idleTimer = null
  let live = false
  let manualState = null // user ne khud "Away"/"Offline" chuna: activity se online na karo
  let autoAway = false
  let lastActivity = Date.now()
  let statusGetDisabled = false // GET /users/{user}/status backend par nahi mila
  let statusGetFailures = 0
  // Backend har heartbeat (PUT) par status_changed_at badalta hai? (apne PUT jawab se pata chalta hai)
  let heartbeatMovesChangedAt = false
  let lastOwn = null // { state, changedAt }

  const companyId = computed(() => teamsStore.activeWorkspaceId)
  const myId = () => dms.meId || dmApi.meId()

  // ---------- dusre users ka status ----------
  // DM wale saathiyon ka status GET /v1/users/{user}/status se (agar backend par ho)
  async function fetchPartnerStatuses() {
    if (statusGetDisabled || typeof dmApi.getUserStatus !== 'function') return {}
    const me = myId()
    const ids = [
      ...new Set(dms.conversations.flatMap((c) => c.members).filter((id) => id && id !== me)),
    ].slice(0, 50)
    if (!ids.length) return {}

    const results = await Promise.allSettled(ids.map((id) => dmApi.getUserStatus(id)))
    const found = {}
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value?.state) found[ids[i]] = result.value
    })

    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length === results.length) {
      statusGetFailures += 1
      const missingRoute = failures.some((r) => [404, 405].includes(httpStatusOf(r.reason)))
      if (missingRoute || statusGetFailures >= 3) statusGetDisabled = true
    } else {
      statusGetFailures = 0
    }
    return found
  }

  // Team members (members store) ka status: purana DM store online users yahin se dikhata tha.
  // Har poll par dobara mangwate hain taake online/offline live rahe.
  async function fromMembersStore() {
    try {
      const membersStore = useMembersStore()
      const teamId = teamsStore.activeTeamId
      if (teamId && typeof membersStore.fetchMembers === 'function') {
        await membersStore.fetchMembers(teamId)
      }
      const found = {}
      for (const member of membersStore.members ?? []) {
        if (!member || typeof member !== 'object') continue
        const user = member.user && typeof member.user === 'object' ? member.user : {}
        const id = String(user.id ?? member.user_id ?? member.id ?? '')
        const state = stateFrom(
          member.status_mode ?? user.status_mode ??
            member.status ?? member.presence ?? member.state ?? member.is_online ?? member.online ??
            user.status ?? user.presence ?? user.is_online,
        )
        if (id && state) found[id] = { state, lastSeenAt: member.last_seen_at ?? user.last_seen_at }
      }
      return found
    } catch {
      return {}
    }
  }

  // DM list (GET direct-channels, har ~16 sec) ke users ka status_mode
  function fromDmUsers() {
    const found = {}
    for (const [id, user] of Object.entries(dms.usersById ?? {})) {
      const state = stateFrom(user?.presence)
      if (state) found[id] = { state, changedAt: user.statusChangedAt }
    }
    return found
  }

  // silent: polling ke liye (loading/error nahi badalta)
  async function load({ silent = false } = {}) {
    if (initialization) return initialization

    if (!silent) {
      loading.value = true
      error.value = ''
    }
    initialization = Promise.all([
      dmApi
        .presence(companyId.value)
        .then((result) => {
          membersError.value = ''
          return result
        })
        .catch((cause) => {
          membersError.value = errorMessage(cause)
          return null
        }),
      fromMembersStore(),
      fetchPartnerStatuses().catch(() => ({})),
    ])
      .then(([fromMembers, fromTeam, fromStatus]) => {
        if (
          !fromMembers &&
          !Object.keys(fromTeam).length &&
          !Object.keys(fromStatus).length &&
          !Object.keys(fromDmUsers()).length
        )
          return
        // API ka data lo, lekin user ne jo apna status/state set kiya wo na mite
        // (zyada pakka source baad mein: company members < DM list < team members < GET status)
        const me = myId()
        const mine = presenceById.value[me]
        const next = { ...(fromMembers ?? presenceById.value), ...fromDmUsers(), ...fromTeam, ...fromStatus }
        presenceById.value = mine ? { ...next, [me]: mine } : next
      })
      .finally(() => {
        loading.value = false
        initialization = null
      })

    return initialization
  }

  // ---------- apna status server par ----------
  // PUT /v1/users/{user}/status   (fail ho to local status rehta hai, agla heartbeat dobara bhejta hai)
  async function pushMyStatus({ state, keepalive = false, clearCustomStatus = false } = {}) {
    const id = myId()
    if (!id || typeof dmApi.updateUserStatus !== 'function') return
    const mine = presenceById.value[id] ?? {}
    // Backend: { mode: 'online' | 'away' | 'offline', custom_status?: { emoji, text } }
    // ("Send a mode, a custom status, or both.")
    const payload = { mode: state ?? mine.state ?? 'online' }
    if (mine.status?.emoji || mine.status?.text) {
      payload.custom_status = { emoji: mine.status.emoji, text: mine.status.text }
    } else if (clearCustomStatus) {
      payload.custom_status = null
    }
    try {
      const result = await dmApi.updateUserStatus(id, payload, { keepalive })
      statusError.value = ''
      if (result?.changedAt) {
        if (lastOwn && lastOwn.state === result.state && lastOwn.changedAt !== result.changedAt) {
          heartbeatMovesChangedAt = true // wahi mode dobara bheja aur waqt badla: heartbeat ka waqt hai
        }
        lastOwn = { state: result.state, changedAt: result.changedAt }
      }
    } catch (cause) {
      statusError.value = errorMessage(cause)
    }
  }

  function applyMyState(state, { persist = true } = {}) {
    const id = myId()
    const current = presenceById.value[id] ?? { status: { emoji: '', text: '' } }
    delete profileStatusById.value[id]
    presenceById.value[id] = { ...current, state }
    if (persist) void pushMyStatus()
  }

  // ---------- live: online / away (idle) / offline (page band) ----------
  function onActivity() {
    lastActivity = Date.now()
    if (autoAway && !manualState) {
      autoAway = false
      applyMyState('online') // wapas aa gaye
    }
  }

  function checkIdle() {
    if (manualState || autoAway) return
    if (stateOf(myId()) === 'online' && Date.now() - lastActivity >= IDLE_AFTER) {
      autoAway = true
      applyMyState('away')
    }
  }

  function onVisible() {
    if (document.hidden) return
    onActivity()
    if (live) void pushMyStatus()
    if (pollTimer) void load({ silent: true })
  }

  // Tab/page band: server ko "offline" (keepalive se request band hone ke baad bhi poori hoti hai)
  function goOffline() {
    void pushMyStatus({ state: 'offline', keepalive: true })
  }

  // Internet toot kar wapas aaya: foran apna status dobara (online) bhejo.
  // (Internet tootne par browser kuch bhej nahi sakta: backend heartbeat band hone se offline kare)
  function onReconnect() {
    lastActivity = Date.now()
    void pushMyStatus()
    void load({ silent: true })
  }

  function startLive() {
    if (live || typeof window === 'undefined') return
    live = true
    lastActivity = Date.now()
    applyMyState(manualState ?? 'online') // page khulte hi online
    heartbeatTimer = setInterval(() => {
      if (!document.hidden) void pushMyStatus()
    }, HEARTBEAT_INTERVAL)
    idleTimer = setInterval(checkIdle, 30_000)
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true })
    window.addEventListener('pagehide', goOffline)
    window.addEventListener('online', onReconnect)
  }

  function stopLive() {
    if (!live) return
    live = false
    clearInterval(heartbeatTimer)
    clearInterval(idleTimer)
    heartbeatTimer = null
    idleTimer = null
    for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity)
    window.removeEventListener('pagehide', goOffline)
    window.removeEventListener('online', onReconnect)
  }

  async function init() {
    const request = load()
    startPolling() // dusron ka online/offline live
    startLive() // apna online/away/offline server par
    return request
  }

  function startPolling(interval = POLL_INTERVAL) {
    if (pollTimer || typeof window === 'undefined') return
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load({ silent: true })
    }, interval)
  }

  // Sab timers band (logout / page band par)
  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = null
    stopLive()
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible)
  }

  // ---------- getters ----------
  function setProfileStatus(userId, value) {
    if (userId == null || String(userId).trim() === '') return
    const state = stateFrom(value)
    if (state) profileStatusById.value[String(userId)] = state
  }

  function clearProfileStatuses(userIds) {
    for (const userId of userIds) {
      delete profileStatusById.value[String(userId)]
    }
  }

  function stateOf(userId) {
    const entry = presenceById.value[userId]
    const known =
      userId === myId()
        ? entry?.state
        : (profileStatusById.value[userId] ?? entry?.state)
    if (known && userId === myId()) return known
    if (known === 'online' && heartbeatMovesChangedAt && entry.changedAt) {
      // kaafi der se heartbeat nahi aayi: tab band ho chuka, asal mein offline
      const age = Date.now() - Date.parse(entry.changedAt)
      if (Number.isFinite(age) && age > STALE_ONLINE_MS) return 'offline'
    }
    if (known) return known
    return userId && userId === myId() ? 'online' : 'offline'
  }

  function lastSeenOf(userId) {
    return presenceById.value[userId]?.lastSeenAt ?? null
  }

  function customOf(userId) {
    return presenceById.value[userId]?.status ?? { emoji: '', text: '' }
  }

  function labelOf(userId) {
    const state = STATES[stateOf(userId)]
    const { emoji, text } = customOf(userId)
    return [state, [emoji, text].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
  }

  // ---------- user ke buttons ----------
  // Status changes -> PUT /v1/users/{user}/status
  function setMyState(state, { persist = true } = {}) {
    if (!Object.hasOwn(STATES, state)) return
    manualState = state === 'online' ? null : state
    autoAway = false
    lastActivity = Date.now()
    applyMyState(state, { persist })
  }

  // Custom status (emoji + text) -> PUT /v1/users/{user}/status
  function setMyStatus(emoji, text, { persist = true } = {}) {
    const id = myId()
    const current = presenceById.value[id] ?? { state: 'online' }
    const nextEmoji = String(emoji ?? '').trim()
    const nextText = String(text ?? '').trim()
    presenceById.value[id] = {
      ...current,
      status: { emoji: nextEmoji, text: nextText },
    }
    if (persist) void pushMyStatus({ clearCustomStatus: !nextEmoji && !nextText })
  }

  function clearMyStatus(options) {
    setMyStatus('', '', options)
  }

  return {
    presenceById,
    profileStatusById,
    loading,
    error,
    membersError,
    statusError,
    init,
    load,
    startPolling,
    stopPolling,
    goOffline,
    stateOf,
    setProfileStatus,
    clearProfileStatuses,
    lastSeenOf,
    customOf,
    labelOf,
    setMyState,
    setMyStatus,
    clearMyStatus,
  }
})