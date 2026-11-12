import { reactive, readonly, ref } from 'vue'
import { getAuthUserId } from '@/features/auth/session'
import {
  deleteUserAvatar,
  deleteUserCustomStatus,
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
  updateUserEmailVisibility,
  updateUserPassword,
  updateUserStatus,
  uploadUserAvatar,
} from '../api'

/**
 * Single source of truth for the user module.
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
  customStatusEmoji: '',
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
const VALID_PREFERENCES = {
  enterKey: ['send', 'newline'],
  doubleClick: ['default', 'reminder'],
  leftClick: ['default', 'menu'],
  workspaceSwitch: ['current', 'new'],
}
const MAX_TIMEOUT = 2147483647 // setTimeout limit (~24.8 days)

const state = reactive(defaultState())
const readonlyState = readonly(state)
const profileLoaded = ref(false)

const revokeBlob = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

function requireUserId() {
  const userId = getAuthUserId()
  if (!userId) throw new Error('Your account ID is missing. Please sign in again.')
  return userId
}

function normalizeAvatarUrl(url) {
  const protocol = url.match(/^[a-z][a-z\d+.-]*:\/\//i)?.[0] ?? ''
  const path = protocol ? url.slice(protocol.length) : url
  return `${protocol}${path.replace(/\/{2,}/g, '/')}`
}

function getAvatarUrl(response) {
  let data = response
  while (data?.data && typeof data.data === 'object') data = data.data
  const candidates = [
    data,
    data?.user,
    data?.profile,
    typeof data?.avatar === 'object' ? data.avatar : null,
    data?.user?.profile,
  ]
  for (const candidate of candidates) {
    const url = [
      candidate?.photoUrl,
      candidate?.photo_url,
      candidate?.profilePhotoUrl,
      candidate?.profile_photo_url,
      candidate?.avatarUrl,
      candidate?.avatar_url,
      candidate?.profilePicture,
      candidate?.profile_picture,
      candidate?.profilePictureUrl,
      candidate?.profile_picture_url,
      candidate?.profileImage,
      candidate?.profile_image,
      candidate?.imageUrl,
      candidate?.image_url,
      candidate?.pictureUrl,
      candidate?.picture_url,
      candidate?.avatar,
      candidate?.url,
    ].find((value) => typeof value === 'string' && value)
    if (url) return normalizeAvatarUrl(url)
  }
  return ''
}

function getUserProfileData(response) {
  let data = response
  while (data?.data && typeof data.data === 'object') data = data.data
  return data?.user?.profile ?? data?.profile ?? data?.user ?? data
}

function normalizePreferences(preferences = {}) {
  const leftClick = preferences.leftClick ?? preferences.left_click
  return {
    enterKey: preferences.enterKey ?? preferences.enter_key,
    doubleClick: preferences.doubleClick ?? preferences.double_click,
    leftClick:
      leftClick === 'open_menu' ? 'menu' : leftClick === 'default_click' ? 'default' : leftClick,
    workspaceSwitch: preferences.workspaceSwitch ?? preferences.workspace_switch,
  }
}

/* ---------- custom status expiry ---------- */
let expiryTimer = null

const stopExpiryTimer = () => {
  clearTimeout(expiryTimer)
  expiryTimer = null
}

const wipeCustomStatus = () => {
  state.customStatus = ''
  state.customStatusEmoji = ''
  state.customStatusDuration = 'never'
  state.customStatusExpiresAt = null
}

function normalizeCustomStatus(value) {
  const entries = Array.isArray(value) ? value : [value]
  return entries.reduce(
    (status, entry) => {
      if (typeof entry === 'string') {
        status.text ||= entry
      } else if (entry && typeof entry === 'object') {
        if (typeof entry.text === 'string') status.text ||= entry.text
        if (typeof entry.emoji === 'string') status.emoji ||= entry.emoji
        status.expiresAt ??= entry.expiresAt ?? entry.expires_at
      }
      return status
    },
    { text: '', emoji: '', expiresAt: undefined },
  )
}

function normalizeExpiry(value) {
  if (value == null || value === '') return null
  const timestamp = typeof value === 'number' ? value : new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
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
  if (data.profile) {
    Object.assign(state.profile, data.profile)
    profileLoaded.value = true
  }
  if (data.status && VALID_STATUSES.includes(data.status)) state.status = data.status
  const customStatusValue = data.customStatus ?? data.custom_status
  if (customStatusValue !== undefined) {
    const customStatus = normalizeCustomStatus(customStatusValue)
    state.customStatus = customStatus.text
    state.customStatusEmoji =
      data.customStatusEmoji ?? data.custom_status_emoji ?? customStatus.emoji
  }
  if (data.customStatusEmoji !== undefined) state.customStatusEmoji = data.customStatusEmoji
  if (data.customStatusDuration) state.customStatusDuration = data.customStatusDuration
  const expiresAt = data.customStatusExpiresAt ?? customStatusValue?.expiresAt ?? customStatusValue?.expires_at
  if (data.customStatusExpiresAt !== undefined || expiresAt !== undefined) {
    state.customStatusExpiresAt = normalizeExpiry(expiresAt)
  }
  if (data.preferences) {
    const preferences = normalizePreferences(data.preferences)
    for (const [key, value] of Object.entries(preferences)) {
      if (VALID_PREFERENCES[key]?.includes(value)) state.preferences[key] = value
    }
  }
  if (data.security) Object.assign(state.security, data.security)
  scheduleExpiry()
}

