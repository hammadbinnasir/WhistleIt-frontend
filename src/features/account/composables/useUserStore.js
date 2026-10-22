import { reactive, readonly } from 'vue'

/**
 * Single source of truth for the user module.
 *
 * Every action is async and currently only updates local state. When the
 * backend is ready, replace the `// TODO(api)` lines with real requests and
 * the components will not need to change.
 */

const defaultState = () => ({
  profile: {
    fullName: '',
    alias: '',
    twoFactor: 'inactive',
    designation: '',
    jobResponsibilities: '',
    photoUrl: '',
  },
  status: 'online', // 'online' | 'away' | 'offline' | 'dnd'
  customStatus: '',
  customStatusDuration: 'never', // 'never' | '30m' | '1h' | '4h' | 'today' | 'date'
  customStatusExpiresAt: null, // timestamp (ms) or null
  preferences: {
    enterKey: 'send',
    doubleClick: 'default',
    leftClick: 'menu',
    workspaceSwitch: 'current',
  },
  security: {
    hideEmail: false,
  },
})

const VALID_STATUSES = ['online', 'away', 'offline', 'dnd']
const MAX_TIMEOUT = 2147483647 // setTimeout limit (~24.8 days)

const state = reactive(defaultState())
const readonlyState = readonly(state)

const revokeBlob = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

/* ---------- custom status expiry ---------- */
let expiryTimer = null

const stopExpiryTimer = () => {
  clearTimeout(expiryTimer)
  expiryTimer = null
}

const wipeCustomStatus = () => {
  state.customStatus = ''
  state.customStatusDuration = 'never'
  state.customStatusExpiresAt = null
}

/** Clears the custom status once its expiry time passes (UI side only). */
function scheduleExpiry() {
  stopExpiryTimer()
  const at = state.customStatusExpiresAt
  if (!state.customStatus || !at) return

  const remaining = at - Date.now()
  if (remaining <= 0) {
    wipeCustomStatus()
    return
  }
  expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, MAX_TIMEOUT))
}

/* ---------- actions ---------- */

/** Merge server data (same shape as the state) into the store. */
function hydrate(data = {}) {
  if (data.profile) Object.assign(state.profile, data.profile)
  if (data.status && VALID_STATUSES.includes(data.status)) state.status = data.status
  if (data.customStatus !== undefined) state.customStatus = data.customStatus
  if (data.customStatusDuration) state.customStatusDuration = data.customStatusDuration
  if (data.customStatusExpiresAt !== undefined) {
    state.customStatusExpiresAt = data.customStatusExpiresAt
  }
  if (data.preferences) Object.assign(state.preferences, data.preferences)
  if (data.security) Object.assign(state.security, data.security)
  scheduleExpiry()
}

async function setStatus(status) {
  if (!VALID_STATUSES.includes(status)) return
  // TODO(api): await api.updatePresence(status)
  state.status = status
}

/** `options`: { duration: 'never'|'30m'|..., expiresAt: number|null } */
async function setCustomStatus(text, { duration = 'never', expiresAt = null } = {}) {
  // TODO(api): await api.updateCustomStatus({ text, expiresAt })
  state.customStatus = text
  state.customStatusDuration = duration
  state.customStatusExpiresAt = expiresAt
  scheduleExpiry()
}

async function clearCustomStatus() {
  // TODO(api): await api.clearCustomStatus()
  wipeCustomStatus()
  stopExpiryTimer()
}

/**
 * Payload produced by AccountSettingsModal:
 * { profile, photo: File|null, preferences, security, password: {oldPassword,newPassword}|null }
 */
async function saveSettings({ profile, photo, preferences, security }) {
  // TODO(api): upload `photo`, then send profile / preferences / security
  // TODO(api): if (password) await api.changePassword(password)
  if (profile) Object.assign(state.profile, profile)

  if (photo) {
    revokeBlob(state.profile.photoUrl)
    state.profile.photoUrl = URL.createObjectURL(photo)
  }

  if (preferences) Object.assign(state.preferences, preferences)
  if (security) Object.assign(state.security, security)
}

async function leaveTeam() {
  // TODO(api): await api.leaveTeam()
}

export function useUserStore() {
  return {
    state: readonlyState,
    hydrate,
    setStatus,
    setCustomStatus,
    clearCustomStatus,
    saveSettings,
    leaveTeam,
  }
}

/** Test helper: put the store back to its initial values. */
export function resetUserStore() {
  stopExpiryTimer()
  revokeBlob(state.profile.photoUrl)
  Object.assign(state, defaultState())
}
