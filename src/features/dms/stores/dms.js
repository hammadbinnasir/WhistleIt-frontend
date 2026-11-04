// import { defineStore } from 'pinia'
// import { computed, ref } from 'vue'
// import { dmApi } from '@/features/dms/dmApi'
// import { useMembersStore } from '@/stores/members'
// import { useTeamsStore } from '@/stores/teams'
// import { useActivityStore } from '@/stores/activity'

// let generatedId = 0
// const LOCAL_MESSAGES_STORAGE_KEY = 'whistleit:dm-messages'

// function createId() {
//   return `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${generatedId++}`}`
// }

// function readLocalMessages() {
//   try {
//     const saved = JSON.parse(localStorage.getItem(LOCAL_MESSAGES_STORAGE_KEY) || '{}')
//     return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
//   } catch (error) {
//     console.error('Unable to load direct messages from browser storage:', error)
//     return {}
//   }
// }

// function writeLocalMessages(messages) {
//   try {
//     localStorage.setItem(LOCAL_MESSAGES_STORAGE_KEY, JSON.stringify(messages))
//   } catch (error) {
//     console.error('Unable to save direct messages to browser storage:', error)
//   }
// }

// function errorMessage(error) {
//   if (error instanceof Error) return error.message
//   if (typeof error?.message === 'string' && error.message.trim()) return error.message
//   if (typeof error?.details?.message === 'string' && error.details.message.trim()) {
//     return error.details.message
//   }
//   if (typeof error === 'string' && error.trim()) return error
//   return 'An unexpected error occurred.'
// }

// export const useDmStore = defineStore('dms', () => {
//   const meId = ref(null)
//   const users = ref([])
//   const companyMembers = ref([])
//   const conversations = ref([])
//   const activeId = ref(null)
//   const loading = ref(false)
//   const error = ref('')
//   const detailError = ref('')
//   const detailLoading = ref(false)
//   const companyMembersLoading = ref(false)
//   const companyMembersError = ref('')
//   const usersById = computed(() => Object.fromEntries(users.value.map((user) => [user.id, user])))
//   const sorted = computed(() =>
//     conversations.value.slice().sort((a, b) => {
//       const aTime = a.messages.at(-1)?.createdAt ?? ''
//       const bTime = b.messages.at(-1)?.createdAt ?? ''
//       return bTime.localeCompare(aTime)
//     }),
//   )

//   let initialization = null
//   let initializedCompanyId = null
//   let requestVersion = 0
//   let companyMembersLoadedFor = null
//   let companyMembersRequest = null
//   let companyMembersRequestVersion = 0
//   const detailRequests = new Map()
//   const detailLoadedIds = new Set()

//   function localMessagesFor(companyId, conversationId) {
//     const stored = readLocalMessages()
//     const messages = stored?.[String(companyId)]?.[String(conversationId)]
//     return Array.isArray(messages) ? messages : []
//   }

//   function saveLocalMessage(companyId, conversationId, message) {
//     if (!companyId || !conversationId || !message?.id) return
//     const stored = readLocalMessages()
//     const companyMessages = stored[String(companyId)] ?? {}
//     const messages = companyMessages[String(conversationId)] ?? []
//     const index = messages.findIndex((item) => String(item.id) === String(message.id))
//     if (index === -1) messages.push(message)
//     else messages[index] = message
//     writeLocalMessages({
//       ...stored,
//       [String(companyId)]: {
//         ...companyMessages,
//         [String(conversationId)]: messages,
//       },
//     })
//   }

//   function removeLocalMessage(companyId, conversationId, messageId) {
//     if (!companyId || !conversationId) return
//     const stored = readLocalMessages()
//     const companyMessages = stored[String(companyId)]
//     const messages = companyMessages?.[String(conversationId)]
//     if (!Array.isArray(messages)) return

//     const remaining = messages.filter((message) => String(message.id) !== String(messageId))
//     const conversations = { ...companyMessages }
//     if (remaining.length) conversations[String(conversationId)] = remaining
//     else delete conversations[String(conversationId)]
//     const next = { ...stored }
//     if (Object.keys(conversations).length) next[String(companyId)] = conversations
//     else delete next[String(companyId)]
//     writeLocalMessages(next)
//   }

