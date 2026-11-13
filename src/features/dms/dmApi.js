import { apiRequest } from '@/lib/api/client'
import { normalizeMessageContent } from '@/features/messages/message-utils'
import { normalizeMessageAttachments } from '@/features/messages/messageAttachments'
import { getAuthUser, getAuthUserId } from '@/features/auth/session'

const encode = encodeURIComponent

// TODO: Group DM ka endpoint abhi nahi mila. Backend se confirm karke yahan badlein.
const groupChannelsPath = (companyId) => `/v1/${encode(companyId)}/group-channels`

// Direct channel ke messages: /v1/{company}/direct-channels/{channel}/messages
const messagesPath = (companyId, channelId) =>
  `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}/messages`

// PATCH /v1/{company}/direct-channels/{channel}/recent: DM ko "abhi istemal hua" mark karo
const recentPath = (companyId, channelId) =>
  `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}/recent`
// Request body: backend `is_recent` (required) mangta hai: { is_recent: true }
// (`at` sirf local tarteeb ke liye store mein rehta hai, server ko nahi jata)
export function recentBody() {
  return { is_recent: true }
}
// Server ka jawab (channel object / { data } / 204): recent ka waqt jo bhi naam ho
export function recentAtOf(raw) {
  if (!raw || typeof raw !== 'object') return ''
  const recent = raw.recent ?? raw.channel ?? raw
  const value =
    recent.recent_at ??
    recent.recentAt ??
    recent.last_recent_at ??
    recent.lastRecentAt ??
    recent.last_opened_at ??
    recent.lastOpenedAt ??
    recent.last_viewed_at ??
    recent.lastViewedAt ??
    recent.last_accessed_at ??
    recent.opened_at ??
    recent.updated_at ??
    recent.updatedAt ??
    recent.created_at ??
    recent.createdAt
  return typeof value === 'string' ? value : ''
}

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
function requireUser(userId) {
  if (!userId) throw new Error('A user ID is required for the user status.')
}

function currentUser() {
  const user = getAuthUser()
  if (user && typeof user === 'object') return user
  try {
    return JSON.parse(sessionStorage.getItem('authUser') ?? 'null')
  } catch {
    return null
  }
}
function meId() {
  const storedId = getAuthUserId()
  if (storedId) return storedId

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

// ---- DM-only request layer: 204 No Content / khali body ----
// Shared apiRequest (lib/api/client) channels bhi use karte hain, isliye use nahi chheda.
// PATCH / PUT / POST / DELETE ka khali jawab (204, '' ya undefined) = kamyabi -> null.
// Agar shared client 204 par response.json() chala kar SyntaxError de, wo bhi kamyabi (sirf in methods par).
const EMPTY_BODY_ERROR = /unexpected end of json|end of data|json input|no content/i
function isEmptyBodySuccess(error) {
  const status = Number(error?.status ?? error?.response?.status ?? error?.statusCode ?? 0)
  if (status === 204 || status === 205) return true
  if (status && (status < 200 || status >= 300)) return false
  return error instanceof SyntaxError || EMPTY_BODY_ERROR.test(String(error?.message ?? ''))
}
function dmRequest(path, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase()
  return Promise.resolve(apiRequest(path, options)).then(
    (response) => (response === undefined || response === '' ? null : response),
    (error) => {
      if (method !== 'GET' && isEmptyBodySuccess(error)) return null
      throw error // 4xx / 5xx / network: asli failure
    },
  )
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

// Seedha array ya paginated ({ data: [...] }, Laravel jaisa) dono chalte hain
function listFrom(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return null
}

function messagesFrom(data) {
  return listFrom(data) ?? listFrom(data?.messages) ?? listFrom(data?.direct_messages) ?? []
}

function directChannelsFrom(value, depth = 0) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object' || depth >= 6) return null

  for (const key of ['direct_channels', 'directChannels', 'channels', 'items']) {
    if (value[key] !== undefined) {
      const channels = directChannelsFrom(value[key], depth + 1)
      if (channels) return channels
    }
  }
  for (const key of ['data', 'result', 'payload']) {
    if (value[key] !== undefined) {
      const channels = directChannelsFrom(value[key], depth + 1)
      if (channels) return channels
    }
  }
  return null
}

// Paginated jawab se: aur purane messages hain? (Laravel paginate / meta / links / has_more)
function paginationOf(data, page) {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const nested = d.messages && !Array.isArray(d.messages) ? d.messages : null
  // Backend: data.pagination = { current_page, per_page, total, last_page, has_more_pages }
  for (const m of [d.pagination, d, d.meta, nested, nested?.meta].filter(Boolean)) {
    const lastPage = m.last_page != null ? Number(m.last_page) : null
    const more = m.has_more_pages ?? m.has_more
    if (more != null)
      return { page: Number(m.current_page ?? page), hasMore: Boolean(more), lastPage }
    if (lastPage != null && m.current_page != null) {
      return { page: Number(m.current_page), hasMore: Number(m.current_page) < lastPage, lastPage }
    }
    if ('next_page_url' in m) {
      return { page: Number(m.current_page ?? page), hasMore: Boolean(m.next_page_url), lastPage }
    }
  }
  const links = d.links ?? nested?.links
  if (links && !Array.isArray(links) && 'next' in links) {
    return { page, hasMore: Boolean(links.next), lastPage: null }
  }
  return { page, hasMore: null, lastPage: null }
}

// Purane se naye: backend naye pehle bheje tab bhi chat sahi tarteeb mein
// Ek hi second mein bheje gaye messages: id se tarteeb (backend ki id waqt ke saath badhti hai)
export function byTime(a, b) {
  const x = Date.parse(a.createdAt)
  const y = Date.parse(b.createdAt)
  if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y
  return idOrder(a.id, b.id)
}
function idOrder(a, b) {
  const x = String(a ?? '')
  const y = String(b ?? '')
  if (x.startsWith('local-') || y.startsWith('local-')) return 0
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y)
  if (x.length === y.length) return x < y ? -1 : x > y ? 1 : 0
  return 0
}

