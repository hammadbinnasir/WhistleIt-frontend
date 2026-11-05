import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'
import { useTeamsStore } from '@/stores/teams'

// localStorage: har conversation ke messages  -> { [company]: { [conversationId]: messages[] } }
const STORAGE_KEY = 'whistleit:dm-messages'
// localStorage: conversations ki list + users -> { [company]: { userId, me, conversations, users } }
const CONVERSATIONS_KEY = 'whistleit:dm-conversations'
const MAX_CACHED_MESSAGES = 200
// Naye messages (dusre user ke) lane ke liye active conversation har itne ms baad check hoti hai
const POLL_INTERVAL = 4000
// Har itne polls baad conversations ki list bhi (naye DM / unread ke liye)
const LIST_REFRESH_EVERY = 8

// API in fields ko nahi bhejti/lauti, isliye ye local cache se wapas jodte hain
const EXTRA_KEYS = ['reactions', 'replyTo', 'forwardedFrom', 'important', 'editedAt']

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error?.message ?? error)
}

const isLocal = (message) => String(message.id).startsWith('local-')

// API abhi sirf text messages support karti hai.
// GIF, poll, attachments aur scheduled messages sirf local rehte hain.
const isApiSendable = (message) =>
  !message.gif && !message.poll && !message.attachments && !message.scheduledAt

function carryExtras(message, old) {
  if (!old) return message
  for (const key of EXTRA_KEYS) {
    if (message[key] == null && old[key] != null) message[key] = old[key]
  }
  return message
}

// ---- localStorage helpers ----
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full / blocked: memory mein to rehta hai */
  }
}
function readLocal() {
  return readJson(STORAGE_KEY)
}
function saveLocal(companyId, conversationId, messages) {
  const all = readLocal()
  all[companyId] = all[companyId] ?? {}
  all[companyId][conversationId] = messages
  writeJson(STORAGE_KEY, all)
}
function readConversationCache(companyId) {
  return readJson(CONVERSATIONS_KEY)[companyId] ?? null
}
function saveConversationCache(companyId, data) {
  const all = readJson(CONVERSATIONS_KEY)
  all[companyId] = data
  writeJson(CONVERSATIONS_KEY, all)
}

function lastActivity(conversation) {
  const times = conversation.messages
    .filter((m) => !m.scheduledAt)
    .map((m) => Date.parse(m.createdAt))
    .filter(Number.isFinite)
  return times.length ? Math.max(...times) : 0
}