//   function mergeLocalMessages(companyId, conversation) {
//     const messages = new Map(
//       (conversation.messages ?? []).map((message) => [String(message.id), message]),
//     )
//     for (const message of localMessagesFor(companyId, conversation.id)) {
//       messages.set(String(message.id), message)
//     }
//     conversation.messages = [...messages.values()].sort((a, b) =>
//       String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')),
//     )
//     return conversation
//   }

//   async function resolveCompanyId(companyId) {
//     if (companyId != null && String(companyId).trim()) return String(companyId)
//     const teams = useTeamsStore()
//     if (!teams.activeWorkspaceId) await teams.fetchTeams()
//     if (teams.activeWorkspaceId == null) {
//       throw new Error('Select a company before loading direct messages.')
//     }
//     return String(teams.activeWorkspaceId)
//   }

//   async function init(companyId = null, { force = false } = {}) {
//     let id
//     try {
//       id = await resolveCompanyId(companyId)
//     } catch (cause) {
//       error.value = errorMessage(cause)
//       return
//     }
//     if (initialization?.companyId === id) return initialization.promise
//     if (initializedCompanyId === id && !force) return

//     const version = ++requestVersion
//     loading.value = true
//     error.value = ''
//     detailRequests.clear()
//     detailLoadedIds.clear()
//     if (initializedCompanyId !== id) {
//       conversations.value = []
//       users.value = []
//       companyMembers.value = []
//       detailLoadedIds.clear()
//       activeId.value = null
//       companyMembersLoadedFor = null
//       companyMembersRequest = null
//       companyMembersRequestVersion += 1
//       companyMembersLoading.value = false
//       companyMembersError.value = ''
//     }
//     const promise = dmApi
//       .listDirectChannels(id)
//       .then((loadedChannels) => {
//         if (version !== requestVersion) return
//         conversations.value = loadedChannels.map(({ conversation }) =>
//           mergeLocalMessages(id, conversation),
//         )
//         for (const conversation of conversations.value) {
//           if (conversation.messages.length) detailLoadedIds.add(String(conversation.id))
//         }
//         const channelUsers = loadedChannels.flatMap(({ users: usersForChannel }) => usersForChannel)
//         const teamUsers = useMembersStore().members.map((member) => ({
//           id: String(member.userId ?? member.id),
//           name: member.name,
//           avatarUrl: member.avatarUrl ?? member.avatar ?? '',
//         }))
//         users.value = [...channelUsers, ...teamUsers].reduce((unique, user) => {
//           if (!unique.some((item) => item.id === user.id)) unique.push(user)
//           return unique
//         }, [])
//         meId.value = dmApi.meId()
//         initializedCompanyId = id
//       })
//       .catch((cause) => {
//         if (version === requestVersion) error.value = errorMessage(cause)
//       })
//       .finally(() => {
//         if (version === requestVersion) {
//           loading.value = false
//           initialization = null
//         }
//       })

//     initialization = { companyId: id, promise }
//     return promise
//   }

//   async function loadCompanyMembers(companyId = null, { force = false } = {}) {
//     let id
//     try {
//       id = await resolveCompanyId(companyId)
//     } catch (cause) {
//       companyMembersError.value = errorMessage(cause)
//       return
//     }

//     if (companyMembersLoadedFor === id && !force) return
//     if (companyMembersRequest?.companyId === id) return companyMembersRequest.promise

//     const version = ++companyMembersRequestVersion
//     companyMembersLoading.value = true
//     companyMembersError.value = ''
//     const teams = useTeamsStore()
//     const promise = (async () => {
//       const companyMembersRequest = dmApi.listCompanyMembers(id)
//       const teamsRequest = teams.teams.length ? Promise.resolve(teams.teams) : teams.fetchTeams(id)
//       const [companyMembersResult, teamsResult] = await Promise.allSettled([
//         companyMembersRequest,
//         teamsRequest,
//       ])
//       const teamList = teamsResult.status === 'fulfilled' ? teamsResult.value : []
//       const teamIds = new Set(teamList.map((team) => String(team.id)))
//       if (teams.activeTeamId != null) teamIds.add(String(teams.activeTeamId))
//       const teamMemberResults = await Promise.allSettled(
//         [...teamIds].map((teamId) => dmApi.listTeamMembers(teamId)),
//       )
//       const teamNonMemberResults = await Promise.allSettled(
//         [...teamIds].map((teamId) => dmApi.listTeamNonMembers(id, teamId)),
//       )
//       const results = [
//         companyMembersResult,
//         ...(teamsResult.status === 'rejected' ? [teamsResult] : []),
//         ...teamMemberResults,
//         ...teamNonMemberResults,
//       ]
//       const activeCompanyId = teams.activeWorkspaceId
//       if (
//         version !== companyMembersRequestVersion ||
//         (activeCompanyId != null && String(activeCompanyId) !== id)
//       ) {
//         return
//       }