// Reactions ko ek shape mein lao: [{ emoji, users: [userId] }]
// Backend ki ye sab shapes samajh aati hain:
//   [{ emoji|reaction|name|type: '👍', users|user_ids: [...] }]     (grouped)
//   [{ reaction: '👍', user_id | user: { id } }]                     (har user ki alag row)
//   [{ reaction: '👍', count: 2, reacted|me|is_mine: true }]          (sirf ginti)
//   { '👍': ['u1', 'u2'] }  ya  { '👍': 2 }                            (object)
export function normalizeReactions(raw) {
  let items = raw
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    items = Object.entries(raw).map(([emoji, value]) =>
      Array.isArray(value)
        ? { emoji, users: value }
        : typeof value === 'object' && value
          ? { emoji, ...value }
          : { emoji, count: value },
    )
  }
  if (!Array.isArray(items)) return []
  const me = meId()
  const byEmoji = new Map()
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    let emoji = item.emoji ?? item.reaction ?? item.name ?? item.type ?? item.emoji_code
    // emoji khud object ho: { emoji: { native: '👍' } } / { reaction: { emoji: '👍' } }
    if (emoji && typeof emoji === 'object') {
      // backend: { reaction: { data: '🙃', category, aliases } }
      emoji =
        emoji.data ??
        emoji.emoji ??
        emoji.native ??
        emoji.char ??
        emoji.i ??
        emoji.reaction ??
        emoji.name
    }
    if (!emoji || typeof emoji !== 'string') continue
    const entry = byEmoji.get(emoji) ?? { emoji, users: [] }
    const list =
      item.users ??
      item.user_ids ??
      item.userIds ??
      item.reacted_by ??
      item.reacted_users ??
      item.reactors
    let ids = list
    if (!Array.isArray(ids)) {
      const user = item.user
      const one = item.user_id ?? item.userId ?? (user && typeof user === 'object' ? user.id : user)
      ids = one != null ? [one] : []
    }
    const before = entry.users.length
    for (const user of ids) {
      const id = String(
        user && typeof user === 'object' ? (user.id ?? user.user_id ?? '') : (user ?? ''),
      )
      if (id && !entry.users.includes(id)) entry.users.push(id)
    }
    // Sirf ginti mili (user ids nahi): apna reaction + baaki ke liye nishaan
    const mine = item.reacted ?? item.me ?? item.is_mine ?? item.has_reacted ?? item.reacted_by_me
    if (mine === true && me && !entry.users.includes(me)) entry.users.push(me)
    const count = Number(item.count ?? item.total ?? item.reactions_count)
    for (let n = entry.users.length; Number.isFinite(count) && n < count; n += 1) {
      entry.users.push(`${emoji}#${n + 1}`)
    }
    // Ek row = ek reaction (user ka pata nahi): ginti mein 1
    if (entry.users.length === before && !Array.isArray(list) && !Number.isFinite(count)) {
      entry.users.push(`${emoji}#${entry.users.length + 1}`)
    }
    byEmoji.set(emoji, entry)
  }
  return [...byEmoji.values()].filter((entry) => entry.users.length)
}

