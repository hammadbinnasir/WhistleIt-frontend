import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'whistleit:channel-messages'
const PAGE_SIZE = 20
let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${generatedId++}`
}

function loadMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch (error) {
    console.error('Unable to load messages from browser storage:', error)
    return {}
  }
}

export const useMessagesStore = defineStore('messages', () => {
  const messagesByChannel = ref(loadMessages())
  const visibleCounts = ref({})

  function messagesFor(channelId) {
    return messagesByChannel.value[String(channelId)] || []
  }

  function visibleMessagesFor(channelId) {
    const messages = messagesFor(channelId)
    const count = visibleCounts.value[String(channelId)] || PAGE_SIZE
    return messages.slice(-count)
  }

  function hasOlderMessages(channelId) {
    return visibleMessagesFor(channelId).length < messagesFor(channelId).length
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesByChannel.value))
    } catch (error) {
      console.error('Unable to save messages to browser storage:', error)
    }
  }

  function loadOlder(channelId) {
    const key = String(channelId)
    if (!hasOlderMessages(key)) return false
    visibleCounts.value[key] = (visibleCounts.value[key] || PAGE_SIZE) + PAGE_SIZE
    return true
  }

  function sendMessage(channelId, payload, author) {
    const key = String(channelId)
    const message = {
      id: createId(),
      content: payload.content,
      author,
      authorId: 'current-user',
      mine: true,
      createdAt: new Date().toISOString(),
      reactions: [],
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
      ...(payload.attachments?.length ? { attachments: [...payload.attachments] } : {}),
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
    if (!messagesByChannel.value[key]) messagesByChannel.value[key] = []
    messagesByChannel.value[key].push(message)
    persist()
    return message
  }

  function editMessage(channelId, messageId, content) {
    const message = messagesFor(channelId).find((item) => item.id === messageId)
    if (!message || !message.mine || message.scheduled || !content.trim()) return false
    message.content = content.trim()
    message.editedAt = new Date().toISOString()
    persist()
    return true
  }

  function deleteMessage(channelId, messageId) {
    const key = String(channelId)
    const message = messagesFor(key).find((item) => item.id === messageId)
    if (!message || !message.mine || message.scheduled) return false
    messagesByChannel.value[key] = messagesFor(key).filter((item) => item.id !== messageId)
    persist()
    return true
  }

  function toggleReaction(channelId, messageId, emoji, userId = 'current-user') {
    const message = messagesFor(channelId).find((item) => item.id === messageId)
    if (!message || !emoji) return false
    if (!message.reactions) message.reactions = []
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
    persist()
    return true
  }

  return {
    messagesByChannel,
    visibleCounts,
    messagesFor,
    visibleMessagesFor,
    hasOlderMessages,
    loadOlder,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
  }
})