//       const loadedUsers = results
//         .filter((result) => result.status === 'fulfilled')
//         .flatMap((result) => result.value)
//       const failedRequests = results.filter((result) => result.status === 'rejected')
//       const byId = new Map(users.value.map((user) => [String(user.id), user]))
//       for (const user of loadedUsers) {
//         const userId = String(user.id)
//         byId.set(userId, { ...byId.get(userId), ...user, id: userId })
//       }
//       users.value = [...byId.values()]
//       companyMembers.value = loadedUsers.reduce((unique, user) => {
//         const userId = String(user.id)
//         const existingIndex = unique.findIndex((item) => String(item.id) === userId)
//         if (existingIndex === -1) unique.push(user)
//         else unique[existingIndex] = { ...unique[existingIndex], ...user }
//         return unique
//       }, [])
//       if (failedRequests.length) {
//         companyMembersError.value =
//           `${failedRequests.length} member list request(s) failed. ` +
//           'Some members may not appear in search.'
//       }
//       companyMembersLoadedFor = id
//     })().finally(() => {
//       if (version === companyMembersRequestVersion) {
//         companyMembersLoading.value = false
//         companyMembersRequest = null
//       }
//     })
//     companyMembersRequest = { companyId: id, promise }
//     return promise
//   }

//   function partnerId(conversation) {
//     return conversation.members?.find((id) => id !== meId.value) ?? null
//   }

//   function rememberUser(user) {
//     if (user?.id == null || !String(user.id).trim()) return null
//     const id = String(user.id)
//     const index = users.value.findIndex((item) => String(item.id) === id)
//     const existing = index === -1 ? {} : users.value[index]
//     const name = String(user.name ?? '').trim()
//     const existingName = String(existing.name ?? '').trim()
//     const normalized = {
//       ...existing,
//       ...user,
//       id,
//       name: !name || name === 'Member' ? existingName || 'Member' : name,
//       avatarUrl: user.avatarUrl || existing.avatarUrl || '',
//     }
//     if (index === -1) users.value.push(normalized)
//     else users.value[index] = normalized
//     return normalized
//   }

//   function titleOf(conversation) {
//     if (conversation.name) return conversation.name
//     if (conversation.type === 'dm') {
//       return usersById.value[partnerId(conversation)]?.name || 'Direct message'
//     }
//     return (conversation.members ?? [])
//       .filter((id) => id !== meId.value)
//       .map((id) => usersById.value[id]?.name)
//       .filter(Boolean)
//       .join(', ')
//   }

//   async function loadConversationDetail(id) {
//     const conversationId = String(id)
//     if (detailRequests.has(conversationId)) return detailRequests.get(conversationId)
//     const companyId = initializedCompanyId
//     if (!companyId) return

//     detailLoading.value = true
//     detailError.value = ''
//     const request = dmApi
//       .getDirectChannel(companyId, conversationId)
//       .then(({ conversation, users: loadedUsers }) => {
//         if (initializedCompanyId !== companyId) return
//         const index = conversations.value.findIndex((item) => String(item.id) === conversationId)
//         if (index === -1) conversations.value.push(conversation)
//         else {
//           const current = conversations.value[index]
//           const knownMessages = new Set(conversation.messages.map((message) => message.id))
//           const messages = [
//             ...conversation.messages,
//             ...current.messages.filter((message) => !knownMessages.has(message.id)),
//           ]
//           const members = [
//             ...new Set([...(current.members ?? []), ...(conversation.members ?? [])]),
//           ]
//           Object.assign(current, conversation, { messages, members })
//         }
//         mergeLocalMessages(companyId, conversations.value.find((item) => item.id === conversationId))
//         detailLoadedIds.add(conversationId)
//         for (const user of loadedUsers) {
//           rememberUser(user)
//         }
//       })
//       .catch((cause) => {
//         detailError.value = errorMessage(cause)
//       })
//       .finally(() => {
//         detailLoading.value = false
//         detailRequests.delete(conversationId)
//       })
//     detailRequests.set(conversationId, request)
//     return request
//   }

