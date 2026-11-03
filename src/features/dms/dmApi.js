import { apiRequest } from '@/lib/api/client'
import { getAuthUserId } from '@/features/auth/session'
import { getMembers, getNotMembers } from '@/features/shell/api/membersApi'
import { normalizeMembers } from '@/features/shell/api/normalizers'

function directChannelsPath(companyId) {
  if (companyId == null || !String(companyId).trim()) {
    throw new Error('A company ID is required to load direct channels.')
  }
  return `/v1/${encodeURIComponent(String(companyId))}/direct-channels`
}

function directChannelPath(companyId, channelId) {
  if (channelId == null || !String(channelId).trim()) {
    throw new Error('A channel ID is required to load a direct conversation.')
  }
  return `${directChannelsPath(companyId)}/${encodeURIComponent(String(channelId))}`
}

function companyMembersPath(companyId) {
  if (companyId == null || !String(companyId).trim()) {
    throw new Error('A company ID is required to load company members.')
  }
  return `/company/${encodeURIComponent(String(companyId))}/members`
}

function responseBody(response) {
  return response?.data ?? response
}

function userIdOf(value) {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  const id = value.id ?? value.user_id ?? value.userId ?? value.member_id
  return id == null ? null : String(id)
}

function normalizeUser(value) {
  if (!value || typeof value !== 'object') return null
  const user = value.user ?? value.member ?? value
  const id = userIdOf(user)
  if (!id) return null
  const name =
    user.name ??
    user.full_name ??
    user.fullName ??
    [user.first_name, user.last_name].filter(Boolean).join(' ') ??
    ''
  return {
    id,
    name: String(name).trim() || 'Member',
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? user.avatar ?? '',
  }
}

function recordsFrom(response) {
  const body = responseBody(response)
  const records = Array.isArray(body)
    ? body
    : (body?.direct_channels ??
      body?.directChannels ??
      body?.conversations ??
      body?.items ??
      body?.channels)
  if (!Array.isArray(records)) {
    throw new Error('The direct channels response does not contain a conversation list.')
  }
  return records
}

function recordFrom(response) {
  const body = responseBody(response)
  const record =
    body?.direct_channel ?? body?.directChannel ?? body?.conversation ?? body?.channel ?? body
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('The direct conversation response is invalid.')
  }
  return record
}

function normalizeMessage(message, index, conversationId) {
  const author = message.sender ?? message.author ?? message.user
  return {
    ...message,
    id: String(message.id ?? message.message_id ?? `${conversationId}-message-${index}`),
    from: userIdOf(author) ?? userIdOf(message.sender_id ?? message.author_id ?? message.user_id),
    text: String(message.text ?? message.content ?? message.body ?? ''),
    createdAt: message.created_at ?? message.createdAt ?? message.timestamp ?? '',
  }
}

function normalizeDirectChannel(raw, currentUserId) {
  const record = recordFrom(raw)
  const id = record.id ?? record.channel_id ?? record.direct_channel_id
  if (id == null) throw new Error('A direct conversation is missing its channel ID.')

  const memberRecords =
    record.members ?? record.participants ?? record.users ?? record.member_users ?? []
  const members = Array.isArray(memberRecords) ? memberRecords.map(userIdOf).filter(Boolean) : []
  const partner = normalizeUser(
    record.other_user ?? record.otherUser ?? record.recipient ?? record.partner ?? record.user,
  )
  if (partner && !members.includes(partner.id)) members.push(partner.id)
  if (currentUserId && !members.includes(String(currentUserId)))
    members.unshift(String(currentUserId))

  const rawMessages = record.messages ?? record.latest_messages ?? []
  if (!Array.isArray(rawMessages)) {
    throw new Error(`Messages for direct conversation ${id} must be a list.`)
  }

  const users = (Array.isArray(memberRecords) ? memberRecords : [])
    .map(normalizeUser)
    .filter(Boolean)
  if (partner && !users.some((user) => user.id === partner.id)) users.push(partner)

  const latestMessage = record.last_message ?? record.lastMessage
  const messages = latestMessage && !rawMessages.length ? [latestMessage] : rawMessages

  return {
    conversation: {
      id: String(id),
      type: 'dm',
      members,
      name: String(record.name ?? record.title ?? ''),
      unreadCount: Number(record.unread_count ?? record.unreadCount ?? 0) || 0,
      isFavorite: Boolean(record.is_favorite ?? record.isFavorite),
      messages: messages.map((message, index) => normalizeMessage(message, index, String(id))),
    },
    users,
  }
}

export const dmApi = {
  meId: () => getAuthUserId(),
  listCompanyMembers(companyId) {
    return apiRequest(companyMembersPath(companyId)).then((response) =>
      normalizeMembers(response).map((member) => ({
        id: String(member.userId ?? member.id),
        name: member.name,
        email: member.email,
        avatarUrl: member.avatar ?? '',
      })),
    )
  },
  listTeamMembers(teamId) {
    return getMembers(teamId).then((members) =>
      members.map((member) => ({
        id: String(member.userId ?? member.id),
        name: member.name,
        email: member.email,
        avatarUrl: member.avatar ?? '',
      })),
    )
  },
  listTeamNonMembers(companyId, teamId) {
    return getNotMembers(companyId, teamId).then((members) =>
      members.map((member) => ({
        id: String(member.userId ?? member.id),
        name: member.name,
        email: member.email ?? '',
        avatarUrl: member.avatarUrl ?? member.avatar ?? '',
      })),
    )
  },
  listDirectChannels(companyId) {
    return apiRequest(directChannelsPath(companyId)).then((response) =>
      recordsFrom(response).map((record) => normalizeDirectChannel(record, getAuthUserId())),
    )
  },
  getDirectChannel(companyId, channelId) {
    return apiRequest(directChannelPath(companyId, channelId)).then((response) =>
      normalizeDirectChannel(response, getAuthUserId()),
    )
  },
  createDirectChannel(companyId, payload) {
    return apiRequest(directChannelsPath(companyId), {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => normalizeDirectChannel(response, getAuthUserId()))
  },
}
