import { apiRequest } from '@/lib/api/client'
import { normalizeMessageContent } from '@/features/messages/message-utils'

const encode = encodeURIComponent

// TODO: Group DM ka endpoint abhi nahi mila. Backend se confirm karke yahan badlein.
const groupChannelsPath = (companyId) => `/v1/${encode(companyId)}/group-channels`

// Direct channel ke messages: /v1/{company}/direct-channels/{channel}/messages
const messagesPath = (companyId, channelId) =>
  `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}/messages`

// ---- validation (sync throw, request se pehle) ----
function requireCompany(companyId, action = 'load direct channels') {
  if (!companyId) throw new Error(`A company ID is required to ${action}.`)
}
function requireChannel(channelId) {
  if (!channelId) throw new Error('A channel ID is required to load a direct conversation.')
}
function requireTeam(teamId) {
  if (!teamId) throw new Error('A team ID is required to load team members.')
}
function requireMessage(messageId) {
  if (!messageId) throw new Error('A message ID is required.')
}

// ---- current user (login ke baad sessionStorage mein hota hai) ----
function currentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('authUser') ?? 'null')
  } catch {
    return null
  }
}
function meId() {
  const user = currentUser()
  const id = [
    user?.id,
    user?.user_id,
    user?.userId,
    user?._id,
    user?.uuid,
    user?.sub,
    user?.user?.id,
  ].find((value) => value != null && value !== '')
  return id == null ? '' : String(id)
}

// ---- response helpers ----
export function unwrap(response) {
  if (response && response.success === false) {
    throw Object.assign(new Error(response.message || 'Request failed.'), { details: response })
  }
  return response && 'data' in response ? response.data : response
}

function membersFrom(data) {
  const list = Array.isArray(data)
    ? data
    : (data?.members ??
      data?.teamusers?.members ??
      data?.companyusers?.members ??
      data?.notteamusers?.members ??
      data?.users ??
      [])
  return Array.isArray(list) ? list : []
}

function messagesFrom(data) {
  const list = Array.isArray(data) ? data : (data?.messages ?? data?.direct_messages ?? [])
  return Array.isArray(list) ? list : []
}

function messageFrom(data) {
  return data?.message ?? data?.direct_message ?? data
}

function nameOf(source = {}) {
  return (
    source.name ??
    source.full_name ??
    source.fullName ??
    source.display_name ??
    source.username ??
    ([source.first_name, source.last_name].filter(Boolean).join(' ') || undefined)
  )
}

function customStatusOf(raw, user) {
  const value = raw.customStatus ?? raw.custom_status ?? user.customStatus ?? user.custom_status
  const status = value && typeof value === 'object' ? value : {}
  const text =
    (typeof value === 'string' ? value : (status.text ?? status.status_text)) ??
    raw.customStatusText ??
    raw.custom_status_text ??
    user.customStatusText ??
    user.custom_status_text ??
    ''
  const emoji =
    raw.customStatusEmoji ??
    raw.custom_status_emoji ??
    user.customStatusEmoji ??
    user.custom_status_emoji ??
    status.emoji ??
    ''
  return text || emoji ? { emoji, text } : null
}

function objectEntriesDeep(value, entries = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return entries
  seen.add(value)
  entries.push(value)
  for (const nested of Object.values(value)) objectEntriesDeep(nested, entries, seen)
  return entries
}

export function normalizePublicCustomStatus(response, userId) {
  const entries = objectEntriesDeep(response)
  const candidate = entries.find((entry) =>
    [
      'customStatus',
      'custom_status',
      'customStatusText',
      'custom_status_text',
      'customStatusEmoji',
      'custom_status_emoji',
    ].some((key) => entry[key] != null),
  )
  const customStatus = candidate ? customStatusOf(candidate, {}) : null
  return {
    id: String(userId),
    customStatus,
    customStatusLoaded: true,
  }
}

function normalizeUser(raw) {
  if (raw == null) return { id: '', name: '', email: '', avatarUrl: '' }
  // Sirf id aayi ho (string/number)
  if (typeof raw !== 'object') return { id: String(raw), name: '', email: '', avatarUrl: '' }

  const user = raw.user && typeof raw.user === 'object' ? raw.user : {}
  const customStatus = customStatusOf(raw, user)
  return {
    id: String(user.id ?? raw.user_id ?? raw.id ?? ''),
    name: nameOf(raw) ?? nameOf(user) ?? '',
    email: raw.email ?? user.email ?? raw.account?.email ?? user.account?.email ?? '',
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? user.avatar_url ?? user.avatarUrl ?? '',
    ...(customStatus ? { customStatus } : {}),
  }
}

function normalizeMembers(response) {
  return membersFrom(unwrap(response))
    .map(normalizeUser)
    .filter((user) => user.id)
}

function normalizeParticipant(raw) {
  const user = normalizeUser(raw)
  const { id, name, email, avatarUrl, customStatus } = user
  return {
    id,
    name,
    avatarUrl,
    ...(email ? { email } : {}),
    ...(customStatus ? { customStatus, customStatusLoaded: true } : {}),
  }
}

