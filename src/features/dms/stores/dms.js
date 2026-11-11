import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getUser } from '@/features/account/api'
import { dmApi, normalizePublicCustomStatus } from '@/features/dms/dmApi'
import { reactionsApi } from '@/features/reactions/reactionsApi'
import { useActivityStore } from '@/stores/activity'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'

// =====================================================================
// localStorage layer (pehle alag file dmStorage.js thi, ab yahin)
// =====================================================================
// DM localStorage layer (offline-first cache).
//
// Pehle saare messages EK key ('whistleit:dm-messages') mein the: har persist() par poora
// blob (har conversation ke 200 messages) JSON.parse + JSON.stringify hota tha. init() har
// conversation par persist karta tha => N x poora blob => Activity kholte hi page freeze.
//
// Ab har conversation ki apni key hai, aur jo string pichli dafa likhi thi wahi dobara ho
// to likhte hi nahi. Sab sync hai (reload se pehle kuch khota nahi), lekin sasta.

const PREFIX = 'whistleit:dm'
const LEGACY_MESSAGES_KEY = 'whistleit:dm-messages' // purana ek-blob format (migrate hota hai)
export const MESSAGES_PREFIX = `${PREFIX}-msgs:` // + company + ':' + conversationId
export const CONVERSATIONS_KEY = 'whistleit:dm-conversations'
export const READ_KEY = 'whistleit:dm-read'
export const OUTBOX_KEY = 'whistleit:dm-outbox'
export const THREADS_KEY = 'whistleit:dm-threads' // { company: { 'conv:parentId': { count, lastAt } } }
const THREAD_REPLIES_KEY = 'whistleit:dm-thread-replies' // (naya) DM list ke parent_id replies
// (naya) X se band ki gayi DMs: { company: { conversationId: band karte waqt aakhri message ka waqt } }
export const CLOSED_KEY = 'whistleit:dm-closed'
export const DRAFTS_KEY = 'whistleit:dm-drafts'
export const DELETED_KEY = 'whistleit:dm-deleted' // jo messages maine delete kiye (server wapas na dikhaye)
export const MAX_CACHED_MESSAGES = 200

const lastWritten = new Map() // key -> string (same string dobara nahi likhte)

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // Safari private mode / blocked
  }
}

export function readJson(key, fallback = {}) {
  const ls = storage()
  if (!ls) return fallback
  try {
    const raw = ls.getItem(key)
    if (raw == null) {
      lastWritten.delete(key)
      return fallback
    }
    lastWritten.set(key, raw)
    return JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

function isQuotaError(error) {
  return (
    error?.name === 'QuotaExceededError' ||
    error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error?.code === 22 ||
    error?.code === 1014
  )
}

// Jagah khatam: sab se bari message keys (dusri conversations ki) chhoti kar do
function freeSpace(exceptKey) {
  const ls = storage()
  if (!ls) return
  const keys = []
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i)
    if (key?.startsWith(MESSAGES_PREFIX) && key !== exceptKey) keys.push(key)
  }
  keys
    .map((key) => [key, ls.getItem(key)?.length ?? 0])
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, Math.ceil(keys.length / 3)))
    .forEach(([key]) => {
      ls.removeItem(key)
      lastWritten.delete(key)
    })
}

export function writeJson(key, value) {
  const ls = storage()
  if (!ls) return false
  let raw
  try {
    raw = JSON.stringify(value)
  } catch {
    return false
  }
  if (lastWritten.get(key) === raw && ls.getItem(key) === raw) return true
  try {
    ls.setItem(key, raw)
    lastWritten.set(key, raw)
    return true
  } catch (error) {
    if (!isQuotaError(error)) return false
    freeSpace(key)
    try {
      ls.setItem(key, raw)
      lastWritten.set(key, raw)
      return true
    } catch {
      return false // memory mein to hai, app chalti rahe
    }
  }
}

export function removeKey(key) {
  storage()?.removeItem(key)
  lastWritten.delete(key)
}

// ---------- messages (har conversation ki alag key) ----------
const messagesKey = (companyId, conversationId) =>
  `${MESSAGES_PREFIX}${companyId}:${conversationId}`

// Purana format ('whistleit:dm-messages' = { company: { conv: [] } }) ek dafa nayi keys mein
export function migrateLegacyMessages() {
  const ls = storage()
  if (!ls || ls.getItem(LEGACY_MESSAGES_KEY) == null) return
  const legacy = readJson(LEGACY_MESSAGES_KEY)
  for (const [company, byConversation] of Object.entries(legacy ?? {})) {
    for (const [conversationId, messages] of Object.entries(byConversation ?? {})) {
      if (Array.isArray(messages) && ls.getItem(messagesKey(company, conversationId)) == null) {
        writeJson(messagesKey(company, conversationId), messages.slice(-MAX_CACHED_MESSAGES))
      }
    }
  }
  removeKey(LEGACY_MESSAGES_KEY)
}

export function readCachedMessages(companyId, conversationId) {
  const list = readJson(messagesKey(companyId, conversationId), [])
  // (naya) toota / adhoora entry chat ko khali na kare
  return Array.isArray(list) ? list.filter((m) => m && typeof m === 'object' && m.id != null) : []
}

// File objects / functions nahi: sirf JSON-safe copy (status 'sending' bhi, taake reload par dobara jaye)
export function saveCachedMessages(companyId, conversationId, messages) {
  if (companyId == null || conversationId == null) return
  writeJson(messagesKey(companyId, conversationId), messages.slice(-MAX_CACHED_MESSAGES))
}

// ---------- generic per-company maps ----------
export function readCompanyEntry(key, companyId, fallback = null) {
  return readJson(key)[companyId] ?? fallback
}

export function writeCompanyEntry(key, companyId, value) {
  const all = readJson(key)
  all[companyId] = value
  writeJson(key, all)
}

// Logout: is user ka sab DM data hatao
export function clearDmStorage() {
  const ls = storage()
  if (!ls) return
  const remove = []
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i)
    if (key?.startsWith(PREFIX)) remove.push(key)
  }
  remove.forEach(removeKey)
}
// ===================== localStorage layer khatam =====================

// Naye messages (dusre user ke) lane ke liye active conversation har itne ms baad check hoti hai
const POLL_INTERVAL = 4000
// Har itne polls baad conversations ki list bhi (naye DM / unread ke liye)
const LIST_REFRESH_EVERY = 4 // ~16 sec: naye DM, band DMs ke naye messages, unread
const NOTIFICATION_MS = 6000 // notification itni der baad khud band
// localStorage: naya message aaya? "true" / "false" (DevTools > Application mein dikhta hai)
export const NEW_MESSAGE_KEY = 'whistleit:dm-new-message'
const MAX_BACKGROUND_FETCH = 10
const BACKGROUND_REFRESH_MS = 60_000 // band DMs ko kam se kam itni der mein ek dafa check // ek dafa mein zyada se zyada itni band DMs check
// Bhejne ki queue: network/429/5xx par itni dafa dobara koshish ("Sending…" hi dikhta hai)
const MAX_SEND_RETRIES = 7
const SEND_CONCURRENCY = 3 // ek waqt mein itne messages server ko (tarteeb se shuru)
const OLDER_LOADING_MAX_MS = 1500 // purane messages ka "Loading…" zyada se zyada 1.5 sec
const MEMBERS_TIMEOUT_MS = 6000 // members ki koi request itni der se zyada na roke
const LIKELY_PAGE_SIZE = 15 // itne (ya zyada) messages hon to shayad server par aur purane bhi hain
const OUTBOX_MAX_ATTEMPTS = 10 // edit/delete/reaction: itni dafa koshish, phir wapas (revert)
const OUTBOX_RETRY_MS = 3000
// (naya) PATCH .../recent: wahi DM baar baar kholne par itne waqt mein ek hi request
const RECENT_THROTTLE_MS = 15_000
// (naya) server jawab hi na de to itni der baad "network failure": queue + retry (spinner atka na rahe)
const RECENT_TIMEOUT_MS = 12_000
const DRAFT_SAVE_MS = 300
const MAX_TIMER_MS = 24 * 60 * 60_000 // setTimeout ki had (bari dates par dobara arm)
// Backend reply ka reference le to uska field naam yahan (jaise 'reply_to_id'). null = sirf local.
const REPLY_TO_FIELD = null
// Forward ka invisible nishan (dmApi.js ke FORWARD_MARK jaisa hi): backend is_forwarded save na
// kare tab bhi doosre user ko "(forwarded)" dikhe
const FORWARD_MARK = '\u2063\u200b\u2063' // purana invisible nishan (sirf pehchanne ke liye)
// Forward ka nishan text ke saath server tak jata hai: dono users, har device, refresh ke baad bhi
// "(forwarded)" dikhe. Hamari app yeh prefix hata kar neeche "(forwarded)" likhti hai.
export const FORWARD_PREFIX = '[Forwarded] '
const FORWARD_PREFIX_RE = /^\s*\[forwarded\]\s*/i
const bodyOf = (message, text = message.text) => {
  const clean = String(text ?? '').split(FORWARD_MARK).join('').replace(FORWARD_PREFIX_RE, '')
  return message.forwardedFrom ? `${FORWARD_PREFIX}${clean}` : text
}

const httpStatusOf = (error) =>
  Number(error?.status ?? error?.response?.status ?? error?.details?.status ?? error?.statusCode ?? 0)
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const NO_INTERNET = 'No internet connection'

// Request server tak pahunchi hi nahi (internet / DNS / CORS / timeout)
function isNetworkFailure(error) {
  if (isOffline()) return true
  if (httpStatusOf(error)) return false
  if (error instanceof TypeError) return true
  return /failed to fetch|network|load failed|timeout|timed out|offline|aborted/i.test(
    String(error?.message ?? ''),
  )
}
// Bhejte waqt: status ke bina har error ko thodi der baad dobara (purana behaviour)
function isTransient(error) {
  const status = httpStatusOf(error)
  if (!status) return true
  return [408, 425, 429].includes(status) || status >= 500
}
// Edit/delete/reaction: sirf network / 429 / 5xx par queue; 4xx (403, 422) = asli inkaar, wapas karo
function isRetryableAction(error) {
  const status = httpStatusOf(error)
  if (!status) return isNetworkFailure(error)
  return [408, 425, 429].includes(status) || status >= 500
}
function retryDelay(attempt, error) {
  const after = Number(error?.retryAfter ?? error?.details?.retry_after ?? error?.details?.retryAfter)
  if (Number.isFinite(after) && after > 0) return Math.min(after * 1000, 15000)
  if (httpStatusOf(error) === 429) return Math.min(1500 * (attempt + 1), 8000) // 1.5s, 3s, 4.5s ...
  return Math.min(400 * 2 ** attempt, 5000) // 0.4s, 0.8s, 1.6s ... 5s
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// promise itni der mein poora na ho to fallback (loading kabhi na atke)
function withTimeout(promise, ms, fallback) {
  let timer
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms)
    }),
  ])
}
const timeOf = (m) => Date.parse(m?.createdAt)
const newestTime = (list) => Math.max(0, ...list.map(timeOf).filter(Number.isFinite))

// API in fields ko nahi bhejti/lauti, isliye ye local cache se wapas jodte hain
const pendingAttachmentByMessage = new Map()
const EXTRA_KEYS = [
  'reactions',
  'replyTo',
  'forwardedFrom',
  'important',
  'editedAt',
  'voiceNoteId',
  'poll',
  'poll_id',
]

// Server ka validation message (422: { message, errors: { body: ['...'] } }) user ko dikhao
function errorMessage(error) {
  const data = error?.response?.data ?? error?.details ?? error?.data
  const fieldErrors =
    data?.errors && typeof data.errors === 'object' ? Object.values(data.errors).flat().filter(Boolean) : []
  const serverText = fieldErrors[0] ?? (typeof data?.message === 'string' ? data.message : '')
  if (serverText) return String(serverText)
  return error instanceof Error ? error.message : String(error?.message ?? error)
}

// Development mein: DM action server ne mana kiya to poora jawab console mein (validation dekhne ke liye)
function logRejected(action, error) {
  const status = httpStatusOf(error)
  if (status < 400 || status >= 500) return
  const dev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  if (dev && typeof console !== 'undefined') {
    console.error(`[dms] ${action} rejected (${status})`, error?.response?.data ?? error?.details ?? error)
  }
}