//   function openConversation(id) {
//     const conversation = conversations.value.find((item) => item.id === id)
//     if (!conversation) return false
//     conversation.unreadCount = 0
//     activeId.value = id
//     if (conversation.messages.length || detailLoadedIds.has(String(id))) {
//       detailLoadedIds.add(String(id))
//       detailError.value = ''
//     } else {
//       void loadConversationDetail(id)
//     }
//     return true
//   }

//   function deactivateConversation() {
//     activeId.value = null
//   }

//   function closeConversation(id) {
//     conversations.value = conversations.value.filter((conversation) => conversation.id !== id)
//     if (activeId.value === id) activeId.value = null
//   }

//   function isFavorite(id) {
//     return conversations.value.find((conversation) => conversation.id === id)?.isFavorite ?? false
//   }

//   function toggleFavorite(id) {
//     const conversation = conversations.value.find((item) => item.id === id)
//     if (!conversation || conversation.type !== 'dm') return false
//     conversation.isFavorite = !conversation.isFavorite
//     return conversation.isFavorite
//   }

//   function startDm(userId) {
//     if (userId == null || !String(userId).trim()) {
//       throw new Error('Select a user before starting a direct message.')
//     }
//     const existing = conversations.value.find(
//       (conversation) => String(partnerId(conversation)) === String(userId),
//     )
//     if (existing) {
//       openConversation(existing.id)
//       return existing
//     }
//     return createDmForUser(String(userId))
//   }

//   async function createDmForUser(userId) {
//     await init()
//     if (error.value) throw new Error(error.value)
//     const existing = conversations.value.find(
//       (conversation) => String(partnerId(conversation)) === String(userId),
//     )
//     if (existing) {
//       openConversation(existing.id)
//       return existing
//     }
//     if (!initializedCompanyId) {
//       throw new Error('Select a company before starting a direct message.')
//     }
//     error.value = ''
//     detailError.value = ''
//     try {
//       const { conversation, users: loadedUsers } = await dmApi.createDirectChannel(
//         initializedCompanyId,
//         { user_id: String(userId) },
//       )
//       conversation.members = [
//         ...new Set([...(conversation.members ?? []), meId.value, String(userId)].filter(Boolean)),
//       ]
//       const index = conversations.value.findIndex((item) => item.id === conversation.id)
//       if (index === -1) conversations.value.push(conversation)
//       else conversations.value[index] = conversation
//       detailLoadedIds.add(String(conversation.id))
//       for (const user of loadedUsers) {
//         rememberUser(user)
//       }
//       const teamUser = useMembersStore().members.find(
//         (member) => String(member.userId ?? member.id) === String(userId),
//       )
//       if (teamUser && !users.value.some((user) => user.id === String(userId))) {
//         users.value.push({
//           id: String(teamUser.userId ?? teamUser.id),
//           name: teamUser.name,
//           avatarUrl: teamUser.avatarUrl ?? teamUser.avatar ?? '',
//         })
//       }
//       activeId.value = conversation.id
//       return conversation
//     } catch (cause) {
//       error.value = errorMessage(cause)
//       throw cause
//     }
//   }

//   function startGroup() {
//     throw new Error('Group direct messages are not supported by the available API.')
//   }

//   function sendMessage(conversationId, payload) {
//     const conversation = conversations.value.find((item) => item.id === conversationId)
//     if (!conversation) return false

