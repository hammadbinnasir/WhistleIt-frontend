import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useActivityStore } from '@/stores/activity'

const STORAGE_KEY = 'whistleit:channel-messages'
const PAGE_SIZE = 20
const MAX_TIMEOUT = 2_147_483_647
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
  const deletionTimers = new Map()

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

  function finalizeDeletion(message) {
    message.deleted = true
    message.deletedAt = new Date().toISOString()
    message.content = ''
    message.text = ''
    message.attachments = []
    message.reactions = []
    delete message.deleteScheduledAt
    delete message.gif
    delete message.poll
  }

  function scheduleDeletion(channelId, message) {
    const timerKey = `${channelId}:${message.id}`
    const scheduledAt = message.deleteScheduledAt
    const existingTimer = deletionTimers.get(timerKey)
    if (existingTimer) clearTimeout(existingTimer)
    deletionTimers.delete(timerKey)

    const delay = Date.parse(scheduledAt) - Date.now()
    if (!Number.isFinite(delay)) return
    if (delay <= 0) {
      finalizeDeletion(message)
      persist()
      return
    }

    const timer = setTimeout(
      () => {
        deletionTimers.delete(timerKey)
        const current = messagesFor(channelId).find((item) => item.id === message.id)
        if (!current || current.deleteScheduledAt !== scheduledAt) return
        if (Date.parse(scheduledAt) <= Date.now()) {
          finalizeDeletion(current)
          persist()
        } else {
          scheduleDeletion(channelId, current)
        }
      },
      Math.min(delay, MAX_TIMEOUT),
    )
    timer.unref?.()
    deletionTimers.set(timerKey, timer)
  }

  function loadOlder(channelId) {
    const key = String(channelId)
    if (!hasOlderMessages(key)) return false
    visibleCounts.value[key] = (visibleCounts.value[key] || PAGE_SIZE) + PAGE_SIZE
    return true
  }

  function sendMessage(channelId, payload, author, conversationName = String(channelId)) {
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
    if (!message.scheduled) {
      useActivityStore().recordMessageMentions({
        text: message.content,
        conversationId: key,
        conversationName,
        conversationType: 'channel',
      })
    }
    persist()
    return message
  }

  function editMessage(channelId, messageId, content) {
    const message = messagesFor(channelId).find((item) => item.id === messageId)
    if (
      !message ||
      !message.mine ||
      message.scheduled ||
      message.deleted ||
      message.deleteScheduledAt ||
      !content.trim()
    )
      return false
    message.content = content.trim()
    message.editedAt = new Date().toISOString()
    persist()
    return true
  }

  function deleteMessage(channelId, messageId, scheduledAt = null) {
    const key = String(channelId)
    const message = messagesFor(key).find((item) => item.id === messageId)
    if (!message || !message.mine || message.scheduled || message.deleted) return false
    if (scheduledAt) {
      const timestamp = Date.parse(scheduledAt)
      if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return false
      message.deleteScheduledAt = new Date(timestamp).toISOString()
      scheduleDeletion(key, message)
      persist()
      return true
    }

    const timerKey = `${key}:${message.id}`
    const timer = deletionTimers.get(timerKey)
    if (timer) clearTimeout(timer)
    deletionTimers.delete(timerKey)
    finalizeDeletion(message)
    persist()
    return true
  }

  function toggleReaction(channelId, messageId, emoji, userId = 'current-user') {
    const message = messagesFor(channelId).find((item) => item.id === messageId)
    if (!message || message.deleted || !emoji) return false
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

  function cancelScheduledMessage(channelId, messageId) {
    const key = String(channelId)
    const message = messagesFor(key).find((item) => item.id === messageId)
    if (!message?.scheduled) return false
    messagesByChannel.value[key] = messagesFor(key).filter((item) => item.id !== messageId)
    persist()
    return true
  }

  for (const [channelId, messages] of Object.entries(messagesByChannel.value)) {
    for (const message of messages) {
      if (message.deleteScheduledAt) scheduleDeletion(channelId, message)
    }
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
    cancelScheduledMessage,
  }
})
