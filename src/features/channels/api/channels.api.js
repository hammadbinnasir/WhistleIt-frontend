import { getAuthUserId } from '@/features/auth/session'
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

export async function listChannels() {
  const res = await http(channelsPath())
  return resolveChannelMembership(asList(res).items)
}

export async function browseChannels(query = '') {
  const res = await http(channelsPath(), { params: { q: query } })
  return resolveChannelMembership(asList(res).items)
}

async function resolveChannelMembership(records) {
  const userId = getAuthUserId()
  return Promise.all(
    records.map(async (record) => {
      const channel = normalizeChannel(record)
      const source = record?.channel ?? record
      if (source.isMember != null || source.is_member != null) return channel
      if (!userId) {
        throw new Error(
          'The channel response does not include membership and the signed-in user ID is unavailable.',
        )
      }

      const { items, total } = await listMembers(channel.id, { limit: 100 })
      const completeMembers =
        total > items.length ? (await listMembers(channel.id, { limit: total })).items : items
      return {
        ...channel,
        isMember: completeMembers.some((member) => member.id === String(userId)),
      }
    }),
  )
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
  const channel = asObject(res)
  return normalizeChannel({
    ...channel,
    isMember: channel.isMember ?? channel.is_member ?? true,
  })
}

export async function updateChannel(id, { name, description, messagePermission }) {
  const res = await http(channelsPath(id), {
    method: 'PATCH',
    body: { name, description, message_permission: messagePermission },
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

export async function listAvailableMembers(id) {
  const res = await http(`${channelsPath(id)}/available-members`)
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
