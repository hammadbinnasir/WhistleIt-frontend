import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api from '../api'

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

  // ---------- getters ----------
  // Sidebar order: favorites first, then the server order. Archived channels are hidden.
  const visibleChannels = computed(() => {
    const active = channels.value.filter((c) => !c.isArchived)
    return [...active.filter((c) => c.isFavorite), ...active.filter((c) => !c.isFavorite)]
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

  // Apply a change immediately, call the API, roll back if it fails (error is re-thrown).
  async function optimistic(id, changes, request) {
    const channel = getById(id)
    if (!channel) return
    const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, channel[key]]))
    patch(id, changes)
    try {
      await request()
    } catch (err) {
      patch(id, previous)
      throw err
    }
  }

  // ---------- actions: list ----------
  // Never rejects; check `error`. Concurrent callers share one request.
  function fetchChannels({ force = false } = {}) {
    if (inflight) return inflight
    if (loaded.value && !force) return Promise.resolve()
    loading.value = true
    error.value = null
    inflight = api
      .listMyChannels()
      .then((list) => {
        channels.value = list
        loaded.value = true
      })
      .catch((err) => {
        error.value = err?.message || 'Failed to load channels.'
      })
      .finally(() => {
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
      browse.value = { items, loading: false, error: null }
    } catch (err) {
      if (requestId !== browseRequestId) return
      browse.value = { items: [], loading: false, error: err?.message || 'Failed to load channels.' }
    }
  }

  async function fetchMembers(id, { limit = 10 } = {}) {
    const key = String(id)
    const previous = members.value[key] || { items: [], total: 0 }
    members.value[key] = { ...previous, loading: true, error: false }
    try {
      const { items, total } = await api.listMembers(key, { limit })
      members.value[key] = { items, total, loading: false, error: false }
    } catch {
      members.value[key] = { ...previous, loading: false, error: true }
    }
  }

  // ---------- actions: management ----------
  async function createChannel(payload) {
    const channel = await api.createChannel(payload)
    upsertChannel(channel)
    return channel
  }

  async function updateChannel(id, payload) {
    const channel = await api.updateChannel(id, payload)
    const editable = { name: channel.name, description: channel.description }
    patch(id, editable) // only editable fields, so favorite/mute/unread flags are never overwritten
    patchBrowse(id, editable)
    return getById(id) || channel
  }

  async function joinChannel(id) {
    const channel = await api.joinChannel(id)
    upsertChannel(channel)
    patchBrowse(id, { isMember: true, memberCount: channel.memberCount })
    return channel
  }

  async function leaveChannel(id) {
    await api.leaveChannel(id)
    removeChannel(id)
    patchBrowse(id, { isMember: false })
  }

  async function archiveChannel(id) {
    await api.archiveChannel(id)
    removeChannel(id)
    browse.value.items = browse.value.items.filter((c) => c.id !== String(id))
  }

  function toggleFavorite(id) {
    const channel = getById(id)
    if (!channel) return Promise.resolve()
    const value = !channel.isFavorite
    return optimistic(id, { isFavorite: value }, () => api.setFavorite(String(id), value))
  }

  function toggleMute(id) {
    const channel = getById(id)
    if (!channel) return Promise.resolve()
    const value = !channel.isMuted
    return optimistic(id, { isMuted: value }, () => api.setMuted(String(id), value))
  }

  function markUnread(id) {
    return optimistic(id, { isUnread: true }, () => api.markUnread(String(id)))
  }

  // ---------- local mutations (also usable by a realtime/socket handler) ----------
  function upsertChannel(channel) {
    const index = channels.value.findIndex((c) => c.id === channel.id)
    if (index === -1) channels.value.push(channel)
    else channels.value[index] = { ...channels.value[index], ...channel }
  }

  function removeChannel(id) {
    channels.value = channels.value.filter((c) => c.id !== String(id))
  }

  function reset() {
    channels.value = []
    members.value = {}
    browse.value = { items: [], loading: false, error: null }
    loaded.value = false
    loading.value = false
    error.value = null
    inflight = null
  }

  return {
    channels, loading, loaded, error, members, browse,
    visibleChannels, getById,
    fetchChannels, fetchBrowse, fetchMembers,
    createChannel, updateChannel, joinChannel, leaveChannel, archiveChannel,
    toggleFavorite, toggleMute, markUnread,
    upsertChannel, removeChannel, reset,
  }
})