async function loadUserProfile() {
  const response = await getUserProfile(requireUserId())
  const data = getUserProfileData(response)
  const responseData = response?.data?.data ?? response?.data ?? response
  const preferences =
    data?.preferences ??
    data?.user?.preferences ??
    responseData?.preferences ??
    responseData?.user?.preferences
  const jobResponsibilities = data?.jobResponsibilities ?? data?.job_responsibilities
  const profileFields = {
    fullName: data?.fullName ?? data?.full_name ?? data?.name,
    alias: data?.alias ?? data?.display_name,
    twoFactor: data?.twoFactor ?? data?.two_factor,
    designation: data?.designation ?? data?.title,
    jobResponsibilities: Array.isArray(jobResponsibilities)
      ? jobResponsibilities.join('\n')
      : jobResponsibilities,
    photoUrl: [data?.photoUrl, data?.photo_url, data?.avatar_url]
      .filter((url) => typeof url === 'string' && url)
      .map(normalizeAvatarUrl)[0],
  }
  const profile = {}
  for (const [key, value] of Object.entries(profileFields)) {
    if (value !== undefined && value !== null) profile[key] = value
  }
  hydrate({
    profile,
    preferences,
    status: data?.status ?? data?.presence,
    customStatus:
      data?.customStatus !== undefined
        ? data.customStatus
        : data?.custom_status !== undefined
          ? (data.custom_status ?? '')
          : undefined,
    customStatusExpiresAt:
      data?.customStatusExpiresAt ?? data?.custom_status_expires_at,
  })
  const photoUrl = getAvatarUrl(response)
  if (photoUrl && !profile.photoUrl) state.profile.photoUrl = photoUrl
}

async function setStatus(status) {
  if (!VALID_STATUSES.includes(status)) return
  await updateUserStatus(requireUserId(), { mode: status })
  state.status = status
}

/** `options`: { duration: 'never'|'30m'|..., expiresAt: number|null } */
async function setCustomStatus(text, { emoji = '☕', duration = 'never', expiresAt = null } = {}) {
  await updateUserStatus(requireUserId(), {
    custom_status: {
      emoji,
      text,
      expires_at: expiresAt == null ? null : new Date(expiresAt).toISOString(),
    },
  })
  state.customStatus = text
  state.customStatusEmoji = emoji
  state.customStatusDuration = duration
  state.customStatusExpiresAt = expiresAt
  scheduleExpiry()
}

async function clearCustomStatus() {
  await deleteUserCustomStatus(requireUserId())
  wipeCustomStatus()
  stopExpiryTimer()
}

/**
 * Payload produced by AccountSettingsModal:
 * { profile, photo: File|null, removePhoto, preferences, security, password }
 */
async function saveSettings({ profile, photo, removePhoto, preferences, security, password }) {
  if (profile) {
    const jobResponsibilities = Array.isArray(profile.jobResponsibilities)
      ? profile.jobResponsibilities
      : typeof profile.jobResponsibilities === 'string'
        ? profile.jobResponsibilities
            .split(/\r?\n/)
            .map((responsibility) => responsibility.trim())
            .filter(Boolean)
        : []
    const profilePayload = {
      name: profile.fullName,
      display_name: profile.alias,
      two_factor: profile.twoFactor,
      title: profile.designation,
      job_responsibilities: jobResponsibilities,
    }
    await updateUserProfile(requireUserId(), profilePayload)
    Object.assign(state.profile, {
      ...profile,
      jobResponsibilities: jobResponsibilities.join('\n'),
    })
    profileLoaded.value = true
  }

  if (password) await updateUserPassword(requireUserId(), password)

  if (photo) {
    const userId = requireUserId()
    await uploadUserAvatar(userId, photo)
    const photoUrl = URL.createObjectURL(photo)
    revokeBlob(state.profile.photoUrl)
    state.profile.photoUrl = photoUrl
  } else if (removePhoto) {
    await deleteUserAvatar(requireUserId())
    revokeBlob(state.profile.photoUrl)
    state.profile.photoUrl = ''
  }

  if (preferences) {
    await updateUserPreferences(requireUserId(), preferences)
    Object.assign(state.preferences, preferences)
  }
  if (security && security.hideEmail !== state.security.hideEmail) {
    await updateUserEmailVisibility(requireUserId(), !security.hideEmail)
    Object.assign(state.security, security)
  }
}

async function leaveTeam() {
  // TODO(api): await api.leaveTeam()
}

export function useUserStore() {
  return {
    state: readonlyState,
    profileLoaded,
    hydrate,
    loadUserProfile,
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