//     const message = {
//       id: createId(),
//       from: meId.value,
//       text: payload.content,
//       createdAt: new Date().toISOString(),
//       ...(payload.threadId ? { threadId: payload.threadId } : {}),
//       ...(payload.attachments?.length ? { attachments: [...payload.attachments] } : {}),
//       ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
//       ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
//       ...(payload.important ? { important: true } : {}),
//       ...(payload.gif ? { gif: payload.gif } : {}),
//       ...(payload.scheduledAt
//         ? {
//             scheduled: true,
//             scheduledAt: payload.scheduledAt,
//             timeZone: payload.timeZone || 'local time',
//           }
//         : {}),
//     }
//     conversation.messages.push(message)
//     if (!message.scheduled && initializedCompanyId) {
//       saveLocalMessage(initializedCompanyId, conversation.id, message)
//     }
//     if (!message.scheduled) {
//       useActivityStore().recordMessageMentions({
//         text: message.text,
//         conversationId: conversation.id,
//         conversationName: titleOf(conversation),
//         conversationType: 'dm',
//       })
//     }
//     conversation.unreadCount = 0
//     activeId.value = conversationId
//     return message
//   }

//   function editMessage(conversationId, messageId, text) {
//     const conversation = conversations.value.find((item) => item.id === conversationId)
//     const message = conversation?.messages.find((item) => item.id === messageId)
//     if (
//       !message ||
//       message.from !== meId.value ||
//       message.scheduled ||
//       message.deleted ||
//       message.deleteScheduledAt ||
//       !text.trim()
//     ) {
//       return false
//     }
//     message.text = text.trim()
//     message.editedAt = new Date().toISOString()
//     if (initializedCompanyId && message.id.startsWith('local-')) {
//       saveLocalMessage(initializedCompanyId, conversation.id, message)
//     }
//     return true
//   }

//   function deleteMessage(conversationId, messageId) {
//     const conversation = conversations.value.find((item) => item.id === conversationId)
//     const message = conversation?.messages.find((item) => item.id === messageId)
//     if (!conversation || !message || message.from !== meId.value || message.scheduled) return false
//     conversation.messages = conversation.messages.filter((item) => item.id !== messageId)
//     if (initializedCompanyId && String(messageId).startsWith('local-')) {
//       removeLocalMessage(initializedCompanyId, conversation.id, messageId)
//     }
//     return true
//   }

//   function toggleReaction(conversationId, messageId, emoji) {
//     const conversation = conversations.value.find((item) => item.id === conversationId)
//     const message = conversation?.messages.find((item) => item.id === messageId)
//     if (!message || message.deleted || !emoji) return false
//     if (!message.reactions) message.reactions = []

//     const userId = meId.value || 'current-user'
//     const reaction = message.reactions.find((item) => item.emoji === emoji)
//     if (!reaction) {
//       message.reactions.push({ emoji, users: [userId] })
//     } else if (reaction.users.includes(userId)) {
//       reaction.users = reaction.users.filter((id) => id !== userId)
//       if (!reaction.users.length) {
//         message.reactions = message.reactions.filter((item) => item !== reaction)
//       }
//     } else {
//       reaction.users.push(userId)
//     }
//     if (initializedCompanyId && message.id.startsWith('local-')) {
//       saveLocalMessage(initializedCompanyId, conversation.id, message)
//     }
//     return true
//   }

//   function cancelScheduledMessage(conversationId, messageId) {
//     const conversation = conversations.value.find((item) => item.id === conversationId)
//     if (!conversation) return false
//     const message = conversation.messages.find((item) => item.id === messageId)
//     if (!message?.scheduled) return false
//     conversation.messages = conversation.messages.filter((item) => item.id !== messageId)
//     if (initializedCompanyId && String(messageId).startsWith('local-')) {
//       removeLocalMessage(initializedCompanyId, conversation.id, messageId)
//     }
//     return true
//   }

//   return {
//     meId,
//     users,
//     companyMembers,
//     usersById,
//     conversations,
//     sorted,
//     activeId,
//     loading,
//     error,
//     detailError,
//     detailLoading,
//     companyMembersLoading,
//     companyMembersError,
//     init,
//     loadCompanyMembers,
//     partnerId,
//     rememberUser,
//     titleOf,
//     openConversation,
//     deactivateConversation,
//     closeConversation,
//     isFavorite,
//     toggleFavorite,
//     startDm,
//     startGroup,
//     sendMessage,
//     editMessage,
//     deleteMessage,
//     toggleReaction,
//     cancelScheduledMessage,
//   }
// })


import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'
import { useTeamsStore } from '@/stores/teams'