export function normalizeMessage(raw) {
  const message =
    raw.message && typeof raw.message === 'object'
      ? { ...raw.message, voice_note: raw.voice_note ?? raw.message.voice_note }
      : raw
  const sender = message.sender ?? message.user ?? message.author
  const forwardedFrom =
    message.forwarded_from ??
    message.forwardedFrom ??
    message.forwarded?.from ??
    message.metadata?.forwardedFrom ??
    (message.is_forwarded || message.isForwarded || message.forwarded === true ? true : undefined)
  const editedAt =
    message.edited_at ??
    message.editedAt ??
    (message.updated_at && message.updated_at !== message.created_at
      ? message.updated_at
      : undefined)
  const attachment = message.attachments ?? message.attachment
  const attachments = Array.isArray(attachment) ? attachment : attachment ? [attachment] : []
  const voiceNoteId =
    message.voice_note_id ??
    message.voiceNoteId ??
    message.voice_note?.voice_note_id ??
    message.voice_note?.id ??
    sender?.voice_note?.voice_note_id ??
    sender?.voice_note?.id
  return {
    ...message,
    id: String(message.id ?? message.message_id ?? message.messageId),
    backendSynced: true,
    from: String(
      message.sender_id ??
        message.user_id ??
        message.from ??
        (sender && typeof sender === 'object' ? sender.id : '') ??
        '',
    ),
    text: normalizeMessageContent(message.content ?? message.text ?? message.body ?? ''),
    createdAt: message.created_at ?? message.createdAt ?? '',
    ...(attachments.length ? { attachments } : {}),
    ...(voiceNoteId ? { voiceNoteId: String(voiceNoteId) } : {}),
    ...(forwardedFrom ? { forwardedFrom } : {}),
    // Edit hua ho to "edited" dikhane ke liye (dusre user ko bhi)
    ...(editedAt ? { editedAt } : {}),
  }
}

// Backend ka exact shape alag ho sakta hai, isliye participants kai jagah se dhoondte hain
function participantsOf(channel) {
  const list =
    [
      channel.participants,
      channel.members,
      channel.users,
      channel.participant_ids,
      channel.member_ids,
      channel.user_ids,
    ].find((value) => Array.isArray(value) && value.length) ?? []
  const singles = [
    channel.other_user,
    channel.otherUser,
    channel.recipient,
    channel.receiver,
    channel.partner,
    channel.user,
    channel.user1,
    channel.user2,
    channel.user_one,
    channel.user_two,
    channel.recipient_id,
    channel.receiver_id,
    channel.other_user_id,
    channel.user1_id,
    channel.user2_id,
  ].filter((value) => value != null && value !== '')
  return [...list, ...singles]
}

function normalizeChannel(channel, forcedType) {
  const rawMessages = channel.messages ?? []
  const messages = rawMessages.map(normalizeMessage)

  const byId = new Map()
  const add = (participant) => {
    if (participant.id && !byId.has(participant.id)) byId.set(participant.id, participant)
  }
  participantsOf(channel).map(normalizeParticipant).forEach(add)
  for (const raw of rawMessages) {
    const sender = raw.sender ?? raw.user ?? raw.author
    if (sender && typeof sender === 'object') add(normalizeParticipant(sender))
  }
  const participants = [...byId.values()]

  // Message bhejne wale bhi conversation ke member hain
  const members = [
    ...new Set(
      [meId(), ...participants.map((p) => p.id), ...messages.map((m) => m.from)].filter(Boolean),
    ),
  ]

  return {
    conversation: {
      id: String(channel.id),
      type: forcedType ?? (members.length > 2 ? 'group' : 'dm'),
      members,
      name: channel.name ?? channel.title ?? '',
      unreadCount: channel.unread_count ?? channel.unreadCount ?? 0,
      isFavorite: channel.is_favorite ?? channel.isFavorite ?? false,
      messages,
    },
    users: participants,
  }
}

function channelFrom(data) {
  return data?.direct_channel ?? data?.group_channel ?? data?.channel ?? data
}

