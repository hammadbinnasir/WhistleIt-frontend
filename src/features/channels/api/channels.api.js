import { useTeamsStore } from '@/stores/teams'
import { http } from './http'
import { asList, asObject, normalizeChannel, normalizeMember } from './normalizers'

function channelsPath(channelId) {
  const { activeWorkspaceId: companyId, activeTeamId: teamId } = useTeamsStore()
  if (!companyId || !teamId) {
    throw new Error('Select a company and team before loading channels.')
  }

  const base = `/v1/${encodeURIComponent(companyId)}/teams/${encodeURIComponent(teamId)}/channels`
  return channelId == null ? base : `${base}/${encodeURIComponent(channelId)}`
}

export async function listMyChannels() {
  const res = await http(channelsPath())
  return asList(res).items.map(normalizeChannel)
}

export async function browseChannels(query = '') {
  const res = await http(channelsPath(), { params: { q: query } })
  return asList(res).items.map(normalizeChannel)
}

export async function getChannel(id) {
  const res = await http(channelsPath(id))
  return normalizeChannel(asObject(res))
}

export async function createChannel({ name, description, isPrivate }) {
  const res = await http(channelsPath(), {
    method: 'POST',
    body: { name, description, type: isPrivate ? 'private' : 'public' },
  })
  return normalizeChannel(asObject(res))
}

export async function updateChannel(id, { name, description }) {
  const res = await http(channelsPath(id), {
    method: 'PATCH',
    body: { name, description },
  })
  return normalizeChannel(asObject(res))
}

export async function deleteChannel(id) {
  await http(channelsPath(id), { method: 'DELETE' })
}

export async function joinChannel(id) {
  const res = await http(`${channelsPath(id)}/join`, { method: 'POST' })
  return normalizeChannel({ ...asObject(res), isMember: true })
}

export async function leaveChannel(id) {
  await http(`${channelsPath(id)}/leave`, { method: 'DELETE' })
}

export async function listMembers(id, { limit = 10 } = {}) {
  const res = await http(`${channelsPath(id)}/members`, { params: { limit } })
  const { items, total } = asList(res)
  return { items: items.map(normalizeMember), total }
}

export async function addChannelMember(id, targetUser) {
  const res = await http(`${channelsPath(id)}/members`, {
    method: 'POST',
    body: { user_id: targetUser },
  })
  return asObject(res)
}

export async function removeChannelMember(id, targetUser) {
  await http(`${channelsPath(id)}/members/${encodeURIComponent(targetUser)}`, {
    method: 'DELETE',
  })
}