const STORAGE_KEY = 'whistleit:dm-messages'

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error?.message ?? error)
}

const isLocal = (message) => String(message.id).startsWith('local-')

// ---- locally bheje gaye messages (abhi send-message ka API endpoint nahi hai) ----
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
function saveLocal(companyId, conversationId, messages) {
  try {
    const all = readLocal()
    all[companyId] = all[companyId] ?? {}
    all[companyId][conversationId] = messages
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* storage full / blocked: memory mein to rehta hai */
  }
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
  const detailLoading = ref(false)
  const detailError = ref('')

  const companyMembers = ref([])
  const companyMembersLoading = ref(false)
  const companyMembersError = ref('')

  const detailLoaded = new Set()
  const detailRequests = new Map()
  let initialization = null
  let localSeq = 0

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

  function addLocalMessages(company, conversation) {
    const have = new Set(conversation.messages.map((m) => m.id))
    const saved = (readLocal()[company]?.[conversation.id] ?? []).filter((m) => !have.has(m.id))
    conversation.messages.push(...saved)
  }

  function persist(conversation) {
    saveLocal(companyId.value, conversation.id, conversation.messages.filter(isLocal))
  }

  // ---------- load ----------
  function init() {
    if (initialization) return initialization

    meId.value = dmApi.meId()
    loading.value = true
    error.value = ''

    initialization = (async () => {
      try {
        const company = companyId.value
        const entries = await dmApi.listDirectChannels(company)
        const previous = new Map(conversations.value.map((c) => [c.id, c]))

        conversations.value = entries.map(({ conversation, users }) => {
          mergeUsers(users)
          addLocalMessages(company, conversation)
          if (previous.get(conversation.id)?.isFavorite) conversation.isFavorite = true
          return conversation
        })
        resolveMe(Object.values(usersById.value))
        if (needsNames()) void fillMissingNames(company)
      } catch (cause) {
        error.value = errorMessage(cause)
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

  // Component se: conversation ke messages API se load karo (agar pehle se nahi hain)
  async function loadMessages(id, { force = false } = {}) {
    const conversation = findConversation(id)
    if (!conversation) return false
    const hasApiMessages = conversation.messages.some((m) => !isLocal(m))
    if (!force && (hasApiMessages || detailLoaded.has(id))) return true
    await loadDetail(id)
    return !detailError.value
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

    void loadMessages(id)
    return true
  }

  function deactivateConversation() {
    activeId.value = null
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
    return conversation.isFavorite
  }

  // ---------- messages ----------
  function findMessage(conversationId, messageId) {
    const conversation = findConversation(conversationId)
    const message = conversation?.messages.find((m) => m.id === messageId)
    return conversation && message ? { conversation, message } : null
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

    conversation.messages.push({
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
    })
    persist(conversation)
    return conversation.messages.at(-1)
  }

  function cancelScheduledMessage(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found?.message.scheduledAt) return false
    found.conversation.messages.splice(found.conversation.messages.indexOf(found.message), 1)
    persist(found.conversation)
    return true
  }

  function editMessage(conversationId, messageId, text) {
    const found = findMessage(conversationId, messageId)
    const next = String(text ?? '').trim()
    if (!found || found.message.from !== meId.value || !next) return false
    found.message.text = next
    if ('content' in found.message) found.message.content = next
    found.message.editedAt = new Date().toISOString()
    persist(found.conversation)
    return true
  }

  function deleteMessage(conversationId, messageId) {
    const found = findMessage(conversationId, messageId)
    if (!found || found.message.from !== meId.value) return false
    found.conversation.messages.splice(found.conversation.messages.indexOf(found.message), 1)
    persist(found.conversation)
    return true
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

  return {
    meId,
    conversations,
    usersById,
    users,
    activeId,
    activeConversation,
    loading,
    error,
    detailLoading,
    detailError,
    companyMembers,
    companyMembersLoading,
    companyMembersError,
    sorted,
    init,
    loadCompanyMembers,
    openConversation,
    deactivateConversation,
    loadMessages,
    closeConversation,
    startDm,
    startGroup,
    titleOf,
    partnerId,
    isFavorite,
    toggleFavorite,
    sendMessage,
    cancelScheduledMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
  }
})
