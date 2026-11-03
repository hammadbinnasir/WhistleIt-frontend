// Real API calls. Endpoints below are a PROPOSED contract (see README) to hand to the backend team.
import { http } from './http'
import { asList, asObject, normalizeChannel, normalizeMember } from './normalizers'

export async function listMyChannels() {
  const res = await http('/channels', { params: { joined: true } })
  return asList(res).items.map(normalizeChannel)
}

export async function browseChannels(query = '') {
  const res = await http('/channels/browse', { params: { q: query } })
  return asList(res).items.map(normalizeChannel)
}

export async function createChannel({ name, description, isPrivate }) {
  const res = await http('/channels', { method: 'POST', body: { name, description, isPrivate } })
  return normalizeChannel(asObject(res))
}

export async function updateChannel(id, { name, description }) {
  const res = await http(`/channels/${id}`, { method: 'PATCH', body: { name, description } })
  return normalizeChannel(asObject(res))
}

export async function joinChannel(id) {
  const res = await http(`/channels/${id}/join`, { method: 'POST' })
  return normalizeChannel({ ...asObject(res), isMember: true })
}

export async function leaveChannel(id) {
  await http(`/channels/${id}/leave`, { method: 'POST' })
}

export async function archiveChannel(id) {
  await http(`/channels/${id}/archive`, { method: 'POST' })
}

export async function setFavorite(id, value) {
  await http(`/channels/${id}/favorite`, { method: value ? 'PUT' : 'DELETE' })
}

export async function setMuted(id, value) {
  await http(`/channels/${id}/mute`, { method: value ? 'PUT' : 'DELETE' })
}

export async function markUnread(id) {
  await http(`/channels/${id}/unread`, { method: 'POST' })
}

export async function listMembers(id, { limit = 10 } = {}) {
  const res = await http(`/channels/${id}/members`, { params: { limit } })
  const { items, total } = asList(res)
  return { items: items.map(normalizeMember), total }
}
