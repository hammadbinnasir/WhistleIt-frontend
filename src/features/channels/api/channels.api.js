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
  return resolveChannelMembership(asList(res).items, { includeMemberCount: true })
}

async function resolveChannelMembership(records, { includeMemberCount = false } = {}) {
  const userId = getAuthUserId()
  return Promise.all(
    records.map(async (record) => {
      const channel = normalizeChannel(record)
      const source = record?.channel ?? record
      const hasMemberCount = source.memberCount != null || source.member_count != null
      if (userId && (channel.createdById != null || channel.createdBy != null)) {
        channel.isOwner =
          channel.isOwner ||
          String(channel.createdById ?? channel.createdBy) === String(userId)
        channel.canManage = channel.canManage || channel.isOwner
      }
      if (source.isMember != null || source.is_member != null) {
        if (includeMemberCount && !hasMemberCount) {
          try {
            const { total } = await listMembers(channel.id, { limit: 100 })
            channel.memberCount = total
          } catch {
            // Keep browsing available if the member count cannot be loaded.
          }
        }
        return channel
      }
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
        ...(includeMemberCount && !hasMemberCount ? { memberCount: total } : {}),
        isMember: completeMembers.some((member) => member.id === String(userId)),
      }
    }),
  )
}

async function resolveCreatorName(channel) {
  const creatorId = channel.createdById ?? channel.createdBy
  if (creatorId == null || !/^[a-f\d]{16,}$/i.test(String(creatorId))) return
  try {
    const { items } = await listMembers(channel.id, { limit: 100 })
    const creator = items.find((member) => member.id === String(creatorId))
    if (creator?.name) channel.createdBy = creator.name
  } catch {
    // Keep the creator ID as a fallback when the members endpoint is unavailable.
  }
}

export async function getChannel(id) {
  const res = await http(channelsPath(id))
  const channel = normalizeChannel(asObject(res))
  const userId = getAuthUserId()
  if (userId && (channel.createdById != null || channel.createdBy != null)) {
    channel.isOwner =
      channel.isOwner ||
      String(channel.createdById ?? channel.createdBy) === String(userId)
    channel.canManage = channel.canManage || channel.isOwner
  }
  await resolveCreatorName(channel)
  return channel
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
  const response = asObject(res)
  const rawMemberCount = response.memberCount ?? response.member_count
  const memberCount = rawMemberCount == null ? undefined : Number(rawMemberCount)
  return {
    id: String(id),
    isMember: true,
    ...(Number.isFinite(memberCount) ? { memberCount } : {}),
  }
}

export async function leaveChannel(id, newAdminId) {
  await http(`${channelsPath(id)}/leave`, {
    method: 'DELETE',
    ...(newAdminId ? { body: { new_admin_id: newAdminId } } : {}),
  })
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

export async function sendChannelMessage(channelId, payload) {
  const response = await http(`${channelsPath(channelId)}/messages`, {
    method: 'POST',
    body: payload,
  })
  const source = response?.data?.message ?? response?.message ?? response?.data ?? response
  const id = source?.id ?? source?.message_id ?? source?.uuid
  return {
    ...source,
    id: id == null ? null : String(id),
    content: source?.content ?? source?.body ?? source?.text ?? payload.content ?? payload.body ?? '',
  }
}

export async function listPinnedMessages(channelId, messageId) {
  const res = await http(
    `${channelsPath(channelId)}/messages/${encodeURIComponent(messageId)}/pinned-messages`,
  )
  return asList(res).items
}

export async function pinMessage(channelId, messageId) {
  return http(
    `${channelsPath(channelId)}/messages/${encodeURIComponent(messageId)}/pin`,
    { method: 'POST' },
  )
}

export async function unpinMessage(channelId, messageId) {
  await http(`${channelsPath(channelId)}/messages/${encodeURIComponent(messageId)}/pin`, {
    method: 'DELETE',
  })
}
