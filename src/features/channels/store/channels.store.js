import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api from '../api'

const MANAGED_CHANNELS_STORAGE_KEY = 'whistleit-managed-channel-ids'
const MUTED_CHANNELS_STORAGE_KEY = 'whistleit-muted-channel-ids'
const FAVORITE_CHANNELS_STORAGE_KEY = 'whistleit-favorite-channel-ids'
const managedChannelIds = new Set()

function getManagedChannelIds() {
  if (typeof localStorage === 'undefined') return new Set(managedChannelIds)
  try {
    const ids = JSON.parse(localStorage.getItem(MANAGED_CHANNELS_STORAGE_KEY) || '[]')
    if (Array.isArray(ids)) ids.forEach((id) => managedChannelIds.add(String(id)))
    return new Set(managedChannelIds)
  } catch {
    return new Set(managedChannelIds)
  }
}

function rememberManagedChannel(id) {
  const ids = getManagedChannelIds()
  ids.add(String(id))
  managedChannelIds.add(String(id))
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(MANAGED_CHANNELS_STORAGE_KEY, JSON.stringify([...ids]))
    } catch {
      // Management still remains available for the current session.
    }
  }
}

function withPersistedManagement(channel) {
  return {
    ...channel,
    canManage: Boolean(channel.canManage || getManagedChannelIds().has(String(channel.id))),
  }
}

function getMutedChannelIds() {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const ids = JSON.parse(localStorage.getItem(MUTED_CHANNELS_STORAGE_KEY) || '[]')
    return new Set(Array.isArray(ids) ? ids.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveMutedChannelIds(ids) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MUTED_CHANNELS_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Keep mute state available in memory when storage is unavailable.
  }
}

function withMutedPreference(channel) {
  const mutedIds = getMutedChannelIds()
  return {
    ...channel,
    isMuted: mutedIds.has(String(channel.id)) || Boolean(channel.isMuted),
  }
}

function getFavoriteChannelIds() {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const ids = JSON.parse(localStorage.getItem(FAVORITE_CHANNELS_STORAGE_KEY) || '[]')
    return new Set(Array.isArray(ids) ? ids.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveFavoriteChannelIds(ids) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FAVORITE_CHANNELS_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Keep favorite state available in memory when storage is unavailable.
  }
}

function withFavoritePreference(channel) {
  const favoriteIds = getFavoriteChannelIds()
  return {
    ...channel,
    isFavorite: favoriteIds.has(String(channel.id)) || Boolean(channel.isFavorite),
  }
}

