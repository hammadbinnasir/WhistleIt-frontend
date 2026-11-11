import { getAuthUserId } from '@/features/auth/session'
import { normalizeMessage } from '@/features/dms/dmApi'
import { useTeamsStore } from '@/stores/teams'
import { http } from './http'
import { asList, asObject, normalizeChannel, normalizeMember } from './normalizers'
import { normalizeMessageAttachments } from '@/features/messages/messageAttachments'

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
      if (
        userId &&
        (channel.adminIds.includes(String(userId)) ||
          channel.isAdmin)
      ) {
        channel.canManage = true
      }
      if (userId && (channel.createdById != null || channel.createdBy != null)) {
        channel.isOwner =
          channel.isOwner || String(channel.createdById ?? channel.createdBy) === String(userId)
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
  if (
    userId &&
    (channel.adminIds.includes(String(userId)) ||
      channel.isAdmin === true)
  ) {
    channel.canManage = true
  }
  if (userId && (channel.createdById != null || channel.createdBy != null)) {
    channel.isOwner =
      channel.isOwner || String(channel.createdById ?? channel.createdBy) === String(userId)
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

export async function updateChannel(
  id,
  { name, description, messagePermission, allowedSenderIds } = {},
) {
  const body = {}
  if (name !== undefined) body.name = name
  if (description !== undefined) body.description = description
  if (messagePermission !== undefined) body.message_permission = messagePermission
  if (messagePermission !== undefined || allowedSenderIds !== undefined) {
    body.allowed_sender_ids = allowedSenderIds ?? []
  }

  const res = await http(channelsPath(id), {
    method: 'PATCH',
    body,
  })
  const updated = asObject(res)
  return normalizeChannel({
    ...updated,
    id: updated.id ?? updated.channel_id ?? id,
    name: updated.name ?? updated.channel_name ?? name ?? String(id),
    ...(messagePermission !== undefined && updated.message_permission == null
      ? { message_permission: messagePermission }
      : {}),
    ...(allowedSenderIds !== undefined && updated.allowed_sender_ids == null
      ? { allowed_sender_ids: allowedSenderIds }
      : {}),
  })
}

export async function deleteChannel(id) {
  await http(channelsPath(id), { method: 'DELETE' })
}

export async function sendChannelVoiceMessage(id, voiceNoteId, body = '') {
  if (voiceNoteId == null || voiceNoteId === '') {
    throw new Error('A voice note ID is required to send a voice message.')
  }
  const messageBody = typeof body === 'string' ? body.trim() : ''
  const response = await http(`${channelsPath(id)}/messages`, {
    method: 'POST',
    body: { body: messageBody || 'Voice message', voice_note_id: voiceNoteId },
  })
  const payload = response?.data?.data ?? response?.data ?? response
  return payload?.message ?? payload?.channel_message ?? payload
}

export async function listChannelMessages(id) {
  const response = await http(`${channelsPath(id)}/messages`)
  const result = response?.data?.data ?? response?.data ?? response
  const records = Array.isArray(result)
    ? result
    : (result?.messages ?? result?.channel_messages ?? result?.items)
  if (!Array.isArray(records)) {
    throw new Error('The channel messages response did not contain a message list.')
  }

  const currentUserId = getAuthUserId()
  return records.map((record) => {
    const raw = record?.message ?? record
    const normalized = normalizeMessage(raw)
    const rawVoiceNote =
      raw.voice_note ??
      raw.voiceNote ??
      raw.sender?.voice_note ??
      raw.sender?.voiceNote ??
      record?.voice_note ??
      record?.voiceNote ??
      record?.sender?.voice_note ??
      record?.sender?.voiceNote
    const voiceNoteId =
      raw.voice_note_id ??
      raw.voiceNoteId ??
      (typeof rawVoiceNote === 'string' || typeof rawVoiceNote === 'number'
        ? rawVoiceNote
        : (rawVoiceNote?.id ?? rawVoiceNote?.voice_note_id ?? rawVoiceNote?.voiceNoteId)) ??
      record?.voice_note_id ??
      record?.voiceNoteId
    const author = raw.sender ?? raw.user ?? raw.author
    const authorName =
      typeof author === 'string'
        ? author
        : (author?.full_name ?? author?.fullName ?? author?.name ?? raw.author_name ?? '')
    return {
      ...normalized,
      ...(voiceNoteId != null ? { voiceNoteId: String(voiceNoteId) } : {}),
      content: normalized.text,
      author: authorName,
      authorId: normalized.from,
      mine: currentUserId == null ? Boolean(raw.mine) : normalized.from === String(currentUserId),
      attachments: normalizeMessageAttachments(raw),
    }
  })
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
  const attachment = payload?.attachment
  let body = payload
  if (attachment) {
    body = new FormData()
    const messageBody = payload.body ?? payload.content
    if (typeof messageBody === 'string' && messageBody.trim()) {
      body.append('body', messageBody.trim())
    }
    body.append('attachment', attachment)
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'body' || key === 'content' || key === 'attachment' || value == null) return
      body.append(key, typeof value === 'string' ? value : JSON.stringify(value))
    })
  }
  const response = await http(`${channelsPath(channelId)}/messages`, {
    method: 'POST',
    body,
  })
  const source = response?.data?.message ?? response?.message ?? response?.data ?? response
  const id = source?.id ?? source?.message_id ?? source?.uuid
  return {
    ...source,
    id: id == null ? null : String(id),
    content:
      source?.content ?? source?.body ?? source?.text ?? payload.content ?? payload.body ?? '',
  }
}

export async function listPinnedMessages(channelId, messageId) {
  const res = await http(
    `${channelsPath(channelId)}/messages/${encodeURIComponent(messageId)}/pinned-messages`,
  )
  return asList(res).items
}

export async function pinMessage(channelId, messageId) {
  return http(`${channelsPath(channelId)}/messages/${encodeURIComponent(messageId)}/pin`, {
    method: 'POST',
  })
}

export async function unpinMessage(channelId, messageId) {
  await http(`${channelsPath(channelId)}/messages/${encodeURIComponent(messageId)}/pin`, {
    method: 'DELETE',
  })
}