const isLocal = (message) => String(message.id).startsWith('local-')
const voiceNoteIdOf = (message) =>
  message?.voiceNoteId ?? message?.voice_note_id ?? message?.voice_note?.id

// GIF and scheduled messages use separate flows; attachments are uploaded from memory.
const isApiSendable = (message) =>
  !message.gif &&
  (!message.attachments?.length || pendingAttachmentByMessage.has(message.id)) &&
  !message.scheduledAt &&
  (!message.poll || message.poll_id != null)

function carryExtras(message, old) {
  if (!old) return message
  for (const key of EXTRA_KEYS) {
    if (message[key] == null && old[key] != null) message[key] = old[key]
  }
  return message
}

// Ek user ka reaction lagao/hatao (dobara chalao to ulta ho jata hai)
function applyReaction(list, emoji, userId) {
  const reactions = (list ?? []).map((r) => ({ ...r, users: [...r.users] }))
  const reaction = reactions.find((r) => r.emoji === emoji)
  if (!reaction) {
    reactions.push({ emoji, users: [userId] })
  } else if (reaction.users.includes(userId)) {
    reaction.users = reaction.users.filter((id) => id !== userId)
  } else {
    reaction.users.push(userId)
  }
  return reactions.filter((r) => r.users.length)
}

// Members store ka item -> { id, name, email, avatarUrl }
function memberToUser(member) {
  if (!member || typeof member !== 'object') return { id: '', name: '' }
  const user = member.user && typeof member.user === 'object' ? member.user : {}
  return {
    id: String(user.id ?? member.user_id ?? member.id ?? ''),
    name:
      member.name ?? member.full_name ?? member.fullName ?? user.name ?? user.full_name ?? user.fullName ?? '',
    email: member.email ?? user.email ?? '',
    avatarUrl: member.avatar_url ?? member.avatarUrl ?? user.avatar_url ?? user.avatarUrl ?? '',
  }
}
// Purane se naye; ek hi second ke messages id se (backend ki id waqt ke saath badhti hai)
function byTime(a, b) {
  const x = timeOf(a)
  const y = timeOf(b)
  if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y
  const p = String(a.id ?? '')
  const q = String(b.id ?? '')
  if (p.startsWith('local-') || q.startsWith('local-') || p.length !== q.length) return 0
  return p < q ? -1 : p > q ? 1 : 0
}

function lastActivity(conversation) {
  let latest = 0
  for (const m of conversation.messages) {
    if (m.scheduledAt) continue
    const at = timeOf(m)
    if (Number.isFinite(at) && at > latest) latest = at
  }
  return latest
}