// Data tha lekin ek bhi reaction samajh na aaya: "khali" nahi, "pata nahi" (null).
// Taake screen wale reactions na mitein. Console mein data dikhta hai (shape batane ke liye).
let warnedUnknownShape = false
export function parseReactions(raw) {
  if (!raw || typeof raw !== 'object') return null
  const hasData = Array.isArray(raw) ? raw.length > 0 : Object.keys(raw).length > 0
  const parsed = normalizeReactions(raw)
  if (hasData && !parsed.length) {
    if (!warnedUnknownShape && typeof console !== 'undefined') {
      warnedUnknownShape = true
      console.warn('[dms] Reactions ki shape samajh nahi aayi. Ye data developer ko bhejein:', raw)
    }
    return null
  }
  return parsed
}

// Message par reactions: samajh aaye to { reactions }, na aaye to reactions hata do
// (undefined: store pichle/screen wale reactions hi rakhta hai, kachcha data UI tak nahi jata)
function reactionsField(raw) {
  const parsed = parseReactions(reactionsOf(raw))
  if (parsed) return { reactions: parsed }
  return 'reactions' in raw ? { reactions: undefined } : {}
}

// Message ke reactions kis naam se aayein (backend ke mutabiq)
// Backend: { "message-reaction": { message_id, reactions: [ { reaction: { data: '🙃' }, user_ids: [...] } ] } }
export function reactionsOf(raw) {
  if (!raw || typeof raw !== 'object') return undefined
  const found =
    raw.reactions ??
    raw['message-reaction'] ??
    raw.message_reaction ??
    raw.messageReaction ??
    raw.message_reactions ??
    raw.reactions_summary ??
    raw.reaction_counts
  // { message_id, reactions: [...] } wala object ho to uske andar ki list
  if (
    found &&
    !Array.isArray(found) &&
    typeof found === 'object' &&
    Array.isArray(found.reactions)
  ) {
    return found.reactions
  }
  return found
}

function messageFrom(data) {
  return data?.message ?? data?.direct_message ?? data?.data ?? data
}