export const useChannelsStore = defineStore('channels', () => {
  // ---------- state ----------
  const channels = ref([]) // channels the current user is a member of
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref(null)
  const members = ref({}) // { [channelId]: { items, total, loading, error } }
  const browse = ref({ items: [], loading: false, error: null })

  let inflight = null
  let browseRequestId = 0
  let channelsRequestId = 0
  const memberRequestIds = new Map()

  // ---------- getters ----------
  // Keep the order supplied by the team API; channels without these fields remain supported.
  const visibleChannels = computed(() => {
    return channels.value
      .filter((channel) => channel.isMember !== false && !channel.isArchived)
      .map((channel) => ({ channel, index: channels.value.indexOf(channel) }))
      .sort((a, b) => Number(Boolean(b.channel.isFavorite)) - Number(Boolean(a.channel.isFavorite)) || a.index - b.index)
      .map(({ channel }) => channel)
  })

  function getById(id) {
    if (id === null || id === undefined) return null
    return channels.value.find((c) => c.id === String(id)) || null
  }

  // ---------- helpers ----------
  function patch(id, changes) {
    const index = channels.value.findIndex((c) => c.id === String(id))
    if (index !== -1) channels.value[index] = { ...channels.value[index], ...changes }
  }

  function patchBrowse(id, changes) {
    const index = browse.value.items.findIndex((c) => c.id === String(id))
    if (index !== -1) browse.value.items[index] = { ...browse.value.items[index], ...changes }
  }

  // ---------- actions: list ----------
  // Never rejects; check `error`. Concurrent callers share one request.
  function fetchChannels({ force = false } = {}) {
    if (inflight) return inflight
    if (loaded.value && !force) return Promise.resolve()
    loading.value = true
    error.value = null
    const requestId = ++channelsRequestId
    inflight = api
      .listChannels()
      .then((list) => {
        if (requestId !== channelsRequestId) return
        channels.value = list
          .map(withPersistedManagement)
          .map(withMutedPreference)
          .map(withFavoritePreference)
          .filter((channel) => channel.isMember && !channel.isArchived)
        loaded.value = true
      })
      .catch((err) => {
        if (requestId !== channelsRequestId) return
        error.value = err?.message || 'Failed to load channels.'
      })
      .finally(() => {
        if (requestId !== channelsRequestId) return
        loading.value = false
        inflight = null
      })
    return inflight
  }

  async function fetchBrowse(query = '') {
    const requestId = ++browseRequestId
    browse.value = { ...browse.value, loading: true, error: null }
    try {
      const items = await api.browseChannels(query)
      if (requestId !== browseRequestId) return // a newer search superseded this one
      browse.value = {
        items: items.map(withMutedPreference).map(withFavoritePreference),
        loading: false,
        error: null,
      }
    } catch (err) {
      if (requestId !== browseRequestId) return
      browse.value = {
        items: [],
        loading: false,
        error: err?.message || 'Failed to load channels.',
      }
    }
  }

  async function fetchMembers(id, { limit = 10 } = {}) {
    const key = String(id)
    const previous = members.value[key] || { items: [], total: 0, loaded: false }
    const hasEnoughMembers = previous.items.length >= limit || previous.total <= previous.items.length
    if (previous.loaded && hasEnoughMembers) return
    if (previous.loading && (previous.limit ?? 0) >= limit) return

    const requestId = (memberRequestIds.get(key) || 0) + 1
    memberRequestIds.set(key, requestId)
    members.value[key] = { ...previous, limit, loading: true, error: false }
    try {
      const { items, total } = await api.listMembers(key, { limit })
      if (memberRequestIds.get(key) !== requestId) return
      members.value[key] = { items, total, limit, loaded: true, loading: false, error: false }
    } catch {
      if (memberRequestIds.get(key) !== requestId) return
      members.value[key] = { ...previous, loading: false, error: true }
    }
  }

  async function fetchChannel(id) {
    const channel = await api.getChannel(id)
    const manageableChannel = withPersistedManagement(channel)
    const mutedChannel = withMutedPreference(manageableChannel)
    upsertChannel(mutedChannel)
    return mutedChannel
  }

  // ---------- actions: management ----------
  async function createChannel(payload) {
    const channel = await api.createChannel(payload)
    channel.canManage = true
    rememberManagedChannel(channel.id)
    upsertChannel(channel)
    return channel
  }

  async function updateChannel(id, payload) {
    const channel = await api.updateChannel(id, payload)
    const editable = {
      name: channel.name,
      description: channel.description,
      messagePermission: channel.messagePermission,
    }
    patch(id, editable)
    patchBrowse(id, editable)
    return getById(id) || channel
  }

  async function joinChannel(id) {
    const result = await api.joinChannel(id)
    const existing = getById(id) || browse.value.items.find((channel) => channel.id === String(id))
    const channel = { ...existing, ...result, id: String(id), isMember: true }
    if (result.memberCount == null) channel.memberCount = (existing?.memberCount ?? 0) + 1
    upsertChannel(channel)
    patchBrowse(id, { isMember: true, memberCount: channel.memberCount })
    return channel
  }

  async function leaveChannel(id, newAdminId) {
    await api.leaveChannel(id, newAdminId)
    removeChannel(id)
    patchBrowse(id, { isMember: false })
  }

  async function deleteChannel(id) {
    await api.deleteChannel(id)
    removeChannel(id)
    browse.value.items = browse.value.items.filter((c) => c.id !== String(id))
  }

  function addChannelMember(id, targetUser) {
    return api.addChannelMember(id, targetUser)
  }

  function removeChannelMember(id, targetUser) {
    return api.removeChannelMember(id, targetUser)
  }

  function toggleFavorite(id) {
    const channel = getById(id)
    if (!channel) return false

    const isFavorite = !channel.isFavorite
    const favoriteIds = getFavoriteChannelIds()
    if (isFavorite) favoriteIds.add(String(id))
    else favoriteIds.delete(String(id))
    saveFavoriteChannelIds(favoriteIds)
    patch(id, { isFavorite })
    patchBrowse(id, { isFavorite })
    return isFavorite
  }

  function toggleMute(id) {
    const channel = getById(id)
    if (!channel) return false

    const isMuted = !channel.isMuted
    const mutedIds = getMutedChannelIds()
    if (isMuted) mutedIds.add(String(id))
    else mutedIds.delete(String(id))
    saveMutedChannelIds(mutedIds)
    patch(id, { isMuted })
    patchBrowse(id, { isMuted })
    return isMuted
  }

  // ---------- local mutations (also usable by a realtime/socket handler) ----------
  function upsertChannel(channel) {
    if (channel.isMember === false) {
      removeChannel(channel.id)
      return
    }
    channel = withPersistedManagement(channel)
    channel = withMutedPreference(channel)
    channel = withFavoritePreference(channel)
    const index = channels.value.findIndex((c) => c.id === channel.id)
    if (index === -1) channels.value.push(channel)
    else channels.value[index] = { ...channels.value[index], ...channel }
  }

  function removeChannel(id) {
    channels.value = channels.value.filter((c) => c.id !== String(id))
  }

  function reset() {
    channelsRequestId += 1
    browseRequestId += 1
    memberRequestIds.clear()
    channels.value = []
    members.value = {}
    browse.value = { items: [], loading: false, error: null }
    loaded.value = false
    loading.value = false
    error.value = null
    inflight = null
  }

  return {
    channels,
    loading,
    loaded,
    error,
    members,
    browse,
    visibleChannels,
    getById,
    fetchChannels,
    fetchBrowse,
    fetchMembers,
    fetchChannel,
    createChannel,
    updateChannel,
    joinChannel,
    leaveChannel,
    deleteChannel,
    addChannelMember,
    removeChannelMember,
    toggleFavorite,
    toggleMute,
    upsertChannel,
    removeChannel,
    reset,
  }
})
