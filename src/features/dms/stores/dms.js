import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'
import { useActivityStore } from '@/stores/activity'

let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${generatedId++}`
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export const useDmStore = defineStore('dms', () => {
  const meId = ref(null)
  const users = ref([])
  const conversations = ref([])
  const activeId = ref(null)
  const loading = ref(false)
  const error = ref('')
  const usersById = computed(() => Object.fromEntries(users.value.map((user) => [user.id, user])))
  const sorted = computed(() =>
    conversations.value.slice().sort((a, b) => {
      const aTime = a.messages.at(-1)?.createdAt ?? ''
      const bTime = b.messages.at(-1)?.createdAt ?? ''
      return bTime.localeCompare(aTime)
    }),
  )

  let initialization

  async function init() {
    if (initialization) return initialization

    loading.value = true
    error.value = ''
    initialization = Promise.all([dmApi.users(), dmApi.conversations()])
      .then(([loadedUsers, loadedConversations]) => {
        users.value = loadedUsers
        conversations.value = loadedConversations
        meId.value = dmApi.meId()
      })
      .catch((cause) => {
        error.value = errorMessage(cause)
      })
      .finally(() => {
        loading.value = false
        initialization = null
      })

    return initialization
  }

  function partnerId(conversation) {
    return conversation.members.find((id) => id !== meId.value) ?? null
  }

  function titleOf(conversation) {
    if (conversation.name) return conversation.name
    if (conversation.type === 'dm') return usersById.value[partnerId(conversation)]?.name ?? ''
    return conversation.members
      .filter((id) => id !== meId.value)
      .map((id) => usersById.value[id]?.name)
      .filter(Boolean)
      .join(', ')
  }

  function openConversation(id) {
    const conversation = conversations.value.find((item) => item.id === id)
    if (!conversation) return false
    conversation.unreadCount = 0
    activeId.value = id
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

  function startConversation(memberIds, name = '') {
    const members = [...new Set([meId.value, ...memberIds])]
    const existing = conversations.value.find(
      (conversation) =>
        conversation.members.length === members.length &&
        members.every((memberId) => conversation.members.includes(memberId)),
    )

    if (existing) {
      openConversation(existing.id)
      return existing
    }

    const conversation = {
      id: createId(),
      type: members.length === 2 ? 'dm' : 'group',
      members,
      name: name.trim(),
      unreadCount: 0,
      messages: [],
    }
    conversations.value.push(conversation)
    activeId.value = conversation.id
    return conversation
  }

  function startDm(userId) {
    return startConversation([userId])
  }

  function startGroup(userIds, name = '') {
    return startConversation(userIds, name)
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

  function receiveDemo() {
    const conversation = sorted.value.find((item) => item.id !== activeId.value) || sorted.value[0]
    if (!conversation) return

    const senderId = partnerId(conversation)
    const sender = usersById.value[senderId]
    const text = 'You have a new message.'
    const message = {
      id: createId(),
      from: senderId,
      text,
      createdAt: new Date().toISOString(),
    }
    conversation.messages.push(message)
    if (conversation.id !== activeId.value) conversation.unreadCount += 1

    const activity = useActivityStore()
    activity.addActivity({
      type: 'message',
      conversationId: conversation.id,
      title: sender?.name || titleOf(conversation) || 'New message',
      body: text,
    })
    return message
  }

  return {
    meId,
    users,
    usersById,
    conversations,
    sorted,
    activeId,
    loading,
    error,
    init,
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
    receiveDemo,
  }
})