// Jawab mein asli message (id ke saath) ho to normalize, warna null (throw nahi:
// POST kamyab ho chuki hai, "Not sent" dikhana / dobara bhejna galat hoga)
function messageOrNull(data) {
  const raw = messageFrom(data)
  return raw && typeof raw === 'object' && raw.id != null ? normalizeMessage(raw) : null
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
  const expiresAt =
    status.expiresAt ??
    status.expires_at ??
    raw.customStatusExpiresAt ??
    raw.custom_status_expires_at ??
    user.customStatusExpiresAt ??
    user.custom_status_expires_at
  return text || emoji
    ? {
        emoji,
        text,
        ...(expiresAt != null ? { expiresAt } : {}),
      }
    : null
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

// DM list ke participants: status_mode ho to online/away/offline bhi (presence isse live hota hai)
function normalizeParticipant(raw) {
  const user = normalizeUser(raw)
  const { id, name, email, avatarUrl, customStatus } = user
  const presence = presenceStateOf(raw)
  return {
    id,
    name,
    avatarUrl,
    ...(email ? { email } : {}),
    ...(customStatus ? { customStatus, customStatusLoaded: true } : {}),
    ...(presence ? { presence } : {}),
    ...(lastSeenOf(raw) ? { lastSeenAt: lastSeenOf(raw) } : {}),
  }
}

// Message text mein HTML aa jaye (`<p>hi</p>` ya `&lt;p&gt;hi&lt;/p&gt;`) to screen par tags na dikhein:
// saaf text (line breaks ke saath). Aam text ko nahi chhedta.
const HTML_TAG =
  /<\/?(p|br|div|span|strong|b|em|i|u|s|strike|del|ul|ol|li|code|pre|blockquote|a|h[1-6])\b[^>]*>/i
function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
export function htmlToPlainText(value) {
  if (typeof value !== 'string' || !value) return value
  let text = value
  if (!HTML_TAG.test(text) && /&lt;\/?[a-z]/i.test(text)) text = decodeEntities(text)
  if (!HTML_TAG.test(text)) return value
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Forward ka invisible nishan (text ke shuru mein). Backend is_forwarded save na kare tab bhi
// doosre user ko "(forwarded)" dikhe. Screen par nazar nahi aata. dms.js mein bhi yahi string hai.
export const FORWARD_MARK = '\u2063\u200b\u2063'

// Thread (Reply Thread card) ka reply: main chat mein alag message nahi dikhna chahiye
function parentIdOf(raw) {
  const id =
    raw.parent_id ??
    raw.parentId ??
    raw.parent_message_id ??
    raw.parentMessageId ??
    raw.thread_parent_id ??
    raw.reply_parent_id ??
    // DM mein quote-reply backend par nahi jata, isliye reply_to* = thread ka reply
    raw.reply_to_id ??
    raw.reply_to_message_id ??
    raw.replied_to_id ??
    raw.in_reply_to ??
    raw.thread_id ??
    raw.threadId ??
    (raw.reply_to && typeof raw.reply_to === 'object' ? raw.reply_to.id : raw.reply_to) ??
    (raw.parent && typeof raw.parent === 'object' ? raw.parent.id : raw.parent)
  if (id != null && id !== '') return String(id)
  // Sirf "yeh reply hai" ka nishan (parent ka pata nahi): chat mein phir bhi na dikhe
  const kind = String(raw.type ?? raw.message_type ?? '').toLowerCase()
  if (raw.is_reply === true || raw.is_reply === 1 || kind === 'reply' || kind === 'thread_reply')
    return '?'
  return undefined
}

// "[Forwarded] hi" -> text "hi" + forwardedFrom (dono users ko message ke neeche "(forwarded)")
const FORWARD_PREFIX_RE = /^\s*\[forwarded\]\s*/i
function forwardedText(text, marked, raw) {
  const value = String(text ?? '')
  const prefixed = FORWARD_PREFIX_RE.test(value)
  return {
    text: prefixed ? value.replace(FORWARD_PREFIX_RE, '') : value,
    ...((marked || prefixed) && !raw.forwarded_from ? { forwardedFrom: 'forwarded' } : {}),
  }
}

function booleanValue(value) {
  return value === true || value === 1 || ['1', 'true'].includes(String(value).toLowerCase())
}

function deletionFlag(...values) {
  return values.some((value) => {
    if (value === true || value === 1) return true
    if (typeof value !== 'string') return false
    return ['1', 'true', 'yes', 'deleted'].includes(value.trim().toLowerCase())
  })
}

function isDeletedMessage(...records) {
  return records.some((record) => {
    if (!record || typeof record !== 'object') return false
    const status = String(record.status ?? record.message_status ?? '')
      .trim()
      .toLowerCase()
    const text = String(record.content ?? record.text ?? record.body ?? '')
    const deletionTimestamp = [
      record.deleted_at,
      record.deletedAt,
      record.deleted_on,
      record.deletedOn,
      record.deleted_at_utc,
    ].some((value) => value != null && value !== '')
    const deletedBy = [record.deleted_by, record.deletedBy].some(
      (value) => value != null && value !== '' && value !== false && value !== 0 && value !== '0',
    )
    return (
      deletionTimestamp ||
      deletedBy ||
      deletionFlag(
        record.is_deleted,
        record.isDeleted,
        record.deleted,
        record.is_delete,
        record.isDelete,
        record.message_deleted,
        record.messageDeleted,
      ) ||
      ['deleted', 'soft_deleted', 'soft-deleted'].includes(status) ||
      /^\s*(this message (was|has been) deleted|message deleted)\.?\s*$/i.test(text)
    )
  })
}

export function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') raw = { id: raw }
  const message = raw.message ?? raw.direct_message ?? raw
  const sender = message.sender ?? message.user ?? message.author
  const voiceNote =
    message.voice_note ??
    message.voiceNote ??
    sender?.voice_note ??
    sender?.voiceNote ??
    raw.voice_note ??
    raw.voiceNote ??
    raw.sender?.voice_note ??
    raw.sender?.voiceNote
  const voiceNoteId =
    message.voice_note_id ??
    message.voiceNoteId ??
    (typeof voiceNote === 'string' || typeof voiceNote === 'number'
      ? voiceNote
      : (voiceNote?.id ?? voiceNote?.voice_note_id ?? voiceNote?.voiceNoteId)) ??
    raw.voice_note_id ??
    raw.voiceNoteId
  const attachments = normalizeMessageAttachments(message)
  const rawText = String(message.content ?? message.text ?? message.body ?? '')
  const markedForward = rawText.includes(FORWARD_MARK)
  const parentId = parentIdOf(message)
  const forwardedFrom =
    message.forwarded_from ??
    message.forwardedFrom ??
    message.forwarded?.from ??
    message.metadata?.forwardedFrom ??
    (message.is_forwarded || message.isForwarded || message.forwarded === true
      ? 'forwarded'
      : undefined)
  const normalized = {
    ...raw,
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
    ...forwardedText(
      normalizeMessageContent(
        htmlToPlainText(markedForward ? rawText.split(FORWARD_MARK).join('') : rawText),
      ),
      markedForward,
      message,
    ),
    ...((message.isCode ?? message.is_code) != null
      ? { isCode: booleanValue(message.isCode ?? message.is_code) }
      : {}),
    createdAt: message.created_at ?? message.createdAt ?? '',
    ...(attachments.length ? { attachments } : {}),
    ...(forwardedFrom ? { forwardedFrom } : {}),
    ...(voiceNoteId != null ? { voiceNoteId: String(voiceNoteId) } : {}),
    ...(parentId ? { parentId } : {}),
  }

  if (message.sender_id != null) normalized.sender_id = message.sender_id
  if (message.user_id != null) normalized.user_id = message.user_id
  if (message.content != null && message.content !== '') normalized.content = message.content
  if (message.body != null && message.body !== '' && message.content == null)
    normalized.body = message.body

  const deleted = isDeletedMessage(message, raw)
  if (deleted) {
    normalized.deleted = true
    delete normalized.editedAt
    delete normalized.edited_at
  } else {
    const editedAt = editedAtOf(message)
    if (editedAt !== undefined) normalized.editedAt = editedAt
  }

  const reactions = reactionsField(message)
  if (reactions && Object.keys(reactions).length) Object.assign(normalized, reactions)

  if (
    message.is_forwarded === true ||
    message.is_forwarded === 1 ||
    message.forwarded_from_message_id ||
    message.forward_tag ||
    message.forwarded_from ||
    message.forwardedFrom ||
    message.isForwarded ||
    message.forwarded ||
    message.is_forward ||
    message.forwarded_message_id ||
    message.forward_from_message_id
  ) {
    normalized.forwardedFrom =
      message.forward_tag ||
      message.forwarded_from ||
      message.forwardedFrom ||
      normalized.forwardedFrom ||
      'forwarded'
  }

  const replyCount = replyCountOf(message)
  if (replyCount !== undefined) normalized.replyCount = replyCount

  const lastReplyAt = lastReplyAtOf(message)
  if (lastReplyAt !== undefined) normalized.lastReplyAt = lastReplyAt

  return normalized
}

function editedAtOf(raw) {
  const updatedAt = raw.updated_at ?? raw.updatedAt
  const createdAt = raw.created_at ?? raw.createdAt
  const updatedTime = Date.parse(updatedAt)
  const createdTime = Date.parse(createdAt)
  const materiallyUpdated =
    updatedAt != null &&
    updatedAt !== createdAt &&
    (!Number.isFinite(updatedTime) ||
      !Number.isFinite(createdTime) ||
      Math.abs(updatedTime - createdTime) >= 1000)
  return (
    raw.edited_at ??
    raw.editedAt ??
    (raw.is_edited === true || raw.edited === true
      ? (updatedAt ?? '')
      : materiallyUpdated
        ? updatedAt
        : undefined)
  )
}

function replyCountOf(raw) {
  const count = raw.replies_count ?? raw.reply_count ?? raw.replyCount
  if (count != null && Number.isFinite(Number(count))) return Number(count)
  return Array.isArray(raw.replies) ? raw.replies.length : undefined
}

function lastReplyAtOf(raw) {
  const explicit = raw.last_reply_at ?? raw.lastReplyAt
  if (explicit) return explicit
  const last = Array.isArray(raw.replies) ? raw.replies.at(-1) : null
  return last?.created_at ?? last?.createdAt ?? undefined
}

// ---- presence (online / away / offline) ----
// Abhi alag presence API nahi hai, isliye company members ke response mein jo field mile usse:
//   presence / online_status: "online" | "away" | "offline" | "dnd"
//   is_online / online:       true | false
//   last_seen_at / last_active_at: 2 min ke andar = online, 10 min ke andar = away
export const ONLINE_WINDOW_MS = 2 * 60 * 1000
export const AWAY_WINDOW_MS = 10 * 60 * 1000

export function presenceStateOf(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null
  const user = raw.user && typeof raw.user === 'object' ? raw.user : {}
  // Backend user mein: status_mode: "online" | "away" | "offline" | "dnd"
  const word = String(
    raw.status_mode ??
      user.status_mode ??
      raw.presence ??
      user.presence ??
      raw.online_status ??
      user.online_status ??
      '',
  ).toLowerCase()
  if (word === 'online' || word === 'active') return 'online'
  if (word === 'dnd') return 'dnd'
  if (word === 'away' || word === 'idle' || word === 'busy') return 'away'
  if (word === 'offline') return 'offline'

  const flag = raw.is_online ?? user.is_online ?? raw.online ?? user.online
  if (flag === true || flag === 1 || flag === '1') return 'online'
  if (flag === false || flag === 0 || flag === '0') return 'offline'

  const seen = lastSeenOf(raw)
  const ago = seen ? Number(now) - Date.parse(seen) : NaN
  if (!Number.isFinite(ago)) return null
  if (ago <= ONLINE_WINDOW_MS) return 'online'
  if (ago <= AWAY_WINDOW_MS) return 'away'
  return 'offline'
}

// "online" / "active" / true  ->  'online' ... (samajh na aaye to null)
export function normalizeState(value) {
  if (value === true || value === 1) return 'online'
  if (value === false || value === 0) return 'offline'
  const word = String(value ?? '')
    .trim()
    .toLowerCase()
  if (['online', 'active', 'available', '1', 'true'].includes(word)) return 'online'
  if (word === 'dnd') return 'dnd'
  if (['away', 'idle', 'busy'].includes(word)) return 'away'
  if (['offline', 'inactive', 'invisible', '0', 'false'].includes(word)) return 'offline'
  return null
}

// PUT/GET /v1/users/{user}/status ka jawab -> { state, status: { emoji, text }, lastSeenAt }
export function normalizeUserStatus(data) {
  if (data == null) return null
  const src =
    typeof data === 'object' ? (data.user_status ?? data.status_info ?? data) : { status: data }
  // Backend "mode" mein bhejta/leta hai: { mode: 'online', custom_status: { emoji, text } }
  const word =
    src.status_mode ??
    src.mode ??
    (typeof src.status === 'string' || typeof src.status === 'boolean'
      ? src.status
      : (src.state ?? src.presence ?? src.online_status ?? src.is_online))
  const state = normalizeState(word) ?? presenceStateOf(src)
  if (!state) return null
  const custom = src.custom_status && typeof src.custom_status === 'object' ? src.custom_status : {}
  const expiresAt = custom.expiresAt ?? custom.expires_at ?? src.custom_status_expires_at
  return {
    state,
    status: {
      emoji: custom.emoji ?? src.status_emoji ?? src.emoji ?? '',
      text:
        custom.text ??
        src.status_text ??
        (typeof src.custom_status === 'string' ? src.custom_status : undefined) ??
        src.text ??
        '',
      ...(expiresAt != null ? { expiresAt } : {}),
    },
    lastSeenAt: lastSeenOf(src) ?? undefined,
    changedAt: src.status_changed_at ?? undefined,
  }
}

function lastSeenOf(raw) {
  const user = raw.user && typeof raw.user === 'object' ? raw.user : {}
  return (
    raw.last_seen_at ??
    user.last_seen_at ??
    raw.last_active_at ??
    user.last_active_at ??
    raw.last_seen ??
    user.last_seen ??
    null
  )
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
  const rawMessages = [...(channel.messages ?? [])]
  // List mein sirf aakhri message aaye (last_message) to wo bhi (unread / notification ke liye)
  const last = channel.last_message ?? channel.latest_message ?? channel.lastMessage
  if (
    last &&
    typeof last === 'object' &&
    last.id != null &&
    !rawMessages.some((m) => String(m.id) === String(last.id))
  ) {
    rawMessages.push(last)
  }
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

  const recentValue = recentAtOf(channel)
  const lastActivityAt =
    channel.last_message_at ?? channel.last_activity_at ?? last?.created_at ?? ''
  const conversation = {
    id: String(channel.id),
    type: forcedType ?? (members.length > 2 ? 'group' : 'dm'),
    members,
    name: channel.name ?? channel.title ?? '',
    unreadCount: channel.unread_count ?? channel.unreadCount ?? 0,
    isFavorite: channel.is_favorite ?? channel.isFavorite ?? false,
    messages,
  }
  conversation.lastActivityAt = lastActivityAt
  if (recentValue) conversation.recentAt = recentValue

  return { conversation, users: participants }
}

// 204 / khali body: channel ka object nahi aaya -> null (store list dobara laa kar dhoondhta hai)
function channelOrNull(data, forcedType) {
  const channel = channelFrom(data)
  return channel && typeof channel === 'object' && channel.id != null
    ? normalizeChannel(channel, forcedType)
    : null
}

function channelFrom(data) {
  return data?.direct_channel ?? data?.group_channel ?? data?.channel ?? data
}

// GET /company/{company}/members sirf admins ke liye hai (403 "Only admins can see company
// members"). Ek dafa 403 aa jaye to us company ke liye dobara request nahi (laal errors band);
// users team members / members store se aate hain.
const forbiddenCompanies = new Set()
const httpStatus = (error) =>
  Number(
    error?.status ?? error?.response?.status ?? error?.details?.status ?? error?.statusCode ?? 0,
  )
const isForbidden = (error) =>
  httpStatus(error) === 403 ||
  /only admins/i.test(String(error?.message ?? error?.details?.message ?? ''))

function companyMembersRequest(companyId) {
  if (forbiddenCompanies.has(companyId))
    return Promise.resolve({ success: true, data: { members: [] } })
  return apiRequest(`/company/${encode(companyId)}/members`).catch((error) => {
    if (isForbidden(error)) {
      forbiddenCompanies.add(companyId)
      return { success: true, data: { members: [] } }
    }
    throw error
  })
}

export const dmApi = {
  meId,
  currentUser,

  // GET /company/{company}/members
  listCompanyMembers(companyId) {
    requireCompany(companyId, 'load company members')
    return companyMembersRequest(companyId).then(normalizeMembers)
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
      const list = directChannelsFrom(data)
      if (!Array.isArray(list)) {
        throw new Error('The direct channels response does not contain a conversation list.')
      }
      return list.map((channel) => normalizeChannel(channelFrom(channel)))
    })
  },

  // POST /v1/{company}/direct-channels  (1-to-1)
  createDirectChannel(companyId, payload) {
    requireCompany(companyId)
    return dmRequest(`/v1/${encode(companyId)}/direct-channels`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => channelOrNull(unwrap(response)))
  },

  // Group DM (endpoint upar groupChannelsPath mein badlein)
  createGroupChannel(companyId, payload) {
    requireCompany(companyId, 'create a group conversation')
    return dmRequest(groupChannelsPath(companyId), {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => channelOrNull(unwrap(response), 'group'))
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
  // page: 1 = sab se naye messages, 2 = us se purane ... (Laravel ?page=N)
  // Jawab array hai; list.pagination = { page, hasMore } (hasMore null = backend ne nahi bataya)
  listMessages(companyId, channelId, { page, query: searchQuery } = {}) {
    requireCompany(companyId, 'load messages')
    requireChannel(channelId)
    const query = new URLSearchParams()
    if (page && page > 1) query.set('page', String(page))
    if (searchQuery?.trim()) query.set('body', searchQuery.trim())
    const suffix = query.size ? `?${query}` : ''
    const path = `${messagesPath(companyId, channelId)}${suffix}`
    return apiRequest(path).then((response) => {
      const data = unwrap(response)
      const list = messagesFrom(data).map(normalizeMessage).sort(byTime)
      Object.defineProperty(list, 'pagination', { value: paginationOf(data, page ?? 1) })
      return list
    })
  },

  // GET /v1/{company}/direct-channels/{channel}/messages/{message}
  getMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'load a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return apiRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}`).then(
      (response) => messageOrNull(unwrap(response)),
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
    const { isCode, is_code, ...payloadFields } = payload
    const codeFlag = is_code ?? isCode
    const requestPayload = {
      ...payloadFields,
      body: voiceNoteId && !String(body ?? '').trim() ? 'Voice message' : body,
      ...(codeFlag !== undefined ? { is_code: booleanValue(codeFlag) } : {}),
      ...(voiceNoteId ? { voice_note_id: String(voiceNoteId) } : {}),
    }
    if (attachment) {
      const formData = new FormData()
      if (requestPayload.body?.trim()) formData.append('body', requestPayload.body.trim())
      const recentFile = requestPayload.attachmentSource === 'recent'
      formData.append(recentFile ? 'file' : 'attachment', attachment, attachment.name)
      if (recentFile) {
        formData.append('companyId', String(companyId))
        formData.append('chatId', String(channelId))
        formData.append('fileName', attachment.name)
      }
      Object.entries(requestPayload).forEach(([key, value]) => {
        if (
          key === 'body' ||
          key === 'attachment' ||
          key === 'attachmentSource' ||
          key === 'companyId' ||
          key === 'chatId' ||
          key === 'fileName' ||
          value == null
        ) {
          return
        }
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
      return dmRequest(messagesPath(companyId, channelId), {
        method: 'POST',
        body: formData,
      }).then((response) => messageOrNull(unwrap(response)))
    }
    return dmRequest(messagesPath(companyId, channelId), {
      method: 'POST',
      body: JSON.stringify(requestPayload),
    }).then((response) => messageOrNull(unwrap(response)))
  },

  // PATCH /v1/{company}/direct-channels/{channel}/messages/{message}
  updateMessage(companyId, channelId, messageId, payload) {
    requireCompany(companyId, 'update a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return dmRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((response) => messageOrNull(unwrap(response)))
  },

  // PATCH /v1/{company}/direct-channels/{channel}/recent
  // Jawab: server ka recent waqt ('' agar 204 / khali body / field na ho)
  markRecent(companyId, channelId, at = new Date().toISOString()) {
    requireCompany(companyId, 'mark a conversation as recent')
    requireChannel(channelId)
    return dmRequest(recentPath(companyId, channelId), {
      method: 'PATCH',
      body: JSON.stringify(recentBody(at)),
    }).then((response) => recentAtOf(unwrap(response)))
  },

  // DELETE /v1/{company}/direct-channels/{channel}/messages/{message}
  // Soft-delete so the other participant receives the deleted-message placeholder.
  deleteMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'delete a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return dmRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}`, {
      method: 'DELETE',
    }).then((response) => {
      const message = messageOrNull(unwrap(response))
      if (!message) return null
      message.deleted = true
      message.is_deleted = true
      delete message.editedAt
      delete message.edited_at
      return message
    })
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
    return dmRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}/pin`, {
      method: 'POST',
    }).then(unwrap)
  },

  unpinMessage(companyId, channelId, messageId) {
    requireCompany(companyId, 'unpin a message')
    requireChannel(channelId)
    requireMessage(messageId)
    return dmRequest(`${messagesPath(companyId, channelId)}/${encode(messageId)}/pin`, {
      method: 'DELETE',
    }).then(unwrap)
  },

  // GET /company/{company}/members se DM participants ki maujooda presence.
  presence(companyId) {
    if (!companyId) return Promise.resolve({})
    return companyMembersRequest(companyId).then((response) => {
      const users = membersFrom(unwrap(response))
      return Object.fromEntries(
        users.flatMap((member) => {
          const user = normalizeUser(member)
          const state = presenceStateOf(member)
          return user.id && state
            ? [[user.id, { state, lastSeenAt: lastSeenOf(member) ?? undefined }]]
            : []
        }),
      )
    })
  },

  // PUT /v1/users/{user}/status
  updateUserStatus(userId, payload, { keepalive = false } = {}) {
    requireUser(userId)
    return apiRequest(`/v1/users/${encode(userId)}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      ...(keepalive ? { keepalive: true } : {}),
    }).then((response) => normalizeUserStatus(unwrap(response)))
  },

  // GET /v1/users/{user}/status
  getUserStatus(userId) {
    requireUser(userId)
    return apiRequest(`/v1/users/${encode(userId)}/status`).then((response) =>
      normalizeUserStatus(unwrap(response)),
    )
  },
}
