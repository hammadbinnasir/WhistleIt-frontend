import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAuthUserId } from '@/features/auth/session'
import { useTeamsStore } from '@/stores/teams'
import { useActivityStore } from '@/stores/activity'
import {
  deleteChannelMessage as removeChannelMessage,
  getChannelMessages,
  sendChannelMessage,
  updateChannelMessage as patchChannelMessage,
} from './channelMessageService'

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
  const loadingByChannel = ref({})
  const errorsByChannel = ref({})
  const deletionTimers = new Map()
  const serverDeletionRequests = new Map()
  const messageRequests = new Map()
  const pendingServerMessages = new Map()

  function unwrapMessages(data) {
    let response = data
    for (let depth = 0; depth < 3 && response && typeof response === 'object'; depth += 1) {
      if (response.success === false) {
        throw new Error(response.message || response.error || 'Unable to load channel messages.')
      }
      if (Array.isArray(response)) return response
      const list = response.messages ?? response.channel_messages ?? response.items
      if (Array.isArray(list)) return list
      response = response.data
    }
    throw new Error('The channel messages response does not contain a message list.')
  }

  function normalizeMessage(record) {
    if (!record || typeof record !== 'object') {
      throw new Error('The channel messages response contains an invalid message.')
    }
    const sender =
      record.sender && typeof record.sender === 'object'
        ? record.sender
        : record.user && typeof record.user === 'object'
          ? record.user
          : record.author && typeof record.author === 'object'
            ? record.author
            : {}
    const id = record.id ?? record.message_id ?? record.messageId
    if (id == null) throw new Error('A channel message is missing its ID.')
    const senderId = record.sender_id ?? record.user_id ?? record.from ?? sender.id ?? sender.user_id
    const userId = getAuthUserId()
    const deleted = Boolean(record.deleted || record.is_deleted || record.deleted_at || record.deletedAt)
    const content = deleted ? '' : (record.content ?? record.body ?? record.text ?? record.message ?? '')

    return {
      ...record,
      id: String(id),
      content: String(content),
      text: String(content),
      serverBacked: true,
      deleted,
      ...(deleted
        ? {
            deletedAt: record.deleted_at ?? record.deletedAt ?? new Date().toISOString(),
            attachments: [],
            reactions: [],
          }
        : {}),
      author:
        record.author_name ??
        record.sender_name ??
        sender.name ??
        sender.full_name ??
        (typeof record.author === 'string' ? record.author : ''),
      ...(senderId != null ? { from: String(senderId), authorId: String(senderId) } : {}),
      mine: userId != null && senderId != null && String(userId) === String(senderId),
      createdAt: record.created_at ?? record.createdAt ?? record.created_on ?? '',
      editedAt: record.edited_at ?? record.editedAt,
      forwardedFrom: record.forwarded_from ?? record.forwardedFrom,
      reactions: deleted ? [] : Array.isArray(record.reactions) ? record.reactions : [],
    }
  }

  function findCreatedMessage(data) {
    let response = data
    for (let depth = 0; depth < 5 && response && typeof response === 'object'; depth += 1) {
      if (Array.isArray(response)) return null
      const candidate = response.message ?? response.channel_message ?? response.item
      if (candidate && typeof candidate === 'object') return candidate
      if (response.id != null || response.message_id != null || response.messageId != null) {
        return response
      }
      response = response.data ?? response.result
    }
    return null
  }

  async function fetchChannelMessages(channelId) {
    const key = String(channelId ?? '')
    if (!key.trim()) return { success: false, error: 'A channel ID is required to load messages.' }

    const teams = useTeamsStore()
    const companyId = teams.activeWorkspaceId
    const teamId = teams.activeTeamId
    if (!companyId || !teamId) {
      const error = 'Select a company and team before loading channel messages.'
      errorsByChannel.value[key] = error
      return { success: false, error }
    }

    const requestId = (messageRequests.get(key) ?? 0) + 1
    messageRequests.set(key, requestId)
    loadingByChannel.value[key] = true
    errorsByChannel.value[key] = ''

    const result = await getChannelMessages(companyId, teamId, key)
    if (messageRequests.get(key) !== requestId) return result
    loadingByChannel.value[key] = false

    if (!result.success) {
      errorsByChannel.value[key] = result.error
      return result
    }

    try {
      const currentMessages = messagesFor(key)
      const deletedMessages = currentMessages.filter((message) => message.deleted)
      const deletedIds = new Set(deletedMessages.map((message) => String(message.id)))
      const fetched = unwrapMessages(result.data)
        .map(normalizeMessage)
        .filter((message) => !deletedIds.has(message.id))
      const localMessages = currentMessages.filter(
        (message) => String(message.id).startsWith('local-') && !deletedIds.has(String(message.id)),
      )
      const fetchedIds = new Set(fetched.map((message) => message.id))
      const pending = pendingServerMessages.get(key) ?? []
      const visiblePending = pending.filter(
        (message) => !fetchedIds.has(message.id) && !deletedIds.has(String(message.id)),
      )
      pendingServerMessages.set(
        key,
        pending.filter(
          (message) => !fetchedIds.has(message.id) && !deletedIds.has(String(message.id)),
        ),
      )
      messagesByChannel.value[key] = [
        ...deletedMessages,
        ...fetched,
        ...visiblePending,
        ...localMessages.filter((message) => !fetchedIds.has(String(message.id))),
      ]
      return { success: true, data: fetched }
    } catch (error) {
      errorsByChannel.value[key] =
        error instanceof Error ? error.message : 'Unable to read channel messages.'
      return { success: false, error: errorsByChannel.value[key] }
    }
  }

  async function postChannelMessage(channelId, payload) {
    const key = String(channelId ?? '')
    const content = typeof payload?.content === 'string' ? payload.content.trim() : ''
    if (!key.trim()) return { success: false, error: 'A channel ID is required to send a message.' }
    if (!content) return { success: false, error: 'Message content is required.' }

    const teams = useTeamsStore()
    const companyId = teams.activeWorkspaceId
    const teamId = teams.activeTeamId
    if (!companyId || !teamId) {
      return {
        success: false,
        error: 'Select a company and team before sending a channel message.',
      }
    }

    const metadata = { ...payload }
    delete metadata.content
    if (Array.isArray(metadata.attachments) && metadata.attachments.length === 0) {
      delete metadata.attachments
    }
    const result = await sendChannelMessage(companyId, teamId, key, {
      ...metadata,
      content,
    })
    if (!result.success) {
      errorsByChannel.value[key] = result.error
      return result
    }

    const createdRecord = findCreatedMessage(result.data)
    if (createdRecord) {
      const message = {
        ...normalizeMessage(createdRecord),
        ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
        mine: true,
      }
      const pending = pendingServerMessages.get(key) ?? []
      if (!pending.some((item) => item.id === message.id)) pending.push(message)
      pendingServerMessages.set(key, pending)
      const current = messagesFor(key)
      if (!current.some((item) => item.id === message.id)) {
        messagesByChannel.value[key] = [...current, message]
      }
    }

    await fetchChannelMessages(key)
    return { success: true, data: createdRecord }
  }

  async function updateServerMessage(channelId, messageId, content) {
    const key = String(channelId ?? '')
    const message = messagesFor(key).find((item) => String(item.id) === String(messageId))
    const updatedContent = typeof content === 'string' ? content.trim() : ''
    if (
      !message ||
      !message.serverBacked ||
      !message.mine ||
      message.scheduled ||
      message.deleted ||
      message.deleteScheduledAt ||
      !updatedContent
    ) {
      return { success: false, error: 'Only your unscheduled messages can be edited.' }
    }

    const teams = useTeamsStore()
    const companyId = teams.activeWorkspaceId
    const teamId = teams.activeTeamId
    if (!companyId || !teamId) {
      return {
        success: false,
        error: 'Select a company and team before editing a channel message.',
      }
    }

    const result = await patchChannelMessage(companyId, teamId, key, message.id, {
      content: updatedContent,
    })
    if (!result.success) return result

    message.content = updatedContent
    message.text = updatedContent
    message.editedAt = new Date().toISOString()
    persist()
    return { success: true, data: message }
  }

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
      executeScheduledDeletion(channelId, message)
      return
    }

    const timer = setTimeout(
      () => {
        deletionTimers.delete(timerKey)
        const current = messagesFor(channelId).find((item) => item.id === message.id)
        if (!current || current.deleteScheduledAt !== scheduledAt) return
        if (Date.parse(scheduledAt) <= Date.now()) {
          executeScheduledDeletion(channelId, current)
        } else {
          scheduleDeletion(channelId, current)
        }
      },
      Math.min(delay, MAX_TIMEOUT),
    )
    timer.unref?.()
    deletionTimers.set(timerKey, timer)
  }

  function executeScheduledDeletion(channelId, message) {
    if (!message.serverBacked) {
      finalizeDeletion(message)
      persist()
      return
    }

    void deleteServerMessage(channelId, message.id).then((result) => {
      if (!result.success) {
        delete message.deleteScheduledAt
        errorsByChannel.value[channelId] = result.error
        persist()
      }
    })
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
      backendSynced: false,
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
    if (!message.scheduled) {
      void syncMessage(channelId, message, payload)
    }
    return message
  }

  async function syncMessage(channelId, message, payload) {
    try {
      const saved = await sendChannelMessage(channelId, {
        body: payload.content ?? payload.body ?? '',
      })
      if (!saved.id) throw new Error('The server did not return a message ID.')

      const current = messagesFor(channelId).find((item) => item.id === message.id)
      if (!current) return
      current.id = saved.id
      current.backendSynced = true
      current.createdAt = saved.created_at ?? saved.createdAt ?? current.createdAt
      persist()
    } catch (error) {
      console.error('Unable to sync channel message:', error)
      message.syncError = error.message || 'Unable to sync channel message.'
      persist()
    }
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
    message.text = message.content
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

  function deleteServerMessage(channelId, messageId) {
    const key = String(channelId ?? '')
    const message = messagesFor(key).find((item) => String(item.id) === String(messageId))
    if (!message || !message.serverBacked || !message.mine || message.scheduled || message.deleted) {
      return { success: false, error: 'Only your unscheduled messages can be deleted.' }
    }
    const requestKey = `${key}:${message.id}`
    const pendingRequest = serverDeletionRequests.get(requestKey)
    if (pendingRequest) return pendingRequest

    const teams = useTeamsStore()
    const companyId = teams.activeWorkspaceId
    const teamId = teams.activeTeamId
    if (!companyId || !teamId) {
      return {
        success: false,
        error: 'Select a company and team before deleting a channel message.',
      }
    }

    const timerKey = `${key}:${message.id}`
    const timer = deletionTimers.get(timerKey)
    if (timer) clearTimeout(timer)
    deletionTimers.delete(timerKey)
    const previousMessage = { ...message }
    delete message.deleteScheduledAt
    finalizeDeletion(message)
    persist()

    const restoreMessage = () => {
      for (const field of [
        'deleted',
        'deletedAt',
        'deleteScheduledAt',
        'gif',
        'poll',
      ]) {
        if (!Object.hasOwn(previousMessage, field)) delete message[field]
      }
      Object.assign(message, previousMessage)
      persist()
    }

    const request = removeChannelMessage(companyId, teamId, key, message.id)
      .then((result) => {
        if (!result.success) restoreMessage()
        return result.success
          ? { success: true, data: message }
          : { success: false, error: result.error }
      })
      .catch((error) => {
        restoreMessage()
        return {
          success: false,
          error: error instanceof Error ? error.message : 'The channel message could not be deleted.',
        }
      })
      .finally(() => serverDeletionRequests.delete(requestKey))
    serverDeletionRequests.set(requestKey, request)
    return request
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
    loadingByChannel,
    errorsByChannel,
    messagesFor,
    visibleMessagesFor,
    hasOlderMessages,
    loadOlder,
    fetchChannelMessages,
    postChannelMessage,
    updateServerMessage,
    deleteServerMessage,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    cancelScheduledMessage,
  }
})