export const useDmStore = defineStore('dms', () => {
  const teamsStore = useTeamsStore()
  migrateLegacyMessages() // purana ek-blob cache -> har conversation ki alag key

  const meId = ref(dmApi.meId())
  const conversations = ref([])
  const usersById = ref({})
  const activeId = ref(null)
  const closedIds = ref([])

  const loading = ref(false)
  const error = ref('')
  const offline = ref(false) // true: API fail hui, saved (cached) data dikh raha hai
  const detailLoading = ref(false)
  const detailError = ref('')

  // messages API ka state
  const messagesLoading = ref(false)
  const messagesError = ref('')
  const actionError = ref('') // send / edit / delete ka last error

  const companyMembers = ref([])
  const companyMembersLoading = ref(false)
  const companyMembersError = ref('')
  const customStatusError = ref('')

  const detailLoaded = new Set()
  const detailRequests = new Map()
  const customStatusRequests = new Map()
  const messagesLoaded = new Set()
  const messageRequests = new Map()
  let initialization = null
  let lastInitAt = 0
  let localSeq = 0
  // Polling ke dauran in-flight edit/delete/send: purani GET list inhe ulta na kar de
  const pendingEdits = new Map() // messageId -> naya text
  const pendingDeletes = new Set() // messageId
  const sentDuringFetch = new Map() // conversationId -> Set(server message ids)
  const reactionSeq = new Map() // messageId -> aakhri reaction click ka number
  const deletedWhileSending = new Set() // localId: POST ke dauran user ne delete kiya
  let reactionPickerFor = null // jis message ka emoji picker khula hai

  // Naye message ki notifications: [{ id, conversationId, title, sender, text }]
  const notifications = ref([])
  // Naya message aaya to true (notification dikhti hai), warna false
  const hasNewMessage = computed(() => notifications.value.length > 0)
  watch(
    hasNewMessage,
    (value) => {
      try {
        localStorage.setItem(NEW_MESSAGE_KEY, String(value))
      } catch {
        /* storage blocked */
      }
    },
    { immediate: true, flush: 'sync' },
  )
  const seenIds = new Map() // conversationId -> Set(message ids) jo is session mein dekh liye
  const lastActivityById = new Map() // conversationId -> lastActivityAt (pichli list se)
  const lastBackgroundFetch = new Map() // conversationId -> band DM ke messages aakhri dafa kab
  let firstListLoaded = false
  let notificationSeq = 0
  const queuedCount = new Map() // conversationId -> kitne messages queue mein
  const sendLines = new Map() // conversationId -> { waiting: [localId], active: number }
  const inFlight = new Map() // localId -> conversationId (POST chal rahi hai, jawab ka intezar)
  const confirmedIds = new Set() // server message ids jo hamare kisi POST ka jawab the
  const olderState = ref({}) // { [conversationId]: { nextPage, hasMore, loading, error } }
  const membersStore = useMembersStore()
  let pollTimer = null
  let pollTicks = 0
  let learnedMe = '' // server ke jawab se seekha hua apna asli user id

  const companyId = computed(() => teamsStore.activeWorkspaceId)

  // ---------- (naya) X se band DMs: localStorage mein (reload par wapas na aayein) ----------
  // Band karte waqt conversation ka aakhri waqt (server ka) save hota hai. Doosre user ka is se
  // naya message aaye to DM khud list mein wapas aa jati hai (message chhoote nahi).
  const closedMarks = ref(readCompanyEntry(CLOSED_KEY, companyId.value, {}) ?? {})
  closedIds.value = Object.keys(closedMarks.value)
  watch(companyId, (company) => {
    closedMarks.value = readCompanyEntry(CLOSED_KEY, company, {}) ?? {}
    closedIds.value = Object.keys(closedMarks.value)
  })
  function saveClosed() {
    writeCompanyEntry(CLOSED_KEY, companyId.value, closedMarks.value)
  }
  function unclose(id) {
    const key = String(id)
    closedIds.value = closedIds.value.filter((x) => String(x) !== key)
    if (key in closedMarks.value) {
      const next = { ...closedMarks.value }
      delete next[key]
      closedMarks.value = next
      saveClosed()
    }
  }
  function reopenIfNewIncoming(conversation) {
    const mark = closedMarks.value[String(conversation.id)]
    if (mark == null) return
    const since = Date.parse(mark) || 0
    const fresh = conversation.messages.some((m) => isIncoming(m) && (Date.parse(m.createdAt) || 0) > since)
    if (fresh) unclose(conversation.id)
  }

  // ---------- helpers ----------
  function mergeUsers(list = []) {
    for (const user of list) {
      if (!user?.id) continue
      const defined = Object.fromEntries(
        Object.entries(user).filter(([, v]) => v !== '' && v != null),
      )
      usersById.value[user.id] = {
        name: '',
        email: '',
        avatarUrl: '',
        ...usersById.value[user.id],
        ...defined,
      }
    }
  }

  async function loadCustomStatuses(userIds = []) {
    const ids = [
      ...new Set(
        userIds.filter((id) => {
          const user = usersById.value[id]
          return (
            id &&
            id !== meId.value &&
            !user?.customStatusLoaded &&
            !user?.customStatus?.emoji &&
            !user?.customStatus?.text
          )
        }),
      ),
    ]

    if (!ids.length) return
    customStatusError.value = ''

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        if (customStatusRequests.has(id)) return customStatusRequests.get(id)

        const request = getUser(id)
          .then((response) => {
            mergeUsers([normalizePublicCustomStatus(response, id)])
          })
          .finally(() => customStatusRequests.delete(id))
        customStatusRequests.set(id, request)
        return request
      }),
    )
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => errorMessage(result.reason))

    if (errors.length) {
      customStatusError.value = errors[0]
    } else {
      persistConversations()
    }
  }

  // ---------- thread replies main chat mein nahi ----------
  // Backend thread ke replies ko bhi DM ke messages mein lauta deta hai: woh sirf "1 reply" aur
  // Reply Thread card mein dikhne chahiye, chat mein alag message ki tarah nahi.
  const threadReplyIds = new Set()
  const latestSeen = new Map() // conversationId -> Set(ids) jo pichli dafa sab se naye page mein the
  // ---------- thread summary: "N replies · Last reply: …" (localStorage + network) ----------
  // { 'conv:parentId': { count, lastAt } }. Do jagah se banta hai:
  //  1) DM list ke parent_id wale replies (har poll ~4 sec: doosre user ke liye bhi live)
  //  2) Reply Thread ki poori list (replies API) -> pakki ginti
  // localStorage mein save, isliye reload par card foran (network se pehle) dikhta hai.
  const threadCounts = ref(readCompanyEntry(THREADS_KEY, companyId.value, {}) ?? {})
  watch(companyId, (company) => {
    threadCounts.value = readCompanyEntry(THREADS_KEY, company, {}) ?? {}
  })
  let threadSaveTimer = null
  function saveThreadCounts() {
    clearTimeout(threadSaveTimer)
    const company = companyId.value
    threadSaveTimer = setTimeout(() => writeCompanyEntry(THREADS_KEY, company, threadCounts.value), 200)
  }
  const laterOf = (a, b) => (!a ? b || '' : !b ? a : Date.parse(b) > Date.parse(a) ? b : a)
  function setThread(key, entry) {
    const before = threadCounts.value[key]
    if (before && before.count === entry.count && before.lastAt === entry.lastAt) return
    threadCounts.value = { ...threadCounts.value, [key]: entry }
    saveThreadCounts()
  }
  // (naya) DM list ke parent_id wale replies khud bhi (receiver ke paas yahi aate hain):
  // { 'conv:parentId': [{ id, from, text, createdAt, editedAt }] } -> localStorage
  const threadReplies = ref(readCompanyEntry(THREAD_REPLIES_KEY, companyId.value, {}) ?? {})
  watch(companyId, (company) => {
    threadReplies.value = readCompanyEntry(THREAD_REPLIES_KEY, company, {}) ?? {}
  })
  let threadRepliesSaveTimer = null
  function saveThreadReplies() {
    clearTimeout(threadRepliesSaveTimer)
    const company = companyId.value
    threadRepliesSaveTimer = setTimeout(
      () => writeCompanyEntry(THREAD_REPLIES_KEY, company, threadReplies.value),
      200,
    )
  }
  const replyEntry = (m) => ({
    id: String(m.id),
    from: m.from ?? null,
    author: m.author ?? '',
    text: m.text ?? '',
    createdAt: m.createdAt ?? '',
    ...(m.editedAt ? { editedAt: m.editedAt } : {}),
  })
  function threadRepliesOf(conversationId, parentId) {
    return threadReplies.value[`${conversationId}:${parentId}`] ?? []
  }
  // (1) DM list: sirf ek page hai, isliye purane replies rakhte hain (union), delete wale hata dete hain
  function rememberThreadCounts(conversationId, list) {
    const byKey = {}
    for (const m of list) {
      if (!m?.parentId || m.parentId === '?' || m.id == null) continue
      const key = `${conversationId}:${m.parentId}`
      ;(byKey[key] ??= []).push(m)
    }
    let changed = false
    const next = { ...threadReplies.value }
    for (const [key, page] of Object.entries(byKey)) {
      const merged = new Map((next[key] ?? []).map((r) => [r.id, r]))
      for (const m of page) {
        if (m.deleted) merged.delete(String(m.id))
        else merged.set(String(m.id), replyEntry(m))
      }
      const sorted = [...merged.values()].sort(
        (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
      )
      if (JSON.stringify(sorted) !== JSON.stringify(next[key] ?? [])) {
        next[key] = sorted
        changed = true
      }
      const lastAt = sorted.reduce((latest, r) => laterOf(latest, r.createdAt), '')
      const before = threadCounts.value[key]
      setThread(key, {
        count: Math.max(before?.count ?? 0, sorted.length),
        lastAt: laterOf(before?.lastAt, lastAt),
      })
    }
    if (changed) {
      threadReplies.value = next
      saveThreadReplies()
    }
  }
  // (2) Reply Thread ki poori list (optimistic "Sending…" samait, "Not sent" ke baghair): pakki ginti
  function noteThreadReplies(conversationId, parentId, replies = []) {
    if (conversationId == null || parentId == null) return
    const live = replies.filter((r) => r && !r.deleted && r.status !== 'failed')
    // DM list wale replies jo replies API ki list mein nahi (doosri id / abhi load nahi hue)
    const extra = threadRepliesOf(conversationId, parentId).filter(
      (d) => !live.some((r) => sameReply(r, d)),
    )
    const all = [...live, ...extra]
    const lastAt = all.reduce((latest, r) => laterOf(latest, r.createdAt), '')
    setThread(`${conversationId}:${parentId}`, { count: all.length, lastAt })
  }
  // Replies API aur DM list ek hi reply ko alag id de sakte hain: id, ya bhejne wala + text + 2 min
  function sameReply(a, b) {
    if (!a || !b) return false
    if (a.id != null && String(a.id) === String(b.id)) return true
    const text = (r) => String(r.text ?? r.content ?? r.body ?? '').replace(/<[^>]+>/g, '').trim()
    const fromA = String(a.from ?? a.authorId ?? '')
    const fromB = String(b.from ?? b.authorId ?? '')
    const gap = Math.abs(Date.parse(a.createdAt) - Date.parse(b.createdAt))
    return Boolean(
      text(a) &&
        text(a) === text(b) &&
        (!fromA || !fromB || fromA === fromB) &&
        Number.isFinite(gap) &&
        gap < 2 * 60_000,
    )
  }
  // Reply Thread panel ke liye: replies API ki list + DM list ke replies (bina dohraye, purane se naye)
  function mergeThreadReplies(conversationId, parentId, list = []) {
    const extra = threadRepliesOf(conversationId, parentId).filter(
      (d) => !list.some((r) => sameReply(r, d)),
    )
    if (!extra.length) return list
    return [...list, ...extra].sort(
      (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
    )
  }
  function threadInfo(conversationId, messageId) {
    return threadCounts.value[`${conversationId}:${messageId}`] ?? null
  }
  const isThreadReply = (m) => Boolean(m?.parentId) || threadReplyIds.has(String(m?.id))
  // (naya) null / bina id wali entry bhi yahin ruk jati hai (chat crash na ho)
  const withoutThreadReplies = (list) =>
    (Array.isArray(list) ? list : []).filter((m) => m && m.id != null && !isThreadReply(m))
  // Replies store / ThreadPanel se mile reply ids: chat se foran hatao
  function markThreadReplies(conversationId, ids = []) {
    let added = false
    for (const id of ids) {
      if (id == null || String(id).startsWith('local-') || threadReplyIds.has(String(id))) continue
      threadReplyIds.add(String(id))
      added = true
    }
    if (!added) return
    const conversation = findConversation(conversationId)
    if (!conversation) return
    const kept = withoutThreadReplies(conversation.messages)
    if (kept.length !== conversation.messages.length) {
      conversation.messages = kept
      persist(conversation)
    }
  }

  function findConversation(id) {
    return conversations.value.find((c) => String(c.id) === String(id)) ?? null
  }

  // ---------- local cache ----------
  // Conversation ke saare messages (API + local) localStorage mein (sirf is conversation ki key)
  function persist(conversation) {
    saveCachedMessages(companyId.value, conversation.id, conversation.messages)
  }

  // Conversations ki list + users localStorage mein (unreadCount bhi: reload par badge foran)
  function persistConversations() {
    writeCompanyEntry(CONVERSATIONS_KEY, companyId.value, {
      userId: dmApi.meId(),
      me: meId.value,
      conversations: conversations.value.map((conversation) => {
        const copy = { ...conversation }
        delete copy.messages // messages alag key mein save hote hain
        return copy
      }),
      users: usersById.value,
    })
  }

  // Cached messages ko conversation mein milao (API ke messages ko na chhedo)
  function mergeCachedMessages(company, conversation) {
    const saved = withoutThreadReplies(readCachedMessages(company, conversation.id))
    conversation.messages = withoutThreadReplies(conversation.messages)
    const savedById = new Map(saved.map((m) => [m.id, m]))
    for (const message of conversation.messages) carryExtras(message, savedById.get(message.id))

    const have = new Set(conversation.messages.map((m) => m.id))
    const missing = saved
      .filter((m) => !have.has(m.id))
      // page reload par jo "sending" (queue mein) tha: "Not sent" nahi, chat load hote hi khud dobara
      .map((m) => (m.status === 'sending' ? { ...m, resend: true } : m))
    conversation.messages.push(...missing)
    conversation.messages.sort(byTime)
  }

  // Network na ho to pichla saved data dikhao
  function hydrateFromCache(company) {
    const cached = readCompanyEntry(CONVERSATIONS_KEY, company)
    if (!cached?.conversations?.length || cached.userId !== dmApi.meId()) return false

    // purana (pichle session ka) online/offline nahi: taaza status API se aata hai
    mergeUsers(
      Object.values(cached.users ?? {}).map((user) => {
        const restoredUser = { ...user }
        delete restoredUser.presence
        return restoredUser
      }),
    )
    if (cached.me) {
      meId.value = cached.me
      learnedMe = cached.me
    }
    conversations.value = cached.conversations.map((conversation) => {
      const restored = { ...conversation, messages: [] }
      mergeCachedMessages(company, restored)
      return restored
    })
    applyOutboxOverlays()
    return true
  }

  // Logout par call karein taake dusre user ko pichla data na dikhe
  function clearCache() {
    stopPolling()
    learnedMe = ''
    clearDmStorage()
  }

  // ---------- load ----------
  function init() {
    if (initialization) return initialization

    meId.value = learnedMe || dmApi.meId()
    loading.value = true
    error.value = ''

    initialization = (async () => {
      const company = companyId.value
      // 1) Pehle saved data foran dikhao
      if (!conversations.value.length) hydrateFromCache(company)
      const cachedFavorites = new Set(
        (readCompanyEntry(CONVERSATIONS_KEY, company)?.conversations ?? [])
          .filter((c) => c.isFavorite)
          .map((c) => c.id),
      )
      // (naya) local recentAt (offline mein khola, abhi sync nahi hua) server ke purane waqt se na mite
      const cachedRecent = new Map(
        (readCompanyEntry(CONVERSATIONS_KEY, company)?.conversations ?? [])
          .filter((c) => c.recentAt)
          .map((c) => [c.id, c.recentAt]),
      )

      try {
        // 2) Phir API se taaza data
        const entries = await dmApi.listDirectChannels(company)
        const previous = new Map(conversations.value.map((c) => [c.id, c]))
        const apiUnreadById = new Map()

        conversations.value = entries.map(({ conversation, users }) => {
          mergeUsers(users)
          apiUnreadById.set(conversation.id, Number(conversation.unreadCount) || 0)
          const existing = previous.get(conversation.id)
          if (existing) {
            // Wahi object rakho (naya nahi): jo message abhi bheja ja raha hai uska jawab
            // isi par lage, warna wo "Sending…" par atka reh jata hai
            const have = new Set(existing.messages.map((m) => m.id))
            const fresh = withoutThreadReplies(conversation.messages).filter((m) => !have.has(m.id))
            if (fresh.length) {
              const locals = existing.messages.filter((m) => isLocal(m))
              existing.messages = [...existing.messages.filter((m) => !isLocal(m)), ...fresh]
                .sort(byTime)
                .concat(locals)
            }
            for (const member of conversation.members) {
              if (!existing.members.includes(member)) existing.members.push(member)
            }
            if (conversation.name) existing.name = conversation.name
            existing.lastActivityAt = conversation.lastActivityAt
            if (conversation.isFavorite || cachedFavorites.has(conversation.id)) existing.isFavorite = true
            existing.recentAt = laterOf(existing.recentAt, conversation.recentAt) // (naya)
            reconcileInFlight(existing)
            return existing
          }
          mergeCachedMessages(company, conversation)
          if (cachedFavorites.has(conversation.id)) conversation.isFavorite = true
          conversation.recentAt = laterOf(cachedRecent.get(conversation.id), conversation.recentAt) // (naya)
          return conversation
        })
        applyOutboxOverlays()
        const firstRun = !readMap(company)
        for (const conversation of conversations.value) {
          detectIncoming(conversation)
          refreshUnread(conversation, { firstRun, apiUnread: apiUnreadById.get(conversation.id) })
        }
        firstListLoaded = true
        resolveMe(Object.values(usersById.value))
        if (needsNames()) void fillMissingNames(company)

        offline.value = false
        lastInitAt = Date.now()
        conversations.value.forEach(persist) // har conversation ki choti key; same data dobara nahi likhta
        persistConversations()
        armScheduledDeletes()
        void flushOutbox()
      } catch (cause) {
        error.value = errorMessage(cause)
        offline.value = conversations.value.length > 0 // cached data dikh raha hai
      } finally {
        loading.value = false
        initialization = null
      }
    })()

    return initialization
  }

  // Panels (Activity, DM list) ke liye: haal hi mein load hua ho to dobara network nahi
  function ensureLoaded(maxAgeMs = 15_000) {
    if (initialization) return initialization
    if (lastInitAt && Date.now() - lastInitAt < maxAgeMs && !error.value) return Promise.resolve()
    return init()
  }

  // Apna user id: authUser se match na ho to email/naam se company members mein dhoondo
  function resolveMe(list = []) {
    if (list.some((user) => user.id === meId.value)) return
    const me = dmApi.currentUser?.()
    if (!me) return
    const email = String(me.email ?? '')
      .trim()
      .toLowerCase()
    const name = String(me.fullName ?? me.full_name ?? me.name ?? '')
      .trim()
      .toLowerCase()
    const match =
      (email &&
        list.find(
          (user) =>
            String(user.email ?? '')
              .trim()
              .toLowerCase() === email,
        )) ||
      (name &&
        list.find(
          (user) =>
            String(user.name ?? '')
              .trim()
              .toLowerCase() === name,
        ))
    if (match) meId.value = match.id
  }

  function needsNames() {
    const me = meId.value
    return (
      !usersById.value[me] ||
      conversations.value.some((c) =>
        c.members.some((id) => id !== me && !usersById.value[id]?.name),
      )
    )
  }

  // API conversation mein sirf IDs hon to team member lists se names load karo.
  async function fillMissingNames(company) {
    try {
      const list = (await dmApi.listCompanyMembers?.(company)) ?? []
      mergeUsers(list)
      resolveMe(list)
      persistConversations()
    } catch {
      /* naam baad mein loadCompanyMembers se bhi aa jate hain */
    }
    if (String(companyId.value) !== String(company)) return
    await loadCompanyMembers()
  }

  function loadDetail(id) {
    if (detailRequests.has(id)) return detailRequests.get(id)

    detailLoading.value = true
    detailError.value = ''
    const request = (async () => {
      try {
        const { conversation: detail, users } = await dmApi.getDirectChannel(companyId.value, id)
        mergeUsers(users)
        detailLoaded.add(id)
        const target = findConversation(id)
        if (target) {
          const have = new Set(target.messages.map((m) => m.id))
          const fresh = withoutThreadReplies(detail.messages).filter((m) => !have.has(m.id))
          target.messages = [...fresh, ...target.messages] // API messages local se pehle
          for (const member of detail.members) {
            if (!target.members.includes(member)) target.members.push(member)
          }
          persist(target)
          persistConversations()
        }
      } catch (cause) {
        detailError.value = errorMessage(cause)
      } finally {
        detailLoading.value = false
        detailRequests.delete(id)
      }
    })()
    detailRequests.set(id, request)
    return request
  }

  // Server ki list par apni abhi-tak-na-pahunchi tabdeeliyan (edit/delete/reaction) chadhao
  function overlayPending(conversationId, m, previous) {
    if (pendingDeletes.has(m.id) || deletedByMe.has(String(m.id))) m.deleted = true
    if (pendingEdits.has(m.id)) m.text = pendingEdits.get(m.id)
    if (reactionSeq.has(m.id)) m.reactions = previous?.reactions ?? []
    for (const item of outbox.value) {
      if (String(item.conversationId) !== String(conversationId) || item.messageId !== m.id) continue
      if (item.type === 'delete') m.deleted = true
      if (item.type === 'edit') {
        m.text = item.text
        m.editedAt = m.editedAt ?? item.editedAt
      }
      if (item.type === 'reaction') m.reactions = previous?.reactions ?? m.reactions
      m.syncPending = true
    }
    return m
  }

  // GET /v1/{company}/direct-channels/{channel}/messages
  // silent: polling ke liye (loading/error UI nahi badalta)
  function fetchMessages(id, { silent = false } = {}) {
    if (messageRequests.has(id)) return messageRequests.get(id)

    if (!silent) {
      messagesLoading.value = true
      messagesError.value = ''
    }
    const sentMeanwhile = new Set()
    sentDuringFetch.set(id, sentMeanwhile)
    const request = (async () => {
      try {
        const latest = await fetchLatestPage(id)
        rememberThreadCounts(id, latest) // parent_id wale replies se "N replies" (doosre user ko bhi)
        const list = withoutThreadReplies([...latest])
        // Sab se naya page pakka sab se naya hai? (warna "naye se naya" wala delete nahi pehchante)
        const newestIsReal = pageState(id).order === 'desc'
        // Server keh raha hai yahi poori history hai (ek hi page)
        const info = latest.pagination
        const wholeHistory =
          pageState(id).order !== 'asc' && info?.hasMore === false && Number(info.page ?? 1) === 1
        const seenBefore = latestSeen.get(id) ?? new Set()
        latestSeen.set(id, new Set(list.map((m) => String(m.id))))
        const target = findConversation(id)
        if (target) {
          target.messages = withoutThreadReplies(target.messages) // "(message deleted)" na ban jayein
          const previous = new Map(target.messages.map((m) => [m.id, m]))
          list.forEach((m) => {
            carryExtras(m, previous.get(m.id))
            // Delete hue message ka sender server null bhejta hai: pehle wala bhejne wala rakho
            if (m.deleted && !m.from && previous.get(m.id)?.from) m.from = previous.get(m.id).from
            overlayPending(id, m, previous.get(m.id))
          })
          const known = new Set(list.map((m) => m.id))
          // API wale messages + wo local/pending jo abhi server par nahi gaye
          // + wo jo is request ke dauran send hue (purani list mein nahi honge)
          const pending = target.messages.filter(
            (m) => !known.has(m.id) && (isLocal(m) || sentMeanwhile.has(m.id) || m.scheduledAt),
          )
          // Server se hat gaye (delete hue) messages: gayab nahi, "(message deleted)" dikhao.
          // Sirf wo jo is list ke waqt ke andar hain (purane page wale nahi).
          const times = list.map(timeOf).filter(Number.isFinite)
          const oldest = times.length ? Math.min(...times) : Infinity
          const newest = times.length ? Math.max(...times) : -Infinity
          // Cache ki wahi copy jo server par doosri id se hai (POST id != list id): delete NAHI,
          // chupchap hata do (refresh par apne messages "deleted" ban jate the)
          // Sirf wo server message jodi ban sakta hai jo NAYI id se aaya (pehle cache mein nahi tha),
          // aur har server message sirf ek cache copy ka. Delete hua message kabhi "dohri copy" nahi.
          // (Pehle do "hi" mein se ek delete karo to wo doosre "hi" ki copy samjh kar gayab ho jata tha.)
          const cachedIds = new Set(target.messages.map((m) => m.id))
          const claimable = list.filter((x) => !cachedIds.has(x.id))
          const duplicateIds = new Set()
          for (const m of target.messages) {
            if (known.has(m.id) || isLocal(m) || m.scheduledAt || m.deleted || deletedByMe.has(String(m.id))) continue
            const index = claimable.findIndex(
              (x) =>
                x.from === m.from &&
                (x.text === m.text || Math.abs(timeOf(x) - timeOf(m)) < 2000) &&
                Math.abs(timeOf(x) - timeOf(m)) < 10 * 60_000,
            )
            if (index === -1) continue
            claimable.splice(index, 1)
            duplicateIds.add(m.id)
          }
          // Delete tab hi jab yaqeen ho:
          //  - pichli dafa server ki list mein tha, ab nahi (aur is page ke waqt ke andar), ya
          //  - server ke messages ke beech ka hai, ya
          //  - sab se naye page se bhi naya tha (page waqai sab se naya ho) aur ab nahi
          const removed = target.messages
            .filter((m) => {
              if (known.has(m.id) || duplicateIds.has(m.id) || isLocal(m) || m.scheduledAt) return false
              if (sentMeanwhile.has(m.id)) return false
              if (m.deleted) return true
              const at = timeOf(m)
              if (!Number.isFinite(at) || !times.length) return false
              if (seenBefore.has(String(m.id)) && (at >= oldest || wholeHistory)) return true
              if (at >= oldest && at <= newest) return true
              return newestIsReal && at > newest
            })
            .map((m) => ({ ...m, deleted: true }))
          // Pagination: is page se purane jo pehle se hain (load older / cache), wo rakho, gayab na hon
          const removedIds = new Set(removed.map((m) => m.id))
          const older = target.messages.filter((m) => {
            if (known.has(m.id) || removedIds.has(m.id) || duplicateIds.has(m.id) || isLocal(m) || sentMeanwhile.has(m.id) || m.scheduledAt) {
              return false
            }
            const at = timeOf(m)
            return !Number.isFinite(at) ? !times.length : at < oldest
          })
          target.messages = [...older, ...list, ...removed].sort(byTime).concat(pending)
          for (const m of list) {
            if (m.from && !target.members.includes(m.from)) target.members.push(m.from)
          }
          reconcileInFlight(target)
          detectIncoming(target)
          refreshUnread(target)
          resumePending(target)
          persist(target)
          persistConversations()
        }
        messagesLoaded.add(id)
        messagesError.value = ''
      } catch (cause) {
        // cached messages screen par rehte hain, sirf error dikhta hai
        if (!silent) messagesError.value = errorMessage(cause)
      } finally {
        if (!silent) messagesLoading.value = false
        messageRequests.delete(id)
        sentDuringFetch.delete(id)
      }
    })()
    messageRequests.set(id, request)
    return request
  }

  // Component se: conversation ke messages API se load karo
  async function loadMessages(id, { force = false } = {}) {
    const conversation = findConversation(id)
    if (!conversation) return false
    const hasApiMessages = conversation.messages.some((m) => !isLocal(m))
    if (!force && !hasApiMessages && !detailLoaded.has(id)) await loadDetail(id)
    if (force || !messagesLoaded.has(id)) await fetchMessages(id)
    return !detailError.value && !messagesError.value
  }

  // Team ke members (pehle wali DM list inhi se banti thi): members store se
  async function membersFromTeamStore(teams = []) {
    try {
      const membersStore = useMembersStore()
      // purane DM store ki tarah: active team, warna pehli team, warna 'team-1'
      const teamId = teamsStore.activeTeamId || teams[0]?.id || 'team-1'
      if (!membersStore.members?.length && teamId && typeof membersStore.fetchMembers === 'function') {
        await withTimeout(membersStore.fetchMembers(teamId), MEMBERS_TIMEOUT_MS)
      }
      return (membersStore.members ?? []).map(memberToUser).filter((user) => user.id && user.name)
    } catch {
      return []
    }
  }

  async function loadCompanyMembers() {
    const company = companyId.value
    companyMembersLoading.value = true
    companyMembersError.value = ''

    try {
      let teams = teamsStore.teamsByWorkspaceId?.[company] ?? []
      if (!teams.length && company) {
        try {
          await withTimeout(teamsStore.fetchTeams(company), MEMBERS_TIMEOUT_MS)
          teams = teamsStore.teamsByWorkspaceId?.[company] ?? []
        } catch (cause) {
          companyMembersError.value = errorMessage(cause)
        }
      }

      if (!teams.length) {
        if (!companyMembersError.value) {
          companyMembersError.value = 'No teams are available to load members from.'
        }
        companyMembers.value = []
        return companyMembers.value
      }

      const [memberResults, nonMemberResults] = await Promise.all([
        Promise.allSettled(teams.map((team) => dmApi.listTeamMembers(company, team.id))),
        Promise.allSettled(teams.map((team) => dmApi.listTeamNonMembers(company, team.id))),
      ])
      const fulfilled = (results) =>
        results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value ?? [])
      const succeeded = [...memberResults, ...nonMemberResults].some(
        (result) => result.status === 'fulfilled',
      )
      if (!succeeded) {
        const failed = [...memberResults, ...nonMemberResults].find(
          (result) => result.status === 'rejected',
        )
        companyMembersError.value = failed
          ? errorMessage(failed.reason)
          : 'Unable to load members from the available teams.'
      }

      const seen = new Map()
      for (const user of [...fulfilled(memberResults), ...fulfilled(nonMemberResults)]) {
        if (user?.id && !seen.has(user.id)) seen.set(user.id, user)
      }
      if (!seen.size) {
        for (const user of await membersFromTeamStore(teams)) {
          if (user?.id && !seen.has(user.id)) seen.set(user.id, user)
        }
      }
      companyMembers.value = [...seen.values()]
      mergeUsers(companyMembers.value)
      resolveMe(companyMembers.value)
      persistConversations()
    } catch (cause) {
      companyMembersError.value = errorMessage(cause)
    } finally {
      companyMembersLoading.value = false
    }

    return companyMembers.value
  }

  // ---------- getters ----------
  // Team members (members store) live: kisi ko invite/add karte hi DM list mein foran
  const teamMembers = computed(() =>
    (membersStore.members ?? []).map(memberToUser).filter((user) => user.id && user.name),
  )
  watch(teamMembers, (list) => mergeUsers(list), { immediate: true })

  const users = computed(() => {
    const seen = new Map()
    for (const user of [...companyMembers.value, ...teamMembers.value, ...Object.values(usersById.value)]) {
      if (user?.id && !seen.has(user.id)) seen.set(user.id, usersById.value[user.id] ?? user)
    }
    return [...seen.values()]
  })

  // lastActivity har conversation ke liye ek hi dafa (sort comparator mein baar baar nahi)
  const sorted = computed(() => {
    const closed = new Set(closedIds.value)
    return conversations.value
      .filter((c) => !closed.has(c.id))
      // (naya) recentAt: DM khola (PATCH .../recent) to bhi list mein upar
      .map((c) => ({ c, at: Math.max(lastActivity(c), Date.parse(c.recentAt) || 0), title: titleOf(c) }))
      .sort((a, b) => b.at - a.at || a.title.localeCompare(b.title))
      .map(({ c }) => c)
  })

  // Saari DMs ke unread ka jod (sidebar / tab title badge ke liye)
  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0),
  )

  const activeConversation = computed(() => findConversation(activeId.value))

  // Pehle ki tarah DM list mein team/company ke baaki users bhi: jin se abhi DM nahi hai.
  // List mein inki id "user:{userId}" hoti hai; click par startDm(userId) se DM banti hai.
  const suggestedUsers = computed(() => {
    const me = meId.value
    const withDm = new Set(
      conversations.value
        .filter((c) => c.type === 'dm' && c.members.length <= 2)
        .flatMap((c) => c.members),
    )
    const closed = new Set(closedIds.value)
    // Ek hi insaan do ids se (membership id / user id): DM pehle se ho to dobara list mein nahi
    const dmNames = new Set(
      [...withDm]
        .filter((id) => id !== me)
        .map((id) => String(usersById.value[id]?.name ?? '').trim().toLowerCase())
        .filter(Boolean),
    )
    return users.value.filter(
      (user) =>
        user.id &&
        user.name &&
        user.id !== me &&
        !withDm.has(user.id) &&
        !dmNames.has(String(user.name).trim().toLowerCase()) &&
        !closed.has(`user:${user.id}`),
    )
  })

  function partnerId(conversation) {
    return conversation.members.find((id) => id !== meId.value) ?? null
  }

  function titleOf(conversation) {
    if (conversation.name) return conversation.name
    const names = conversation.members
      .filter((id) => id !== meId.value)
      .map((id) => usersById.value[id]?.name)
      .filter(Boolean)
    return names.join(', ') || 'Direct message'
  }

  // ---------- conversations ----------
  function openConversation(id) {
    const conversation = findConversation(id)
    if (!conversation) return false

    unclose(conversation.id)
    activeId.value = conversation.id
    markRead(conversation)
    persistConversations()
    dismissConversationNotifications(conversation.id)
    detailError.value = ''
    messagesError.value = ''

    if (messagesLoaded.has(conversation.id)) void fetchMessages(conversation.id, { silent: true })
    else void loadMessages(conversation.id)
    startPolling() // dusre user ke naye messages bina reload ke
    void touchRecent(conversation.id) // (naya) PATCH .../recent (pehle local, phir network)
    return true
  }

  // Channel select hone par: DM ko inactive karo (list mein rehta hai, sirf chat band)
  function deactivateConversation() {
    activeId.value = null
    detailError.value = ''
    messagesError.value = ''
  }

  function closeConversation(id) {
    const key = String(id)
    if (!closedIds.value.includes(key)) closedIds.value.push(key)
    if (activeId.value === id) activeId.value = null
    // (naya) reload ke baad bhi band: is waqt tak ke messages "dekhe hue", is se naye par wapas
    const conversation = findConversation(id)
    closedMarks.value = {
      ...closedMarks.value,
      [String(id)]: conversation ? latestAt(conversation) : new Date().toISOString(),
    }
    saveClosed()
  }

  // Naya conversation list mein jodo aur kholo
  function adoptConversation(conversation, memberIds) {
    if (!conversation.members.includes(meId.value)) conversation.members.unshift(meId.value)
    for (const id of memberIds) {
      if (!conversation.members.includes(id)) conversation.members.push(id)
    }
    detailLoaded.add(conversation.id) // naya channel hai, detail fetch ki zaroorat nahi
    if (!findConversation(conversation.id)) conversations.value.unshift(conversation)
    persistConversations()
    openConversation(conversation.id)
    return findConversation(conversation.id)
  }

  // 1 user = DM
  async function startDm(userId) {
    if (!userId || userId === meId.value) {
      throw new Error('Choose another person to start a direct message.')
    }
    const existing = conversations.value.find(
      (c) => c.type === 'dm' && c.members.length <= 2 && c.members.includes(userId),
    )
    if (existing) {
      openConversation(existing.id)
      return existing
    }

    const created = await dmApi.createDirectChannel(companyId.value, { user_id: userId })
    if (!created?.conversation) {
      // 204 / khali jawab: DM ban gayi lekin id nahi aayi -> list EK dafa dobara
      await init()
      const fromList = conversations.value.find(
        (c) => c.type === 'dm' && c.members.length <= 2 && c.members.includes(userId),
      )
      if (!fromList) throw new Error('The conversation was created but could not be loaded. Please refresh.')
      openConversation(fromList.id)
      return fromList
    }
    mergeUsers(created.users)
    return adoptConversation(created.conversation, [userId])
  }

  // 2+ users = group DM
  async function startGroup(userIds, name = '') {
    const others = [...new Set(userIds)].filter((id) => id && id !== meId.value)
    if (others.length < 2) throw new Error('Select at least two people to create a group.')

    const groupName = String(name ?? '').trim()
    const created = await dmApi.createGroupChannel(companyId.value, {
      name: groupName,
      user_ids: others,
    })
    if (!created?.conversation) {
      // 204 / khali jawab: list EK dafa dobara, wahi members wala group dhoondo
      const before = new Set(conversations.value.map((c) => c.id))
      await init()
      const fromList = conversations.value.find(
        (c) => !before.has(c.id) && others.every((id) => c.members.includes(id)),
      )
      if (!fromList) throw new Error('The group was created but could not be loaded. Please refresh.')
      fromList.type = 'group'
      openConversation(fromList.id)
      return fromList
    }
    const { conversation, users: participants } = created
    mergeUsers(participants)
    conversation.type = 'group'
    if (!conversation.name) conversation.name = groupName
    return adoptConversation(conversation, others)
  }

  // ---------- favorites ----------
  function isFavorite(id) {
    return Boolean(findConversation(id)?.isFavorite)
  }
  function toggleFavorite(id) {
    const conversation = findConversation(id)
    if (!conversation) return false
    conversation.isFavorite = !conversation.isFavorite
    persistConversations()
    return conversation.isFavorite
  }

  // ---------- drafts (localStorage) ----------
  const drafts = ref(readCompanyEntry(DRAFTS_KEY, companyId.value, {}) ?? {})
  let draftTimer = null
  watch(companyId, (company) => {
    drafts.value = readCompanyEntry(DRAFTS_KEY, company, {}) ?? {}
  })
  function getDraft(conversationId) {
    return drafts.value[conversationId] ?? ''
  }
  function setDraft(conversationId, text) {
    if (conversationId == null) return
    const value = String(text ?? '')
    if (value.trim()) drafts.value[conversationId] = value
    else delete drafts.value[conversationId]
    clearTimeout(draftTimer)
    draftTimer = setTimeout(
      () => writeCompanyEntry(DRAFTS_KEY, companyId.value, drafts.value),
      DRAFT_SAVE_MS,
    )
  }
  function clearDraft(conversationId) {
    if (!(conversationId in drafts.value)) return
    delete drafts.value[conversationId]
    writeCompanyEntry(DRAFTS_KEY, companyId.value, drafts.value)
  }

  // ---------- messages ----------
  function findMessage(conversationId, messageId) {
    const conversation = findConversation(conversationId)
    const message = conversation?.messages.find((m) => String(m.id) === String(messageId))
    return conversation && message ? { conversation, message } : null
  }

  // POST /v1/{company}/direct-channels/{channel}/messages
  // Queue: 20-30 messages ek saath bhejein to bhi tarteeb se jaate hain,
  // aur network / 429 (bahut zyada requests) / 5xx par khud dobara koshish hoti hai.
  function deliver(conversationId, message) {
    if (!message || !isApiSendable(message)) return Promise.resolve()
    const conversation = findConversation(conversationId)
    if (!conversation) return Promise.resolve()
    const line = sendLines.get(conversationId) ?? { waiting: [], active: 0 }
    sendLines.set(conversationId, line)
    if (line.waiting.includes(message.id) || inFlight.has(message.id)) return Promise.resolve()
    message.status = 'sending'
    message.error = ''
    line.waiting.push(message.id)
    pumpSendLine(conversationId, line)
    return Promise.resolve()
  }

  function pumpSendLine(conversationId, line) {
    while (line.active < SEND_CONCURRENCY && line.waiting.length) {
      const localId = line.waiting.shift()
      const found = findMessage(conversationId, localId)
      if (!found || !isApiSendable(found.message)) continue
      line.active += 1
      inFlight.set(localId, conversationId)
      void deliverOne(conversationId, found.message).finally(() => {
        line.active -= 1
        inFlight.delete(localId)
        if (!line.active && !line.waiting.length) sendLines.delete(conversationId)
        else pumpSendLine(conversationId, line)
      })
    }
  }

  async function deliverOne(conversationId, message) {
    const conversation = findConversation(conversationId)
    if (!conversation) return
    const localId = message.id
    try {
      const voiceNoteId = voiceNoteIdOf(message)
      const body = String(message.text ?? '').trim()
      const attachment = pendingAttachmentByMessage.get(localId)
      if (message.attachments?.length && !attachment) {
        throw new Error('The original attachment is no longer available. Please attach it again.')
      }
      // Backend ko message ka text "body" field mein chahiye
      let saved
      for (let attempt = 0; ; attempt += 1) {
        try {
          if (isOffline()) throw new Error(NO_INTERNET)
          saved = await dmApi.sendMessage(companyId.value, conversationId, {
            ...sendPayload(message),
            body: voiceNoteId ? body || 'Voice message' : body,
            ...(attachment ? { attachment } : {}),
            ...(message.attachmentSource ? { attachmentSource: message.attachmentSource } : {}),
            ...(voiceNoteId ? { voice_note_id: String(voiceNoteId) } : {}),
            is_important: Boolean(message.important),
            ...(message.poll_id != null ? { poll_id: message.poll_id } : {}),
          })
          break
        } catch (cause) {
          if (isOffline() || attempt >= MAX_SEND_RETRIES || !isTransient(cause)) throw cause
          await wait(retryDelay(attempt, cause))
        }
      }

      pendingAttachmentByMessage.delete(localId)
      if (!saved?.id) {
        const index = conversation.messages.findIndex((m) => m.id === localId)
        if (index !== -1) {
          message.awaitingServerCopy = true
          delete message.status
          persist(conversation)
        }
        return
      }

      // Server batata hai ke ye message kisne bheja: wahi mera asli user id hai
      if (saved.from && saved.from !== meId.value) {
        meId.value = saved.from
        learnedMe = saved.from
        persistConversations()
      }

      sentDuringFetch.get(conversationId)?.add(saved.id)
      pendingAttachmentByMessage.delete(localId)
      if (deletedWhileSending.delete(localId)) {
        await dmApi.deleteMessage(companyId.value, conversationId, saved.id, bodyOf(saved))
        rememberDeleted(saved.id)
        return
      }
      const localAttachment = message.attachments?.[0]
      const responseAttachments = saved.attachments ?? []
      const attachments = responseAttachments.length
        ? responseAttachments.map((item) => ({
            ...item,
            ...(localAttachment?.localPreviewUrl
              ? { localPreviewUrl: localAttachment.localPreviewUrl }
              : {}),
          }))
        : message.attachments
      const index = conversation.messages.findIndex((m) => m.id === localId)
      if (index === -1) return // user ne beech mein delete kar diya
      const existingIndex = conversation.messages.findIndex(
        (candidate) => candidate.id === saved.id,
      )
      if (existingIndex !== -1 && existingIndex !== index) {
        const existing = conversation.messages[existingIndex]
        conversation.messages.splice(index, 1)
        const mergedIndex = existingIndex > index ? existingIndex - 1 : existingIndex
        conversation.messages.splice(mergedIndex, 1, {
          ...existing,
          ...saved,
          from: saved.from || existing.from || meId.value,
          text: saved.text || existing.text || message.text,
          createdAt: saved.createdAt || existing.createdAt || message.createdAt,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          ...(message.forwardedFrom ? { forwardedFrom: message.forwardedFrom } : {}),
          ...(message.important ? { important: true } : {}),
          ...(message.poll ? { poll: message.poll, poll_id: message.poll_id } : {}),
          ...(attachments?.length ? { attachments } : {}),
          ...(voiceNoteId || saved.voiceNoteId || existing.voiceNoteId
            ? {
                voiceNoteId: String(voiceNoteId || saved.voiceNoteId || existing.voiceNoteId),
              }
            : {}),
        })
      } else {
        conversation.messages.splice(index, 1, {
          ...saved,
          from: saved.from || meId.value,
          text: saved.text || message.text,
          createdAt: saved.createdAt || message.createdAt,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          ...(message.forwardedFrom ? { forwardedFrom: message.forwardedFrom } : {}),
          ...(message.important ? { important: true } : {}),
          ...(attachments?.length ? { attachments } : {}),
          ...(voiceNoteId || saved.voiceNoteId
            ? { voiceNoteId: String(voiceNoteId || saved.voiceNoteId) }
            : {}),
          ...(message.poll ? { poll: message.poll, poll_id: message.poll_id } : {}),
        })
      }
      persist(conversation) // server wala message cache mein
    } catch (cause) {
      message.status = 'failed'
      message.error = errorMessage(cause)
      actionError.value = message.error
      persist(conversation)
    }
    return
  }

  // Backend ko message ka text "body" field mein chahiye
  function sendPayload(message) {
    const replyId = message.replyTo?.id
    return {
      body: bodyOf(message),
      // forward kiya hua: receiver ko bhi "(forwarded)" dikhe
      // Backend ke fields: is_forwarded, forwarded_from_message_id, forward_tag
      ...(message.forwardedFrom
        ? {
            is_forwarded: true,
            forward_tag: message.forwardedFrom,
            forwarded_from: message.forwardedFrom,
            ...(message.forwardedFromMessageId && !String(message.forwardedFromMessageId).startsWith('local-')
              ? { forwarded_from_message_id: String(message.forwardedFromMessageId) }
              : {}),
          }
        : {}),
      ...(REPLY_TO_FIELD && replyId && !String(replyId).startsWith('local-')
        ? { [REPLY_TO_FIELD]: replyId }
        : {}),
    }
  }

  function retryMessage(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found || found.message.status !== 'failed') return false
    void deliver(conversationId, found.message)
    return true
  }

  // Internet wapas aaye to failed messages dobara bhejo
  function flushFailed() {
    for (const conversation of conversations.value) {
      for (const message of conversation.messages) {
        if (message.status === 'failed' && isLocal(message)) void deliver(conversation.id, message)
      }
    }
  }

  function sendMessage(conversationId, payload = {}) {
    const conversation = findConversation(conversationId)
    const text = String(payload.content ?? '').trim()
    // File objects JSON mein save nahi hote, isliye sirf unki details
    const attachment = payload.attachment
    const attachments = attachment
      ? [
          {
            name: attachment.name,
            size: attachment.size,
            type: attachment.type,
            ...(typeof URL.createObjectURL === 'function'
              ? { localPreviewUrl: URL.createObjectURL(attachment) }
              : {}),
          },
        ]
      : []
    if (
      !conversation ||
      (!text && !payload.gif && !payload.poll && !attachments.length && !payload.voiceNoteId)
    ) {
      return null
    }

    const message = {
      id: `local-${Date.now().toString(36)}-${++localSeq}`,
      from: meId.value,
      text,
      createdAt: new Date().toISOString(),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.threadId ? { threadId: payload.threadId } : {}),
      ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
      ...(payload.voiceNoteId ? { voiceNoteId: String(payload.voiceNoteId) } : {}),
      ...(payload.attachmentSource ? { attachmentSource: payload.attachmentSource } : {}),
      ...(attachments.length ? { attachments } : {}),
      ...(payload.important ? { important: true } : {}),
      ...(payload.gif ? { gif: payload.gif } : {}),
      ...(payload.poll ? { poll: payload.poll } : {}),
      ...(payload.poll_id != null ? { poll_id: payload.poll_id } : {}),
      ...(payload.scheduledAt
        ? {
            scheduled: true,
            scheduledAt: payload.scheduledAt,
            timeZone: payload.timeZone || 'local time',
          }
        : {}),
    }
    if (payload.attachment) {
      pendingAttachmentByMessage.set(message.id, payload.attachment)
    }
    const sendable = isApiSendable(message)
    if (sendable) {
      message.status = 'sending'
      message.error = ''
    }

    conversation.messages.push(message)
    persist(conversation)
    if (!payload.threadId) clearDraft(conversation.id)
    if (!payload.scheduledAt) {
      useActivityStore().recordMessageMentions({
        text,
        conversationId: conversation.id,
        conversationName: titleOf(conversation),
        conversationType: 'dm',
      })
    }
    if (sendable) void deliver(conversation.id, message)
    return conversation.messages.at(-1)
  }

  function cancelScheduledMessage(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found?.message.scheduledAt) return false
    found.conversation.messages.splice(found.conversation.messages.indexOf(found.message), 1)
    persist(found.conversation)
    return true
  }

  // PATCH /v1/{company}/direct-channels/{channel}/messages/{message}
  function editMessage(conversationId, messageId, text) {
    const found = findMessage(conversationId, messageId)
    const next = String(text ?? '').trim()
    if (!found || found.message.from !== meId.value || !next || found.message.deleted) return false
    if (found.message.text === next) return true

    const previous = { text: found.message.text, editedAt: found.message.editedAt }
    found.message.text = next
    if ('content' in found.message) found.message.content = next
    found.message.editedAt = new Date().toISOString()
    persist(found.conversation)

    // local (abhi bheja ja raha) message: naya text hi server par jayega
    if (!isLocal(found.message)) void syncEdit(conversationId, found.message.id, next, previous)
    return true
  }

  async function syncEdit(conversationId, messageId, next, previous) {
    pendingEdits.set(messageId, next)
    try {
      // 204 / khali jawab: server ne naya object nahi diya. Bheja hua text (optimistic) hi sahi hai,
      // dobara GET nahi (pehle har edit ke baad ek extra request jati thi)
      const saved = await dmApi.updateMessage(companyId.value, conversationId, messageId, {
        body: bodyOf(findMessage(conversationId, messageId)?.message ?? {}, next),
      })

      const found = findMessage(conversationId, messageId)
      if (saved && found && found.message.text === next) {
        found.message.text = saved.text || next
        if ('content' in found.message) found.message.content = found.message.text
        if (saved.editedAt) found.message.editedAt = saved.editedAt
        persist(found.conversation)
      }
    } catch (cause) {
      if (isRetryableAction(cause)) {
        // offline / server busy: queue mein, naya text screen par rehta hai
        enqueue({ type: 'edit', conversationId, messageId, text: next, previous, editedAt: new Date().toISOString() })
      } else {
        logRejected('PATCH direct-channel message', cause)
        revertEdit(conversationId, messageId, previous)
        actionError.value = errorMessage(cause)
      }
    } finally {
      pendingEdits.delete(messageId)
    }
  }

  function revertEdit(conversationId, messageId, previous) {
    const found = findMessage(conversationId, messageId)
    if (!found) return
    found.message.text = previous.text
    if ('content' in found.message) found.message.content = previous.text
    found.message.editedAt = previous.editedAt
    persist(found.conversation)
  }

  // GET /v1/{company}/direct-channels/{channel}/messages/{message}
  async function fetchSingleMessage(conversationId, messageId) {
    try {
      return (await dmApi.getMessage?.(companyId.value, conversationId, messageId)) ?? null
    } catch {
      return null // edit to ho chuka, sirf confirm nahi ho saka
    }
  }

  // Ek message server se dobara lao (jaise notification se khulne par)
  async function refreshMessage(conversationId, messageId) {
    const saved = await fetchSingleMessage(conversationId, messageId)
    const conversation = findConversation(conversationId)
    if (!saved || !conversation) return null
    const index = conversation.messages.findIndex((m) => m.id === saved.id)
    if (index === -1) conversation.messages.push(saved)
    else conversation.messages.splice(index, 1, carryExtras(saved, conversation.messages[index]))
    persist(conversation)
    return saved
  }

  // PATCH /v1/{company}/direct-channels/{channel}/messages/{message}
  // Delete: message gayab nahi hota, "(message deleted)" dikhta hai (dono users ko)
  // deleteAt (ISO, future): "Schedule Delete" - us waqt khud delete
  function deleteMessage(conversationId, messageId, deleteAt = null) {
    const found = findMessage(conversationId, messageId)
    if (!found || found.message.from !== meId.value || found.message.deleted) return false

    const { conversation, message } = found
    const at = deleteAt ? Date.parse(deleteAt) : NaN
    if (Number.isFinite(at) && at > Date.now()) {
      message.deleteScheduledAt = new Date(at).toISOString()
      persist(conversation)
      armScheduledDeletes()
      return true
    }
    delete message.deleteScheduledAt

    if (isLocal(message)) {
      // server par gaya hi nahi: seedha hata do (POST chal rahi ho to jawab aate hi server se bhi)
      if (inFlight.has(message.id)) deletedWhileSending.add(message.id)
      conversation.messages.splice(conversation.messages.indexOf(message), 1)
      persist(conversation)
      return true
    }
    message.deleted = true
    persist(conversation)
    void syncDelete(conversationId, message.id)
    return true
  }

  // Maine delete kiye messages: backend soft-delete kare aur flag na bheje, tab bhi "(message deleted)"
  const deletedByMe = new Set(readCompanyEntry(DELETED_KEY, companyId.value, []) ?? [])
  function rememberDeleted(messageId) {
    deletedByMe.add(String(messageId))
    writeCompanyEntry(DELETED_KEY, companyId.value, [...deletedByMe].slice(-500))
  }

  async function syncDelete(conversationId, messageId) {
    pendingDeletes.add(messageId)
    const body = findMessage(conversationId, messageId)?.message?.text ?? ''
    try {
      await dmApi.deleteMessage(companyId.value, conversationId, messageId, body)
      rememberDeleted(messageId)
    } catch (cause) {
      if (isRetryableAction(cause)) {
        enqueue({ type: 'delete', conversationId, messageId, body })
      } else {
        logRejected('DELETE direct-channel message', cause)
        revertDelete(conversationId, messageId)
        actionError.value = errorMessage(cause)
      }
    } finally {
      pendingDeletes.delete(messageId)
    }
  }

  function revertDelete(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found) return
    found.message.deleted = false
    persist(found.conversation)
  }

  function cancelScheduledDelete(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found?.message.deleteScheduledAt) return false
    delete found.message.deleteScheduledAt
    persist(found.conversation)
    armScheduledDeletes()
    return true
  }

  // Schedule Delete ke timers (reload ke baad bhi: cache se wapas arm)
  const deleteTimers = new Map() // messageId -> timer
  function armScheduledDeletes() {
    if (typeof window === 'undefined') return
    for (const timer of deleteTimers.values()) clearTimeout(timer)
    deleteTimers.clear()
    for (const conversation of conversations.value) {
      for (const message of conversation.messages) {
        if (!message.deleteScheduledAt || message.deleted) continue
        const due = Date.parse(message.deleteScheduledAt) - Date.now()
        const timer = setTimeout(
          () => {
            deleteTimers.delete(message.id)
            if (Date.parse(message.deleteScheduledAt) > Date.now()) return armScheduledDeletes()
            deleteMessage(conversation.id, message.id)
          },
          Math.max(0, Math.min(due, MAX_TIMER_MS)),
        )
        deleteTimers.set(message.id, timer)
      }
    }
  }

  function listPinnedMessages(conversationId, messageId) {
    return dmApi.listPinnedMessages(companyId.value, conversationId, messageId)
  }

  function pinMessage(conversationId, messageId) {
    return dmApi.pinMessage(companyId.value, conversationId, messageId)
  }

  function unpinMessage(conversationId, messageId) {
    return dmApi.unpinMessage(companyId.value, conversationId, messageId)
  }

  function setReactionPicker(messageId) {
    reactionPickerFor = messageId ?? null
  }

  function toggleReaction(conversationId, messageId, emoji) {
    const found = findMessage(conversationId, messageId)
    if (!found || !emoji || found.message.deleted) return false

    // Picker se wahi emoji dobara: hatao mat (hatana sirf pill par click se)
    const alreadyMine = (found.message.reactions ?? []).some(
      (r) => r.emoji === emoji && r.users.includes(meId.value),
    )
    if (alreadyMine && reactionPickerFor != null && String(reactionPickerFor) === String(messageId)) {
      return true
    }

    found.message.reactions = applyReaction(found.message.reactions, emoji, meId.value)
    persist(found.conversation)

    if (!isLocal(found.message)) void syncReaction(conversationId, found.message.id, emoji)
    return true
  }

  // POST .../messages/{message}/reactions (reactionsApi: ek hi call add bhi, remove bhi)
  async function syncReaction(conversationId, messageId, emoji) {
    const seq = (reactionSeq.get(messageId) ?? 0) + 1
    reactionSeq.set(messageId, seq)
    try {
      const server = await reactionsApi.toggleReaction(
        { companyId: companyId.value, channelId: conversationId, messageId },
        emoji,
      )
      // Beech mein user ne dobara click kiya to purana jawab na lagao
      const found = findMessage(conversationId, messageId)
      if (Array.isArray(server) && found && reactionSeq.get(messageId) === seq) {
        found.message.reactions = server
        persist(found.conversation)
      }
    } catch (cause) {
      if (isRetryableAction(cause)) {
        enqueue({ type: 'reaction', conversationId, messageId, emoji })
      } else {
        // Fail: yahi toggle dobara chala kar wapas (toggle apna ulta khud hai)
        revertReaction(conversationId, messageId, emoji)
        actionError.value = errorMessage(cause)
      }
    } finally {
      if (reactionSeq.get(messageId) === seq) reactionSeq.delete(messageId)
    }
  }

  function revertReaction(conversationId, messageId, emoji) {
    const found = findMessage(conversationId, messageId)
    if (!found) return
    found.message.reactions = applyReaction(found.message.reactions, emoji, meId.value)
    persist(found.conversation)
  }

  // ---------- (naya) PATCH /v1/{company}/direct-channels/{channel}/recent ----------
  // 1) Pehle local: conversation.recentAt + localStorage (list foran upar, reload ke baad bhi)
  // 2) Phir network. Offline / network / 5xx: outbox (localStorage) -> internet aate hi khud.
  //    4xx: local tarteeb rehti hai, row par "sync nahi hua" + Retry.
  // Status (sirf UI ke liye): 'saving' | 'pending' | 'error' | '' (synced)
  const recentSync = ref({})
  const recentErrors = ref({}) // (naya) ! ki wajah (tooltip + console)
  const recentSentAt = new Map()
  // Har fail ki wajah: console (dev) + row ka tooltip. Status na ho to error ka message.
  function noteRecentFailure(id, cause, gaveUp = false) {
    const status = httpStatusOf(cause)
    const reason = `${status ? `${status} ` : ''}${errorMessage(cause) || cause?.message || 'Unknown error'}`
    recentErrors.value = { ...recentErrors.value, [String(id)]: gaveUp ? `${reason} (gave up after retries)` : reason }
    const dev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
    if (dev && typeof console !== 'undefined') {
      console.warn(`[dms] recent sync failed for ${id}: ${reason}`, cause?.response?.data ?? cause?.details ?? cause)
    }
  }
  function recentErrorOf(id) {
    return recentErrors.value[String(id)] ?? ''
  }
  function setRecentStatus(id, status) {
    const key = String(id)
    if ((recentSync.value[key] ?? '') === status) return
    const next = { ...recentSync.value }
    if (status) next[key] = status
    else delete next[key]
    recentSync.value = next
  }
  function recentStatusOf(id) {
    const status = recentSync.value[String(id)]
    if (status) return status
    return outbox.value.some((o) => o.type === 'recent' && String(o.conversationId) === String(id))
      ? 'pending'
      : ''
  }
  function applyRecentResult(id, serverAt) {
    const conversation = findConversation(id)
    // server ka waqt pakka hai (messages ke waqt bhi server ke hain); na aaye to local hi rehta hai
    if (conversation && serverAt && conversation.recentAt !== serverAt) {
      conversation.recentAt = serverAt
      persistConversations()
    }
    recentSentAt.set(String(id), Date.now())
    if (!outbox.value.some((o) => o.type === 'recent' && String(o.conversationId) === String(id))) {
      setRecentStatus(id, '')
      if (recentErrors.value[String(id)]) {
        const next = { ...recentErrors.value }
        delete next[String(id)]
        recentErrors.value = next
      }
    }
  }
  // Server jawab na de to 408 (retry wala error): na spinner atke, na outbox ruke
  function markRecentRequest(id, at) {
    let timer
    return Promise.race([
      dmApi.markRecent(companyId.value, id, at),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error('Request timed out'), { status: 408 })),
          RECENT_TIMEOUT_MS,
        )
      }),
    ]).finally(() => clearTimeout(timer))
  }
  async function touchRecent(id, { force = false } = {}) {
    const conversation = findConversation(id)
    if (!conversation || String(conversation.id).startsWith('local-')) return false
    if (typeof dmApi.markRecent !== 'function') return false
    const key = String(conversation.id)
    const at = new Date().toISOString()

    // 1) optimistic: foran local + localStorage
    conversation.recentAt = laterOf(conversation.recentAt, at)
    persistConversations()

    const status = recentStatusOf(key)
    if (status === 'saving') return true // request chal rahi hai
    if (!force && status !== 'error' && Date.now() - (recentSentAt.get(key) ?? 0) < RECENT_THROTTLE_MS) {
      return true
    }

    // 2) network
    const queue = () => {
      enqueue({ type: 'recent', conversationId: key, at: conversation.recentAt })
      setRecentStatus(key, 'pending')
    }
    // Offline, ya company (workspace) abhi load nahi hui: queue mein intezar (! nahi)
    if (isOffline() || !companyId.value) {
      queue()
      return true
    }
    setRecentStatus(key, 'saving')
    try {
      const serverAt = await markRecentRequest(key, conversation.recentAt)
      // pehle se queue mein tha to woh bhi ho gaya
      const before = outbox.value.length
      outbox.value = outbox.value.filter((o) => !(o.type === 'recent' && String(o.conversationId) === key))
      if (outbox.value.length !== before) saveOutbox()
      applyRecentResult(key, serverAt)
      return true
    } catch (cause) {
      if (isRetryableAction(cause)) {
        queue() // retry: outbox (backoff, max OUTBOX_MAX_ATTEMPTS), 'online' par bhi
        return true
      }
      noteRecentFailure(key, cause)
      setRecentStatus(key, 'error')
      return false
    }
  }
  // Row ke "Retry" ke liye
  function retryRecent(id) {
    return touchRecent(id, { force: true })
  }

  // ---------- outbox: offline / network fail par edit, delete, reaction ki queue ----------
  // localStorage mein rehti hai (reload ke baad bhi). Internet aate hi / har poll par tarteeb se.
  const outbox = ref(readCompanyEntry(OUTBOX_KEY, companyId.value, []) ?? [])
  let outboxFlushing = null
  let outboxRetryTimer = null
  watch(companyId, (company) => {
    outbox.value = readCompanyEntry(OUTBOX_KEY, company, []) ?? []
  })
  function saveOutbox() {
    writeCompanyEntry(OUTBOX_KEY, companyId.value, outbox.value)
  }
  function markSyncPending(conversationId, messageId, value) {
    const found = findMessage(conversationId, messageId)
    if (!found) return
    if (value) found.message.syncPending = true
    else delete found.message.syncPending
  }

  function enqueue(item) {
    const same = (o) =>
      o.type === item.type &&
      String(o.conversationId) === String(item.conversationId) &&
      o.messageId === item.messageId
    if (item.type === 'reaction') {
      // wahi emoji do dafa = kuch nahi
      const index = outbox.value.findIndex((o) => same(o) && o.emoji === item.emoji)
      if (index !== -1) {
        outbox.value.splice(index, 1)
        saveOutbox()
        if (!outbox.value.some((o) => o.messageId === item.messageId)) {
          markSyncPending(item.conversationId, item.messageId, false)
        }
        return
      }
    } else if (item.type === 'edit') {
      const existing = outbox.value.find(same)
      if (existing) {
        existing.text = item.text // pehla "previous" hi rakho (revert ke liye)
        saveOutbox()
        return
      }
    } else if (item.type === 'recent') {
      // (naya) ek conversation ka ek hi "recent": sirf sab se naya waqt bhejo
      const existing = outbox.value.find(same)
      if (existing) {
        existing.at = laterOf(existing.at, item.at)
        saveOutbox()
        scheduleOutboxRetry()
        return
      }
    } else if (item.type === 'delete') {
      // delete ho raha hai: is message ki edit/reaction bhejne ka faida nahi
      outbox.value = outbox.value.filter(
        (o) => !(String(o.conversationId) === String(item.conversationId) && o.messageId === item.messageId),
      )
    }
    outbox.value.push({ ...item, attempts: 0, queuedAt: new Date().toISOString() })
    markSyncPending(item.conversationId, item.messageId, true)
    saveOutbox()
    scheduleOutboxRetry()
  }

  function scheduleOutboxRetry() {
    if (typeof window === 'undefined' || outboxRetryTimer) return
    outboxRetryTimer = setTimeout(() => {
      outboxRetryTimer = null
      void flushOutbox()
    }, OUTBOX_RETRY_MS)
  }

  function applyOutboxOverlays() {
    for (const item of outbox.value) {
      const found = findMessage(item.conversationId, item.messageId)
      if (!found) continue
      overlayPending(item.conversationId, found.message, found.message)
    }
  }

  async function runOutboxItem(item) {
    const target = { companyId: companyId.value, channelId: item.conversationId, messageId: item.messageId }
    if (item.type === 'edit') {
      return dmApi.updateMessage(companyId.value, item.conversationId, item.messageId, {
        body: bodyOf(findMessage(item.conversationId, item.messageId)?.message ?? {}, item.text),
      })
    }
    if (item.type === 'delete') {
      const result = await dmApi.deleteMessage(
        companyId.value,
        item.conversationId,
        item.messageId,
        item.body ?? '',
      )
      rememberDeleted(item.messageId)
      return result
    }
    if (item.type === 'reaction') return reactionsApi.toggleReaction(target, item.emoji)
    if (item.type === 'recent') return markRecentRequest(item.conversationId, item.at)
    return null
  }

  function revertOutboxItem(item) {
    if (item.type === 'edit') revertEdit(item.conversationId, item.messageId, item.previous ?? {})
    if (item.type === 'delete') revertDelete(item.conversationId, item.messageId)
    if (item.type === 'reaction') revertReaction(item.conversationId, item.messageId, item.emoji)
    // (naya) recent: local tarteeb rehne do (user ne waqai khola tha), sirf row par "sync nahi hua"
    if (item.type === 'recent') setRecentStatus(item.conversationId, 'error')
  }

  function flushOutbox() {
    if (outboxFlushing) return outboxFlushing
    // (naya) company (workspace) load hone tak ruko: warna har item 'company ID required' par fail
    if (!outbox.value.length || isOffline() || !companyId.value) return Promise.resolve()
    outboxFlushing = (async () => {
      try {
        while (outbox.value.length && !isOffline()) {
          const item = outbox.value[0]
          try {
            const result = await runOutboxItem(item)
            outbox.value.shift()
            if (item.type === 'recent') applyRecentResult(item.conversationId, result)
            if (item.type === 'reaction' && Array.isArray(result)) {
              const found = findMessage(item.conversationId, item.messageId)
              if (found && !outbox.value.some((o) => o.messageId === item.messageId)) {
                found.message.reactions = result
                persist(found.conversation)
              }
            }
          } catch (cause) {
            if (isRetryableAction(cause) && item.attempts + 1 < OUTBOX_MAX_ATTEMPTS) {
              item.attempts += 1
              saveOutbox()
              scheduleOutboxRetry()
              return // tarteeb na toote: baad mein yahin se
            }
            outbox.value.shift()
            revertOutboxItem(item)
            if (item.type === 'recent') noteRecentFailure(item.conversationId, cause, isRetryableAction(cause))
            else actionError.value = errorMessage(cause) // recent background hai: toast nahi, row par nishan
          }
          if (!outbox.value.some((o) => o.messageId === item.messageId)) {
            markSyncPending(item.conversationId, item.messageId, false)
            const found = findMessage(item.conversationId, item.messageId)
            if (found) persist(found.conversation)
          }
          saveOutbox()
        }
      } finally {
        outboxFlushing = null
      }
    })()
    return outboxFlushing
  }

  // ---------- sab se naya page (backend pagination: per_page 15) ----------
  // Backend page 1 mein naye bhej sakta hai ya purane. Pehli dafa aakhri page bhi dekh kar pata
  // karte hain: agar aakhri page naya hai (order 'asc') to hamesha wahi mangwate hain.
  // reactive proxy wapas do (raw object badalne se "Loading…" kabhi na hat-ta)
  function pageState(id) {
    if (!olderState.value[id]) {
      olderState.value[id] = {
        order: null,
        lastPage: null,
        nextPage: null,
        hasMore: null,
        loading: false,
        busy: false,
        error: '',
      }
    }
    return olderState.value[id]
  }

  async function fetchLatestPage(id) {
    const state = pageState(id)
    const company = companyId.value
    if (state.order === 'asc' && state.lastPage > 1) {
      let latest = await dmApi.listMessages(company, id, { page: state.lastPage })
      const grown = latest.pagination?.lastPage
      if (grown && grown > state.lastPage) {
        // naye messages se naya page ban gaya
        const extra = await dmApi.listMessages(company, id, { page: grown })
        latest = [...latest, ...extra]
        state.lastPage = grown
        state.nextPage = grown - 1
      }
      return latest
    }
    const first = await dmApi.listMessages(company, id)
    const info = first.pagination ?? {}
    if (state.order == null && info.lastPage > 1) {
      const last = await dmApi.listMessages(company, id, { page: info.lastPage })
      if (newestTime(last) > newestTime(first)) {
        state.order = 'asc' // page 1 = sab se purane
        state.lastPage = info.lastPage
        state.nextPage = info.lastPage - 1
        state.hasMore = true
        return last
      }
      state.order = 'desc'
    }
    if (state.order == null && info.hasMore != null) state.order = 'desc'
    if (state.order !== 'asc') {
      state.nextPage ??= 2
      if (info.hasMore != null && state.nextPage === 2) state.hasMore = info.hasMore
    }
    return first
  }

  // Server ne hamara message save kar liya aur list mein aa gaya, lekin POST ka jawab abhi
  // raaste mein hai (ya jawab mein message tha hi nahi): apni copy foran hata do (dohra na dikhe)
  function reconcileInFlight(conversation) {
    const waiting = conversation.messages.filter(
      (m) =>
        isLocal(m) &&
        ((m.status === 'sending' && inFlight.get(m.id) === conversation.id) || m.awaitingServerCopy),
    )
    if (!waiting.length) return
    for (const local of waiting) {
      const at = timeOf(local)
      // Waqt mein sab se qareeb wali copy (pehla milta-julta purana "hi" nahi)
      const copy = conversation.messages
        .filter(
          (m) =>
            !isLocal(m) &&
            !confirmedIds.has(m.id) &&
            !m.deleted &&
            m.from === meId.value &&
            m.text === local.text &&
            (!Number.isFinite(at) || !Number.isFinite(timeOf(m)) || timeOf(m) >= at - 60_000),
        )
        .sort((x, y) => Math.abs(timeOf(x) - at) - Math.abs(timeOf(y) - at))[0]
      if (!copy) continue
      confirmedIds.add(copy.id)
      for (const key of ['replyTo', 'forwardedFrom', 'important', 'reactions']) {
        if (local[key] != null && copy[key] == null) copy[key] = local[key]
      }
      conversation.messages.splice(conversation.messages.indexOf(local), 1)
    }
  }

  // Reload se pehle queue mein the: server par pehle se pahunch gaye hon to hata do, warna bhejo
  function resumePending(conversation) {
    for (const message of [...conversation.messages]) {
      if (!message.resend || !isLocal(message)) continue
      const sentAt = timeOf(message)
      const already = conversation.messages.some(
        (m) =>
          !isLocal(m) &&
          m.from === meId.value &&
          m.text === message.text &&
          Math.abs(timeOf(m) - sentAt) < 5 * 60_000,
      )
      if (already) {
        conversation.messages.splice(conversation.messages.indexOf(message), 1)
      } else {
        void deliver(conversation.id, message)
      }
    }
  }

  // ---------- purane messages (server pagination) ----------
  // Server par is chat ke aur purane messages hain?
  function hasMoreOlder(conversationId) {
    const state = olderState.value[conversationId]
    if (state?.hasMore === false) return false
    if (state?.hasMore === true) return true
    const conversation = findConversation(conversationId)
    const serverCount = conversation?.messages.filter((m) => !isLocal(m)).length ?? 0
    return serverCount >= LIKELY_PAGE_SIZE // backend ne nahi bataya: poora page aaya to shayad aur hain
  }

  function isLoadingOlder(conversationId) {
    return Boolean(olderState.value[conversationId]?.loading)
  }

  // GET .../messages?page=N  (purane messages upar jodo, koi mitta nahi)
  async function loadOlderMessages(conversationId) {
    const conversation = findConversation(conversationId)
    if (!conversation) return 0
    const state = pageState(conversationId)
    state.nextPage ??= state.order === 'asc' ? state.lastPage - 1 : 2
    if (state.busy || state.hasMore === false || state.nextPage < 1) return 0
    state.busy = true
    state.loading = true // "Loading…" sirf thodi der (OLDER_LOADING_MAX_MS), request peeche chalti rahe
    const hideLoading = setTimeout(() => {
      state.loading = false
    }, OLDER_LOADING_MAX_MS)
    state.error = ''
    try {
      const page = await dmApi.listMessages(companyId.value, conversationId, { page: state.nextPage })
      const target = findConversation(conversationId)
      if (!target) return 0
      const have = new Set(target.messages.map((m) => m.id))
      const fresh = withoutThreadReplies(page).filter((m) => !have.has(m.id))
      if (fresh.length) {
        target.messages = [...fresh, ...target.messages.filter((m) => !isLocal(m))]
          .sort(byTime)
          .concat(target.messages.filter((m) => isLocal(m)))
        fresh.forEach((m) => seenIds.get(conversationId)?.add(m.id)) // purane: notification nahi
        persist(target)
      }
      if (state.order === 'asc') {
        state.nextPage -= 1 // aur purana = pichla page number
        state.hasMore = fresh.length > 0 && state.nextPage >= 1
      } else {
        state.nextPage += 1
        state.hasMore = fresh.length ? (page.pagination?.hasMore ?? true) : false
      }
      return fresh.length
    } catch (cause) {
      state.error = errorMessage(cause)
      return 0
    } finally {
      clearTimeout(hideLoading)
      state.loading = false
      state.busy = false
    }
  }

  // ---------- unread (chat khole bina laal ginti) ----------
  function readMap(company = companyId.value) {
    return readCompanyEntry(READ_KEY, company)
  }
  function saveReadAt(conversationId, value) {
    const all = readJson(READ_KEY)
    const company = companyId.value
    all[company] = all[company] ?? {}
    if (all[company][conversationId] === value) return
    all[company][conversationId] = value
    writeJson(READ_KEY, all)
  }
  const isIncoming = (m) =>
    Boolean(m.from) && m.from !== meId.value && !m.deleted && !isLocal(m) && !m.scheduledAt
  const latestAt = (conversation) => {
    const latest = Math.max(
      lastActivity(conversation),
      Date.parse(conversation.lastActivityAt) || 0,
    )
    return new Date(latest).toISOString()
  }

  // Conversation khuli: sab padh liya (server ke waqt se, taake ghari ka farq na pade)
  function markRead(conversation) {
    conversation.unreadCount = 0
    saveReadAt(conversation.id, latestAt(conversation))
  }

  // Unread = padhne ke baad aaye doosron ke messages.
  // Backend ka unread_count tab hi jab humne kabhi padha hi nahi (warna wo "padh liya" nahi
  // jaanta aur badge khulne ke baad bhi wapas aa jata tha).
  function refreshUnread(conversation, { firstRun = false, apiUnread = 0 } = {}) {
    const visible = typeof document === 'undefined' || !document.hidden
    if (String(conversation.id) === String(activeId.value) && visible) {
      markRead(conversation)
      return
    }
    let readAt = readMap()?.[conversation.id]
    if (readAt == null) {
      if (firstRun) {
        // App pehli dafa: purani history ko unread na ginein
        saveReadAt(conversation.id, latestAt(conversation))
        conversation.unreadCount = apiUnread
        return
      }
      readAt = new Date(0).toISOString() // nayi conversation: kabhi kholi nahi
    }
    const since = Date.parse(readAt) || 0
    const count = conversation.messages.filter((m) => isIncoming(m) && timeOf(m) > since).length
    // List batati hai ke padhne ke baad activity hui, lekin messages abhi aaye nahi
    const activityAfterRead = (Date.parse(conversation.lastActivityAt) || 0) > since
    conversation.unreadCount = count || (activityAfterRead && apiUnread ? apiUnread : 0)
  }

  // ---------- notification: naya message aaya ----------
  function detectIncoming(conversation) {
    reopenIfNewIncoming(conversation) // (naya) band DM mein naya message: list mein wapas
    let seen = seenIds.get(conversation.id)
    if (!seen) {
      seen = new Set()
      seenIds.set(conversation.id, seen)
      // App khulte waqt ke purane messages par notification nahi
      if (!firstListLoaded) {
        conversation.messages.forEach((m) => seen.add(m.id))
        return
      }
    }
    const visible = typeof document === 'undefined' || !document.hidden
    for (const message of conversation.messages) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      if (!isIncoming(message)) continue
      if (conversation.id === activeId.value && visible) continue // samne khuli hai
      notify(conversation, message)
    }
  }

  function notify(conversation, message) {
    const sender = usersById.value[message.from]?.name || titleOf(conversation)
    const text =
      message.text ||
      (message.attachments?.length ? 'Sent an attachment' : message.gif ? 'Sent a GIF' : 'New message')
    const item = {
      id: `n${++notificationSeq}`,
      conversationId: conversation.id,
      messageId: message.id,
      title: conversation.type === 'group' ? titleOf(conversation) : sender,
      sender,
      text,
    }
    notifications.value = [...notifications.value, item].slice(-4)
    if (typeof window !== 'undefined') setTimeout(() => dismissNotification(item.id), NOTIFICATION_MS)

    // Tab chhupi ho aur browser ki ijazat ho to system notification bhi
    try {
      if (
        typeof document !== 'undefined' &&
        document.hidden &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(item.title, { body: `${sender}: ${text}`, tag: item.id })
      }
    } catch {
      /* browser notification nahi chali */
    }
  }

  function dismissNotification(id) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  // Chat khul gayi: us chat ki notifications band (hasNewMessage false ho sakti hai)
  function dismissConversationNotifications(conversationId) {
    notifications.value = notifications.value.filter((n) => n.conversationId !== conversationId)
  }

  // ---------- polling: dusre user ke naye / edit / delete messages ----------
  // Backend par abhi realtime (socket) nahi hai, isliye active conversation ko
  // har POLL_INTERVAL ms baad GET .../messages se check karte hain
  let polling = null
  function pollOnce() {
    if (polling) return polling // pichla poll abhi chal raha: dhair na lage
    polling = (async () => {
      if (isOffline()) return
      const hidden = typeof document !== 'undefined' && document.hidden
      pollTicks += 1
      if (outbox.value.length) void flushOutbox()
      if (pollTicks % LIST_REFRESH_EVERY === 0) {
        await init() // naye DM
        await checkOtherConversations() // band DMs ke naye messages -> unread + notification
      }
      // tab chhupi ho to khuli chat har 4 sec nahi (sirf upar wala ~16 sec check)
      // bhejne ki queue chal rahi ho to GET ruk jaye (backend ki request limit na bhare)
      if (!hidden && activeId.value && !queuedCount.get(activeId.value)) {
        await fetchMessages(activeId.value, { silent: true })
      }
    })().finally(() => {
      polling = null
    })
    return polling
  }

  // Band DMs: jin ki aakhri activity badli (ya backend batata hi nahi) unke messages chupke se
  async function checkOtherConversations() {
    const hidden = typeof document !== 'undefined' && document.hidden
    const changed = conversations.value.filter((conversation) => {
      if (conversation.id === activeId.value && !hidden) return false
      const before = lastActivityById.get(conversation.id)
      const now = conversation.lastActivityAt || ''
      lastActivityById.set(conversation.id, now)
      // Backend last_message_at na badle tab bhi har ~1 minute check (unread badge kabhi na atke)
      const stale = Date.now() - (lastBackgroundFetch.get(conversation.id) ?? 0) > BACKGROUND_REFRESH_MS
      return !now || before === undefined || before !== now || stale
    })
    const ordered = [...changed].sort((a, b) => lastActivity(b) - lastActivity(a))
    await Promise.all(
      ordered.slice(0, MAX_BACKGROUND_FETCH).map((conversation) => {
        lastBackgroundFetch.set(conversation.id, Date.now())
        return fetchMessages(conversation.id, { silent: true })
      }),
    )
  }

  function startPolling(interval = POLL_INTERVAL) {
    if (pollTimer || typeof window === 'undefined') return
    pollTimer = setInterval(() => void pollOnce(), interval)
  }

  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = null
  }

  // ---------- network wapas aaye / tab par wapas aaye ----------
  if (typeof window !== 'undefined') {
    // Dusre tab se wapas aate hi foran check (4 sec ka intezar nahi)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !pollTimer) return
      void pollOnce()
      void init() // nayi DM / naya invite foran
    })
    window.addEventListener('focus', () => {
      if (pollTimer) void pollOnce()
    })
    window.addEventListener('online', () => {
      void flushOutbox()
      void init().then(() => {
        flushFailed()
        if (activeId.value) void loadMessages(activeId.value, { force: true })
      })
    })
  }

  return {
    meId,
    conversations,
    usersById,
    users,
    activeId,
    activeConversation,
    loading,
    error,
    offline,
    detailLoading,
    detailError,
    messagesLoading,
    messagesError,
    actionError,
    companyMembers,
    companyMembersLoading,
    companyMembersError,
    customStatusError,
    sorted,
    totalUnread,
    suggestedUsers,
    outbox,
    drafts,
    init,
    ensureLoaded,
    loadCompanyMembers,
    loadCustomStatuses,
    openConversation,
    loadMessages,
    closeConversation,
    deactivateConversation,
    startDm,
    startGroup,
    titleOf,
    partnerId,
    isFavorite,
    toggleFavorite,
    getDraft,
    setDraft,
    clearDraft,
    sendMessage,
    retryMessage,
    cancelScheduledMessage,
    editMessage,
    deleteMessage,
    cancelScheduledDelete,
    listPinnedMessages,
    pinMessage,
    unpinMessage,
    toggleReaction,
    refreshMessage,
    hasMoreOlder,
    isLoadingOlder,
    loadOlderMessages,
    setReactionPicker,
    markThreadReplies,
    threadInfo,
    noteThreadReplies,
    touchRecent,
    retryRecent,
    recentStatusOf,
    recentErrorOf,
    recentSync,
    threadRepliesOf,
    mergeThreadReplies,
    notifications,
    hasNewMessage,
    dismissNotification,
    flushOutbox,
    pollOnce,
    startPolling,
    stopPolling,
    clearCache,
  }
})