export const useDmStore = defineStore('dms', () => {
  const teamsStore = useTeamsStore()

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

  const detailLoaded = new Set()
  const detailRequests = new Map()
  const messagesLoaded = new Set()
  const messageRequests = new Map()
  let initialization = null
  let localSeq = 0
  // Polling ke dauran in-flight edit/delete/send: purani GET list inhe ulta na kar de
  const pendingEdits = new Map() // messageId -> naya text
  const pendingDeletes = new Set() // messageId
  const sentDuringFetch = new Map() // conversationId -> Set(server message ids)
  let pollTimer = null
  let pollTicks = 0
  let learnedMe = '' // server ke jawab se seekha hua apna asli user id

  const companyId = computed(() => teamsStore.activeWorkspaceId)

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

  function findConversation(id) {
    return conversations.value.find((c) => c.id === id) ?? null
  }

  // ---------- local cache ----------
  // Conversation ke saare messages (API + local) localStorage mein
  function persist(conversation) {
    saveLocal(companyId.value, conversation.id, conversation.messages.slice(-MAX_CACHED_MESSAGES))
  }

  // Conversations ki list + users localStorage mein
  function persistConversations() {
    saveConversationCache(companyId.value, {
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
    const saved = readLocal()[company]?.[conversation.id] ?? []
    const savedById = new Map(saved.map((m) => [m.id, m]))
    for (const message of conversation.messages) carryExtras(message, savedById.get(message.id))

    const have = new Set(conversation.messages.map((m) => m.id))
    const missing = saved
      .filter((m) => !have.has(m.id))
      // page reload par jo "sending" tha wo ab bheja nahi ja raha: failed dikhao
      .map((m) => (m.status === 'sending' ? { ...m, status: 'failed', error: 'Not sent' } : m))
    conversation.messages.push(...missing)
  }

  // Network na ho to pichla saved data dikhao
  function hydrateFromCache(company) {
    const cached = readConversationCache(company)
    if (!cached?.conversations?.length || cached.userId !== dmApi.meId()) return false

    mergeUsers(Object.values(cached.users ?? {}))
    if (cached.me) {
      meId.value = cached.me
      learnedMe = cached.me
    }
    conversations.value = cached.conversations.map((conversation) => {
      const restored = { ...conversation, messages: [] }
      mergeCachedMessages(company, restored)
      return restored
    })
    return true
  }

  // Logout par call karein taake dusre user ko pichla data na dikhe
  function clearCache() {
    stopPolling()
    learnedMe = ''
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(CONVERSATIONS_KEY)
    } catch {
      /* ignore */
    }
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
        (readConversationCache(company)?.conversations ?? [])
          .filter((c) => c.isFavorite)
          .map((c) => c.id),
      )

      try {
        // 2) Phir API se taaza data
        const entries = await dmApi.listDirectChannels(company)
        const previous = new Map(conversations.value.map((c) => [c.id, c]))

        conversations.value = entries.map(({ conversation, users }) => {
          mergeUsers(users)
          mergeCachedMessages(company, conversation)
          if (previous.get(conversation.id)?.isFavorite || cachedFavorites.has(conversation.id)) {
            conversation.isFavorite = true
          }
          if (conversation.id === activeId.value) conversation.unreadCount = 0 // khuli hui hai
          return conversation
        })
        resolveMe(Object.values(usersById.value))
        if (needsNames()) void fillMissingNames(company)

        offline.value = false
        conversations.value.forEach(persist)
        persistConversations()
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

  // Apna user id: authUser se match na ho to email/naam se company members mein dhoondo
  function resolveMe(list = []) {
    if (list.some((user) => user.id === meId.value)) return
    const me = dmApi.currentUser?.()
    if (!me) return
    const email = String(me.email ?? '').trim().toLowerCase()
    const name = String(me.fullName ?? me.full_name ?? me.name ?? '').trim().toLowerCase()
    const match =
      (email && list.find((user) => String(user.email ?? '').trim().toLowerCase() === email)) ||
      (name && list.find((user) => String(user.name ?? '').trim().toLowerCase() === name))
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

  // API conversation mein sirf ids de to naam company members se lo
  async function fillMissingNames(company) {
    try {
      const list = (await dmApi.listCompanyMembers?.(company)) ?? []
      mergeUsers(list)
      resolveMe(list)
      persistConversations()
    } catch {
      /* naam baad mein loadCompanyMembers se bhi aa jate hain */
    }
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
          const fresh = detail.messages.filter((m) => !have.has(m.id))
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
        const list = (await dmApi.listMessages(companyId.value, id))
          // jo abhi delete ho raha hai wo wapas na aaye
          .filter((m) => !pendingDeletes.has(m.id))
        const target = findConversation(id)
        if (target) {
          const previous = new Map(target.messages.map((m) => [m.id, m]))
          list.forEach((m) => {
            carryExtras(m, previous.get(m.id))
            // jo abhi edit ho raha hai uska naya text rakho
            if (pendingEdits.has(m.id)) m.text = pendingEdits.get(m.id)
          })
          const known = new Set(list.map((m) => m.id))
          // API wale messages + wo local/pending jo abhi server par nahi gaye
          // + wo jo is request ke dauran send hue (purani list mein nahi honge)
          const pending = target.messages.filter(
            (m) => !known.has(m.id) && (isLocal(m) || sentMeanwhile.has(m.id)),
          )
          target.messages = [...list, ...pending]
          for (const m of list) {
            if (m.from && !target.members.includes(m.from)) target.members.push(m.from)
          }
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

  async function loadCompanyMembers() {
    const company = companyId.value
    companyMembersLoading.value = true
    companyMembersError.value = ''

    try {
      // Company members ki request teams fetch hone ka intezar kiye bina shuru hoti hai
      const companyResult = (async () => dmApi.listCompanyMembers(company))().then(
        (value) => ({ value }),
        (cause) => ({ cause }),
      )

      let teams = teamsStore.teamsByWorkspaceId?.[company] ?? []
      if (!teams.length && company) {
        try {
          await teamsStore.fetchTeams(company)
          teams = teamsStore.teamsByWorkspaceId?.[company] ?? []
        } catch {
          teams = []
        }
      }

      const [memberResults, nonMemberResults] = await Promise.all([
        Promise.allSettled(teams.map((team) => dmApi.listTeamMembers(team.id))),
        Promise.allSettled(teams.map((team) => dmApi.listTeamNonMembers(company, team.id))),
      ])
      const fulfilled = (results) =>
        results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value ?? [])

      const result = await companyResult
      if (result.cause) companyMembersError.value = errorMessage(result.cause)

      const seen = new Map()
      for (const user of [
        ...(result.value ?? []),
        ...fulfilled(memberResults),
        ...fulfilled(nonMemberResults),
      ]) {
        if (user?.id && !seen.has(user.id)) seen.set(user.id, user)
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
  const users = computed(() => {
    const seen = new Map()
    for (const user of [...companyMembers.value, ...Object.values(usersById.value)]) {
      if (user?.id && !seen.has(user.id)) seen.set(user.id, usersById.value[user.id] ?? user)
    }
    return [...seen.values()]
  })

  const sorted = computed(() =>
    conversations.value
      .filter((c) => !closedIds.value.includes(c.id))
      .sort((a, b) => lastActivity(b) - lastActivity(a) || titleOf(a).localeCompare(titleOf(b))),
  )

  const activeConversation = computed(() => findConversation(activeId.value))

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

    closedIds.value = closedIds.value.filter((x) => x !== id)
    activeId.value = id
    conversation.unreadCount = 0
    detailError.value = ''
    messagesError.value = ''

    void loadMessages(id)
    return true
  }

  // Channel select hone par: DM ko inactive karo (list mein rehta hai, sirf chat band)
  function deactivateConversation() {
    activeId.value = null
    detailError.value = ''
    messagesError.value = ''
  }

  function closeConversation(id) {
    if (!closedIds.value.includes(id)) closedIds.value.push(id)
    if (activeId.value === id) activeId.value = null
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

    const { conversation, users: participants } = await dmApi.createDirectChannel(companyId.value, {
      user_id: userId,
    })
    mergeUsers(participants)
    return adoptConversation(conversation, [userId])
  }

  // 2+ users = group DM
  async function startGroup(userIds, name = '') {
    const others = [...new Set(userIds)].filter((id) => id && id !== meId.value)
    if (others.length < 2) throw new Error('Select at least two people to create a group.')

    const groupName = String(name ?? '').trim()
    const { conversation, users: participants } = await dmApi.createGroupChannel(companyId.value, {
      name: groupName,
      user_ids: others,
    })
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

  // ---------- messages ----------
  function findMessage(conversationId, messageId) {
    const conversation = findConversation(conversationId)
    const message = conversation?.messages.find((m) => m.id === messageId)
    return conversation && message ? { conversation, message } : null
  }

  // POST /v1/{company}/direct-channels/{channel}/messages
  async function deliver(conversationId, message) {
    if (!message || !isApiSendable(message)) return
    const conversation = findConversation(conversationId)
    if (!conversation) return

    message.status = 'sending'
    message.error = ''
    const localId = message.id
    try {
      // Backend ko message ka text "body" field mein chahiye
      const saved = await dmApi.sendMessage(companyId.value, conversationId, {
        body: message.text,
      })

      // Server batata hai ke ye message kisne bheja: wahi mera asli user id hai
      if (saved.from && saved.from !== meId.value) {
        meId.value = saved.from
        learnedMe = saved.from
        persistConversations()
      }

      sentDuringFetch.get(conversationId)?.add(saved.id)
      const index = conversation.messages.findIndex((m) => m.id === localId)
      if (index === -1) return // user ne beech mein delete kar diya
      if (conversation.messages.some((m) => m.id === saved.id)) {
        conversation.messages.splice(index, 1) // server list mein pehle se aa chuka
      } else {
        conversation.messages.splice(index, 1, {
          ...saved,
          from: saved.from || meId.value,
          text: saved.text || message.text,
          createdAt: saved.createdAt || message.createdAt,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          ...(message.forwardedFrom ? { forwardedFrom: message.forwardedFrom } : {}),
          ...(message.important ? { important: true } : {}),
        })
      }
      persist(conversation) // server wala message cache mein
    } catch (cause) {
      message.status = 'failed'
      message.error = errorMessage(cause)
      actionError.value = message.error
      persist(conversation)
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
        if (message.status === 'failed') void deliver(conversation.id, message)
      }
    }
  }

  function sendMessage(conversationId, payload = {}) {
    const conversation = findConversation(conversationId)
    const text = String(payload.content ?? '').trim()
    // File objects JSON mein save nahi hote, isliye sirf unki details
    const attachments = (payload.attachments ?? []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }))
    if (!conversation || (!text && !payload.gif && !payload.poll && !attachments.length)) {
      return null
    }

    const message = {
      id: `local-${Date.now().toString(36)}-${++localSeq}`,
      from: meId.value,
      text,
      createdAt: new Date().toISOString(),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
      ...(attachments.length ? { attachments } : {}),
      ...(payload.important ? { important: true } : {}),
      ...(payload.gif ? { gif: payload.gif } : {}),
      ...(payload.poll ? { poll: payload.poll } : {}),
      ...(payload.scheduledAt
        ? {
            scheduled: true,
            scheduledAt: payload.scheduledAt,
            timeZone: payload.timeZone || 'local time',
          }
        : {}),
    }
    if (isApiSendable(message)) {
      message.status = 'sending'
      message.error = ''
    }

    conversation.messages.push(message)
    persist(conversation)

    const added = conversation.messages.at(-1) // reactive version
    void deliver(conversationId, added)
    return added
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
    if (!found || found.message.from !== meId.value || !next) return false

    const previous = { text: found.message.text, editedAt: found.message.editedAt }
    found.message.text = next
    if ('content' in found.message) found.message.content = next
    found.message.editedAt = new Date().toISOString()
    persist(found.conversation)

    if (!isLocal(found.message)) void syncEdit(conversationId, messageId, next, previous)
    return true
  }

  async function syncEdit(conversationId, messageId, next, previous) {
    pendingEdits.set(messageId, next)
    try {
      // PATCH ka jawab message na de to GET single message se server wala version lo
      let saved = await dmApi.updateMessage(companyId.value, conversationId, messageId, {
        body: next,
      })
      if (!saved) saved = await fetchSingleMessage(conversationId, messageId)

      const found = findMessage(conversationId, messageId)
      if (saved && found) {
        found.message.text = saved.text || next
        if ('content' in found.message) found.message.content = found.message.text
        if (saved.editedAt) found.message.editedAt = saved.editedAt
        persist(found.conversation)
      }
    } catch (cause) {
      // fail hua to purana text wapas
      const found = findMessage(conversationId, messageId)
      if (found) {
        found.message.text = previous.text
        if ('content' in found.message) found.message.content = previous.text
        found.message.editedAt = previous.editedAt
        persist(found.conversation)
      }
      actionError.value = errorMessage(cause)
    } finally {
      pendingEdits.delete(messageId)
    }
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

  // DELETE /v1/{company}/direct-channels/{channel}/messages/{message}
  function deleteMessage(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found || found.message.from !== meId.value) return false

    const { conversation, message } = found
    const index = conversation.messages.indexOf(message)
    conversation.messages.splice(index, 1)
    persist(conversation)

    if (!isLocal(message)) void syncDelete(conversationId, message, index)
    return true
  }

  async function syncDelete(conversationId, message, index) {
    pendingDeletes.add(message.id)
    try {
      await dmApi.deleteMessage(companyId.value, conversationId, message.id)
    } catch (cause) {
      // fail hua to message wapas us jagah par
      const conversation = findConversation(conversationId)
      if (conversation) {
        conversation.messages.splice(index, 0, message)
        persist(conversation)
      }
      actionError.value = errorMessage(cause)
    } finally {
      pendingDeletes.delete(message.id)
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

  function toggleReaction(conversationId, messageId, emoji) {
    const found = findMessage(conversationId, messageId)
    if (!found || !emoji) return false

    const reactions = (found.message.reactions ?? []).map((r) => ({ ...r, users: [...r.users] }))
    const reaction = reactions.find((r) => r.emoji === emoji)
    if (!reaction) {
      reactions.push({ emoji, users: [meId.value] })
    } else if (reaction.users.includes(meId.value)) {
      reaction.users = reaction.users.filter((id) => id !== meId.value)
    } else {
      reaction.users.push(meId.value)
    }
    found.message.reactions = reactions.filter((r) => r.users.length)
    persist(found.conversation)
    return true
  }

  // ---------- polling: dusre user ke naye / edit / delete messages ----------
  // Backend par abhi realtime (socket) nahi hai, isliye active conversation ko
  // har POLL_INTERVAL ms baad GET .../messages se check karte hain
  async function pollOnce() {
    if (typeof document !== 'undefined' && document.hidden) return // tab chhupi hai
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    pollTicks += 1
    if (pollTicks % LIST_REFRESH_EVERY === 0) await init() // naye DM / unread
    if (activeId.value) await fetchMessages(activeId.value, { silent: true })
  }

  function startPolling(interval = POLL_INTERVAL) {
    if (pollTimer) return
    pollTimer = setInterval(() => void pollOnce(), interval)
  }

  function stopPolling() {
    clearInterval(pollTimer)
    pollTimer = null
  }

  // ---------- network wapas aaye ----------
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
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
    sorted,
    init,
    loadCompanyMembers,
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
    sendMessage,
    retryMessage,
    cancelScheduledMessage,
    editMessage,
    deleteMessage,
    listPinnedMessages,
    pinMessage,
    unpinMessage,
    toggleReaction,
    refreshMessage,
    pollOnce,
    startPolling,
    stopPolling,
    clearCache,
  }
})