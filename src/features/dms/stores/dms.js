import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'
import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useActivityStore } from '@/stores/activity'

let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${generatedId++}`
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  if (typeof error?.details?.message === 'string' && error.details.message.trim()) {
    return error.details.message
  }
  if (typeof error === 'string' && error.trim()) return error
  return 'An unexpected error occurred.'
}

export const useDmStore = defineStore('dms', () => {
  const meId = ref(null)
  const users = ref([])
  const companyMembers = ref([])
  const conversations = ref([])
  const activeId = ref(null)
  const loading = ref(false)
  const error = ref('')
  const detailError = ref('')
  const detailLoading = ref(false)
  const companyMembersLoading = ref(false)
  const companyMembersError = ref('')
  const usersById = computed(() => Object.fromEntries(users.value.map((user) => [user.id, user])))
  const sorted = computed(() =>
    conversations.value.slice().sort((a, b) => {
      const aTime = a.messages.at(-1)?.createdAt ?? ''
      const bTime = b.messages.at(-1)?.createdAt ?? ''
      return bTime.localeCompare(aTime)
    }),
  )

  let initialization = null
  let initializedCompanyId = null
  let requestVersion = 0
  let companyMembersLoadedFor = null
  let companyMembersRequest = null
  let companyMembersRequestVersion = 0
  const detailRequests = new Map()

  async function resolveCompanyId(companyId) {
    if (companyId != null && String(companyId).trim()) return String(companyId)
    const teams = useTeamsStore()
    if (!teams.activeWorkspaceId) await teams.fetchTeams()
    if (teams.activeWorkspaceId == null) {
      throw new Error('Select a company before loading direct messages.')
    }
    return String(teams.activeWorkspaceId)
  }

  async function init(companyId = null, { force = false } = {}) {
    let id
    try {
      id = await resolveCompanyId(companyId)
    } catch (cause) {
      error.value = errorMessage(cause)
      return
    }
    if (initialization?.companyId === id) return initialization.promise
    if (initializedCompanyId === id && !force) return

    const version = ++requestVersion
    loading.value = true
    error.value = ''
    detailRequests.clear()
    if (initializedCompanyId !== id) {
      conversations.value = []
      users.value = []
      companyMembers.value = []
      activeId.value = null
      companyMembersLoadedFor = null
      companyMembersRequest = null
      companyMembersRequestVersion += 1
      companyMembersLoading.value = false
      companyMembersError.value = ''
    }
    const promise = dmApi
      .listDirectChannels(id)
      .then((loadedChannels) => {
        if (version !== requestVersion) return
        conversations.value = loadedChannels.map(({ conversation }) => conversation)
        const channelUsers = loadedChannels.flatMap(({ users: usersForChannel }) => usersForChannel)
        const teamUsers = useMembersStore().members.map((member) => ({
          id: String(member.userId ?? member.id),
          name: member.name,
          avatarUrl: member.avatarUrl ?? member.avatar ?? '',
        }))
        users.value = [...channelUsers, ...teamUsers].reduce((unique, user) => {
          if (!unique.some((item) => item.id === user.id)) unique.push(user)
          return unique
        }, [])
        meId.value = dmApi.meId()
        initializedCompanyId = id
      })
      .catch((cause) => {
        if (version === requestVersion) error.value = errorMessage(cause)
      })
      .finally(() => {
        if (version === requestVersion) {
          loading.value = false
          initialization = null
        }
      })

    initialization = { companyId: id, promise }
    return promise
  }

  async function loadCompanyMembers(companyId = null, { force = false } = {}) {
    let id
    try {
      id = await resolveCompanyId(companyId)
    } catch (cause) {
      companyMembersError.value = errorMessage(cause)
      return
    }

    if (companyMembersLoadedFor === id && !force) return
    if (companyMembersRequest?.companyId === id) return companyMembersRequest.promise

    const version = ++companyMembersRequestVersion
    companyMembersLoading.value = true
    companyMembersError.value = ''
    const teams = useTeamsStore()
    const promise = (async () => {
      const companyMembersRequest = dmApi.listCompanyMembers(id)
      const teamsRequest = teams.teams.length ? Promise.resolve(teams.teams) : teams.fetchTeams(id)
      const [companyMembersResult, teamsResult] = await Promise.allSettled([
        companyMembersRequest,
        teamsRequest,
      ])
      const teamList = teamsResult.status === 'fulfilled' ? teamsResult.value : []
      const teamIds = new Set(teamList.map((team) => String(team.id)))
      if (teams.activeTeamId != null) teamIds.add(String(teams.activeTeamId))
      const teamMemberResults = await Promise.allSettled(
        [...teamIds].map((teamId) => dmApi.listTeamMembers(teamId)),
      )
      const teamNonMemberResults = await Promise.allSettled(
        [...teamIds].map((teamId) => dmApi.listTeamNonMembers(id, teamId)),
      )
      const results = [
        companyMembersResult,
        ...(teamsResult.status === 'rejected' ? [teamsResult] : []),
        ...teamMemberResults,
        ...teamNonMemberResults,
      ]
      const activeCompanyId = teams.activeWorkspaceId
      if (
        version !== companyMembersRequestVersion ||
        (activeCompanyId != null && String(activeCompanyId) !== id)
      ) {
        return
      }

      const loadedUsers = results
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value)
      const failedRequests = results.filter((result) => result.status === 'rejected')
      const byId = new Map(users.value.map((user) => [String(user.id), user]))
      for (const user of loadedUsers) {
        const userId = String(user.id)
        byId.set(userId, { ...byId.get(userId), ...user, id: userId })
      }
      users.value = [...byId.values()]
      companyMembers.value = loadedUsers.reduce((unique, user) => {
        const userId = String(user.id)
        const existingIndex = unique.findIndex((item) => String(item.id) === userId)
        if (existingIndex === -1) unique.push(user)
        else unique[existingIndex] = { ...unique[existingIndex], ...user }
        return unique
      }, [])
      if (failedRequests.length) {
        companyMembersError.value =
          `${failedRequests.length} member list request(s) failed. ` +
          'Some members may not appear in search.'
      }
      companyMembersLoadedFor = id
    })().finally(() => {
      if (version === companyMembersRequestVersion) {
        companyMembersLoading.value = false
        companyMembersRequest = null
      }
    })
    companyMembersRequest = { companyId: id, promise }
    return promise
  }

  function partnerId(conversation) {
    return conversation.members?.find((id) => id !== meId.value) ?? null
  }

  function titleOf(conversation) {
    if (conversation.name) return conversation.name
    if (conversation.type === 'dm') {
      return usersById.value[partnerId(conversation)]?.name || 'Direct message'
    }
    return (conversation.members ?? [])
      .filter((id) => id !== meId.value)
      .map((id) => usersById.value[id]?.name)
      .filter(Boolean)
      .join(', ')
  }

  async function loadConversationDetail(id) {
    const conversationId = String(id)
    if (detailRequests.has(conversationId)) return detailRequests.get(conversationId)
    const companyId = initializedCompanyId
    if (!companyId) return

    detailLoading.value = true
    detailError.value = ''
    const request = dmApi
      .getDirectChannel(companyId, conversationId)
      .then(({ conversation, users: loadedUsers }) => {
        if (initializedCompanyId !== companyId) return
        const index = conversations.value.findIndex((item) => String(item.id) === conversationId)
        if (index === -1) conversations.value.push(conversation)
        else {
          const current = conversations.value[index]
          const knownMessages = new Set(conversation.messages.map((message) => message.id))
          const messages = [
            ...conversation.messages,
            ...current.messages.filter((message) => !knownMessages.has(message.id)),
          ]
          const members = [
            ...new Set([...(current.members ?? []), ...(conversation.members ?? [])]),
          ]
          Object.assign(current, conversation, { messages, members })
        }
        for (const user of loadedUsers) {
          const userIndex = users.value.findIndex((item) => item.id === user.id)
          if (userIndex === -1) users.value.push(user)
          else users.value[userIndex] = { ...users.value[userIndex], ...user }
        }
      })
      .catch((cause) => {
        detailError.value = errorMessage(cause)
      })
      .finally(() => {
        detailLoading.value = false
        detailRequests.delete(conversationId)
      })
    detailRequests.set(conversationId, request)
    return request
  }

  function openConversation(id) {
    const conversation = conversations.value.find((item) => item.id === id)
    if (!conversation) return false
    conversation.unreadCount = 0
    activeId.value = id
    void loadConversationDetail(id)
    return true
  }

  function deactivateConversation() {
    activeId.value = null
  }

  function closeConversation(id) {
    conversations.value = conversations.value.filter((conversation) => conversation.id !== id)
    if (activeId.value === id) activeId.value = null
  }

  function isFavorite(id) {
    return conversations.value.find((conversation) => conversation.id === id)?.isFavorite ?? false
  }

  function toggleFavorite(id) {
    const conversation = conversations.value.find((item) => item.id === id)
    if (!conversation || conversation.type !== 'dm') return false
    conversation.isFavorite = !conversation.isFavorite
    return conversation.isFavorite
  }

  function startDm(userId) {
    if (userId == null || !String(userId).trim()) {
      throw new Error('Select a user before starting a direct message.')
    }
    const existing = conversations.value.find(
      (conversation) => String(partnerId(conversation)) === String(userId),
    )
    if (existing) {
      openConversation(existing.id)
      return existing
    }
    return createDmForUser(String(userId))
  }

  async function createDmForUser(userId) {
    await init()
    if (error.value) throw new Error(error.value)
    const existing = conversations.value.find(
      (conversation) => String(partnerId(conversation)) === String(userId),
    )
    if (existing) {
      openConversation(existing.id)
      return existing
    }
    if (!initializedCompanyId) {
      throw new Error('Select a company before starting a direct message.')
    }
    error.value = ''
    detailError.value = ''
    try {
      const { conversation, users: loadedUsers } = await dmApi.createDirectChannel(
        initializedCompanyId,
        { user_id: String(userId) },
      )
      conversation.members = [
        ...new Set([...(conversation.members ?? []), meId.value, String(userId)].filter(Boolean)),
      ]
      const index = conversations.value.findIndex((item) => item.id === conversation.id)
      if (index === -1) conversations.value.push(conversation)
      else conversations.value[index] = conversation
      for (const user of loadedUsers) {
        if (!users.value.some((item) => item.id === user.id)) users.value.push(user)
      }
      const teamUser = useMembersStore().members.find(
        (member) => String(member.userId ?? member.id) === String(userId),
      )
      if (teamUser && !users.value.some((user) => user.id === String(userId))) {
        users.value.push({
          id: String(teamUser.userId ?? teamUser.id),
          name: teamUser.name,
          avatarUrl: teamUser.avatarUrl ?? teamUser.avatar ?? '',
        })
      }
      activeId.value = conversation.id
      await loadConversationDetail(conversation.id)
      return conversation
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    }
  }

  function startGroup() {
    throw new Error('Group direct messages are not supported by the available API.')
  }

  function sendMessage(conversationId, payload) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    if (!conversation) return false

    const message = {
      id: createId(),
      from: meId.value,
      text: payload.content,
      createdAt: new Date().toISOString(),
      ...(payload.threadId ? { threadId: payload.threadId } : {}),
      ...(payload.attachments?.length ? { attachments: [...payload.attachments] } : {}),
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
      ...(payload.important ? { important: true } : {}),
      ...(payload.gif ? { gif: payload.gif } : {}),
      ...(payload.scheduledAt
        ? {
            scheduled: true,
            scheduledAt: payload.scheduledAt,
            timeZone: payload.timeZone || 'local time',
          }
        : {}),
    }
    conversation.messages.push(message)
    if (!message.scheduled) {
      useActivityStore().recordMessageMentions({
        text: message.text,
        conversationId: conversation.id,
        conversationName: titleOf(conversation),
        conversationType: 'dm',
      })
    }
    conversation.unreadCount = 0
    activeId.value = conversationId
    return message
  }

  function editMessage(conversationId, messageId, text) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    const message = conversation?.messages.find((item) => item.id === messageId)
    if (!message || message.from !== meId.value || message.scheduled || !text.trim()) return false
    message.text = text.trim()
    message.editedAt = new Date().toISOString()
    return true
  }

  function deleteMessage(conversationId, messageId) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    const message = conversation?.messages.find((item) => item.id === messageId)
    if (!conversation || !message || message.from !== meId.value || message.scheduled) return false
    conversation.messages = conversation.messages.filter((item) => item.id !== messageId)
    return true
  }

  function toggleReaction(conversationId, messageId, emoji) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    const message = conversation?.messages.find((item) => item.id === messageId)
    if (!message || !emoji) return false
    if (!message.reactions) message.reactions = []

    const userId = meId.value || 'current-user'
    const reaction = message.reactions.find((item) => item.emoji === emoji)
    if (!reaction) {
      message.reactions.push({ emoji, users: [userId] })
    } else if (reaction.users.includes(userId)) {
      reaction.users = reaction.users.filter((id) => id !== userId)
      if (!reaction.users.length) {
        message.reactions = message.reactions.filter((item) => item !== reaction)
      }
    } else {
      reaction.users.push(userId)
    }
    return true
  }

  function cancelScheduledMessage(conversationId, messageId) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    if (!conversation) return false
    const message = conversation.messages.find((item) => item.id === messageId)
    if (!message?.scheduled) return false
    conversation.messages = conversation.messages.filter((item) => item.id !== messageId)
    return true
  }

  return {
    meId,
    users,
    companyMembers,
    usersById,
    conversations,
    sorted,
    activeId,
    loading,
    error,
    detailError,
    detailLoading,
    companyMembersLoading,
    companyMembersError,
    init,
    loadCompanyMembers,
    partnerId,
    titleOf,
    openConversation,
    deactivateConversation,
    closeConversation,
    isFavorite,
    toggleFavorite,
    startDm,
    startGroup,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    cancelScheduledMessage,
  }
})
