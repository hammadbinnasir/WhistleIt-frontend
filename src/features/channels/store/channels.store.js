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
  const directory = ref({ items: [], loading: false, error: null })

  let inflight = null
  let browseRequestId = 0
  let directoryRequestId = 0
  let channelsRequestId = 0
  let directoryRequest = null
  const memberRequestIds = new Map()

  // ---------- getters ----------
  // Keep the order supplied by the team API; channels without these fields remain supported.
  const visibleChannels = computed(() => {
    return channels.value.filter((channel) => channel.isMember && !channel.isArchived)
  })
  const allChannels = computed(() => {
    const combined = new Map(
      directory.value.items
        .filter((channel) => !channel.isArchived)
        .map((channel) => [channel.id, channel]),
    )
    for (const channel of channels.value) {
      if (!channel.isArchived) {
        combined.set(channel.id, { ...combined.get(channel.id), ...channel, isMember: true })
      }
    }
    return [...combined.values()]
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

  function patchDirectory(id, changes) {
    const index = directory.value.items.findIndex((c) => c.id === String(id))
    if (index !== -1) directory.value.items[index] = { ...directory.value.items[index], ...changes }
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
        channels.value = list.filter((channel) => channel.isMember && !channel.isArchived)
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
      browse.value = { items, loading: false, error: null }
    } catch (err) {
      if (requestId !== browseRequestId) return
      browse.value = {
        items: [],
        loading: false,
        error: err?.message || 'Failed to load channels.',
      }
    }
  }

  function fetchDirectory({ force = false } = {}) {
    if (directoryRequest) return directoryRequest
    if (directory.value.items.length && !force) return Promise.resolve()

    const requestId = ++directoryRequestId
    directory.value = { ...directory.value, loading: true, error: null }
    directoryRequest = api
      .browseChannels('')
      .then((items) => {
        if (requestId !== directoryRequestId) return
        directory.value = { items, loading: false, error: null }
      })
      .catch((err) => {
        if (requestId !== directoryRequestId) return
        directory.value = {
          ...directory.value,
          loading: false,
          error: err?.message || 'Failed to load all channels.',
        }
      })
      .finally(() => {
        if (requestId === directoryRequestId) directoryRequest = null
      })
    return directoryRequest
  }

  async function fetchMembers(id, { limit = 10 } = {}) {
    const key = String(id)
    const requestId = (memberRequestIds.get(key) || 0) + 1
    memberRequestIds.set(key, requestId)
    const previous = members.value[key] || { items: [], total: 0 }
    members.value[key] = { ...previous, loading: true, error: false }
    try {
      const { items, total } = await api.listMembers(key, { limit })
      if (memberRequestIds.get(key) !== requestId) return
      members.value[key] = { items, total, loading: false, error: false }
    } catch {
      if (memberRequestIds.get(key) !== requestId) return
      members.value[key] = { ...previous, loading: false, error: true }
    }
  }

  async function fetchChannel(id) {
    const channel = await api.getChannel(id)
    upsertChannel(channel)
    return channel
  }

  // ---------- actions: management ----------
  async function createChannel(payload) {
    const channel = await api.createChannel(payload)
    channel.canManage = true
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
    const channel = await api.joinChannel(id)
    upsertChannel(channel)
    patchBrowse(id, { isMember: true, memberCount: channel.memberCount })
    patchDirectory(id, { isMember: true, memberCount: channel.memberCount })
    return channel
  }

  async function leaveChannel(id) {
    await api.leaveChannel(id)
    removeChannel(id)
    patchBrowse(id, { isMember: false })
    patchDirectory(id, { isMember: false })
  }

  async function deleteChannel(id) {
    await api.deleteChannel(id)
    removeChannel(id)
    browse.value.items = browse.value.items.filter((c) => c.id !== String(id))
    directory.value.items = directory.value.items.filter((c) => c.id !== String(id))
  }

  function addChannelMember(id, targetUser) {
    return api.addChannelMember(id, targetUser)
  }

  function removeChannelMember(id, targetUser) {
    return api.removeChannelMember(id, targetUser)
  }

  // ---------- local mutations (also usable by a realtime/socket handler) ----------
  function upsertChannel(channel) {
    if (!channel.isMember) {
      removeChannel(channel.id)
      return
    }
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
    directoryRequestId += 1
    memberRequestIds.clear()
    channels.value = []
    members.value = {}
    browse.value = { items: [], loading: false, error: null }
    directory.value = { items: [], loading: false, error: null }
    loaded.value = false
    loading.value = false
    error.value = null
    inflight = null
    directoryRequest = null
  }

  return {
    channels,
    loading,
    loaded,
    error,
    members,
    browse,
    directory,
    visibleChannels,
    allChannels,
    getById,
    fetchChannels,
    fetchBrowse,
    fetchDirectory,
    fetchMembers,
    fetchChannel,
    createChannel,
    updateChannel,
    joinChannel,
    leaveChannel,
    deleteChannel,
    addChannelMember,
    removeChannelMember,
    upsertChannel,
    removeChannel,
    reset,
  }
})