export const dmApi = {
  meId,
  currentUser,

  // GET /company/{company}/members
  listCompanyMembers(companyId) {
    requireCompany(companyId, 'load company members')
    return apiRequest(`/company/${encode(companyId)}/members`).then(normalizeMembers)
  },

  // GET /v1/{company}/teams/{team}/members
  listTeamMembers(companyId, teamId) {
    requireCompany(companyId, 'load team members')
    requireTeam(teamId)
    return apiRequest(`/v1/${encode(companyId)}/teams/${encode(teamId)}/members`).then(
      normalizeMembers,
    )
  },

  // GET /v1/{company}/teams/{team}/notmembers
  listTeamNonMembers(companyId, teamId) {
    requireCompany(companyId, 'load company members')
    requireTeam(teamId)
    return apiRequest(`/v1/${encode(companyId)}/teams/${encode(teamId)}/notmembers`).then(
      normalizeMembers,
    )
  },

  // GET /v1/{company}/direct-channels
  listDirectChannels(companyId) {
    requireCompany(companyId)
    return apiRequest(`/v1/${encode(companyId)}/direct-channels`).then((response) => {
      const data = unwrap(response)
      const list = Array.isArray(data) ? data : (data?.direct_channels ?? data?.channels)
      if (!Array.isArray(list)) {
        throw new Error('The direct channels response does not contain a conversation list.')
      }
      return list.map((channel) => normalizeChannel(channel))
    })
  },

  // POST /v1/{company}/direct-channels  (1-to-1)
  createDirectChannel(companyId, payload) {
    requireCompany(companyId)
    return apiRequest(`/v1/${encode(companyId)}/direct-channels`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => normalizeChannel(channelFrom(unwrap(response))))
  },

  // Group DM (endpoint upar groupChannelsPath mein badlein)
  createGroupChannel(companyId, payload) {
    requireCompany(companyId, 'create a group conversation')
    return apiRequest(groupChannelsPath(companyId), {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => normalizeChannel(channelFrom(unwrap(response)), 'group'))
  },

  // GET /v1/{company}/direct-channels/{channel}
  getDirectChannel(companyId, channelId) {
    requireCompany(companyId)
    requireChannel(channelId)
    return apiRequest(`/v1/${encode(companyId)}/direct-channels/${encode(channelId)}`).then(
      (response) => normalizeChannel(channelFrom(unwrap(response))),
    )
  },

  // ---------------- Messages ----------------

  // GET /v1/{company}/direct-channels/{channel}/messages
  listMessages(companyId, channelId) {
    requireCompany(companyId, 'load messages')
    requireChannel(channelId)
    return apiRequest(messagesPath(companyId, channelId)).then((response) =>
      messagesFrom(unwrap(response)).map(normalizeMessage),
    )
  },

  // GET /v1/{company}/direct-channels/{channel}/messages/{message}
  getMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'load a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}`).then(
      (response) => normalizeMessage(messageFrom(unwrap(response))),
    )
  },

  // POST /v1/{company}/direct-channels/{channel}/messages
  sendMessage(companyId, channelId, payload) {
    requireCompany(companyId, 'send a message')
    requireChannel(channelId)
    //console.log('sendMessage payload:', payload);
    if ('attachments' in payload) {
      throw new Error('Only one message attachment is supported.')
    }
    const voiceNoteId = payload.voice_note_id ?? payload.voiceNoteId
    const body = payload.body
    const attachment = payload.attachment
    if (attachment != null && (typeof Blob === 'undefined' || !(attachment instanceof Blob))) {
      throw new Error('Message attachment must be a file.')
    }
    const requestPayload = {
      ...payload,
      body: voiceNoteId && !String(body ?? '').trim() ? 'Voice message' : body,
      ...(voiceNoteId ? { voice_note_id: String(voiceNoteId) } : {}),
    }
    if (attachment) {
      const formData = new FormData()
      if (requestPayload.body?.trim()) formData.append('body', requestPayload.body.trim())
      formData.append('attachment', attachment)
      Object.entries(requestPayload).forEach(([key, value]) => {
        if (key === 'body' || key === 'attachment' || value == null) return
        const formValue =
          typeof value === 'boolean'
            ? value
              ? '1'
              : '0'
            : typeof value === 'string'
              ? value
              : JSON.stringify(value)
        formData.append(key, formValue)
      })
      return apiRequest(messagesPath(companyId, channelId), {
        method: 'POST',
        body: formData,
      }).then((response) => normalizeMessage(messageFrom(unwrap(response))))
    }
    return apiRequest(messagesPath(companyId, channelId), {
      method: 'POST',
      body: JSON.stringify(requestPayload),
    }).then((response) => normalizeMessage(messageFrom(unwrap(response))))
  },

  // PATCH /v1/{company}/direct-channels/{channel}/messages/{message}
  updateMessage(companyId, channelId, messageId, payload) {
    requireCompany(companyId, 'update a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((response) => {
      const data = messageFrom(unwrap(response))
      return data && typeof data === 'object' && data.id ? normalizeMessage(data) : null
    })
  },

  // DELETE /v1/{company}/direct-channels/{channel}/messages/{message}
  deleteMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'delete a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}`, {
      method: 'DELETE',
    }).then(unwrap)
  },

  listPinnedMessages(companyId, channelId, messageId) {
    requireCompany(companyId, 'load pinned messages')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(
      `${messagesPath(companyId, channelId)}/${encode(messageId)}/pinned-messages`,
    ).then(unwrap)
  },

  pinMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'pin a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}/pin`, {
      method: 'POST',
    }).then(unwrap)
  },

  unpinMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'unpin a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}/pin`, {
      method: 'DELETE',
    }).then(unwrap)
  },

  // Presence ka abhi koi API endpoint nahi hai. Mock data hata diya gaya hai,
  // isliye khali object (sab offline, apna user online). Endpoint mile to yahan lagayein.
  presence() {
    return Promise.resolve({})
  },
}
