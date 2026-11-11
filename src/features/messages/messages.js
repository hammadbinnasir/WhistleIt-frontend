import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAuthUserId } from '@/features/auth/session'
import { useTeamsStore } from '@/stores/teams'
import { useActivityStore } from '@/stores/activity'
import { normalizeMessageContent } from './message-utils'
import {
  deleteChannelMessage as removeChannelMessage,
  getChannelMessages,
  sendChannelMessage,
  updateChannelMessage as patchChannelMessage,
} from './channelMessageService'
import { normalizeMessageAttachments } from './messageAttachments'

const STORAGE_KEY = 'whistleit:channel-messages'
const PAGE_SIZE = 20
const API_PAGE_SIZE = 15
const MAX_TIMEOUT = 2_147_483_647
let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${generatedId++}`
}

function isDeletedMessage(record) {
  const deletedFlag = [record.deleted, record.is_deleted, record.isDeleted].some(
    (flag) =>
      flag === true ||
      flag === 1 ||
      (typeof flag === 'string' && ['true', '1'].includes(flag.trim().toLowerCase())),
  )
  const deletedAt = record.deleted_at ?? record.deletedAt
  return deletedFlag || (deletedAt != null && deletedAt !== '')
}

function voiceNoteIdFrom(record) {
  const queue = [{ value: record, depth: 0 }]
  const seen = new Set()
  const idKeys = ['voice_note_id', 'voiceNoteId', 'voiceNoteID']
  const relationKeys = ['voice_note', 'voiceNote', 'voice_note_data', 'voiceNoteData']
  const wrapperKeys = [
    'message',
    'channel_message',
    'data',
    'result',
    'payload',
    'sender',
    'user',
    'author',
  ]

  while (queue.length) {
    const { value, depth } = queue.shift()
    if (!value || typeof value !== 'object' || seen.has(value)) continue
    seen.add(value)

    for (const key of idKeys) {
      const id = value[key]
      if (id != null && String(id).trim()) return String(id)
    }

    for (const key of relationKeys) {
      const relation = value[key]
      if (typeof relation === 'string' || typeof relation === 'number') {
        if (String(relation).trim()) return String(relation)
      } else if (relation && typeof relation === 'object') {
        const id =
          relation.id ?? relation.voice_note_id ?? relation.voiceNoteId ?? relation.voiceNoteID
        if (id != null && String(id).trim()) return String(id)
        if (depth < 4) queue.push({ value: relation, depth: depth + 1 })
      }
    }

    if (depth < 4) {
      for (const key of wrapperKeys) {
        const nested = value[key]
        if (nested && typeof nested === 'object') {
          queue.push({ value: nested, depth: depth + 1 })
        }
      }
    }
  }
  return null
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
  const loadingOlderByChannel = ref({})
  const errorsByChannel = ref({})
  const currentPageByChannel = ref({})
  const lastPageByChannel = ref({})
  const hasMorePagesByChannel = ref({})
  const deletionTimers = new Map()
  const serverDeletionRequests = new Map()
  const messageRequests = new Map()
  const pendingServerMessages = new Map()

  function unwrapMessages(data) {
    let response = data
    let pagination = null
    for (let depth = 0; depth < 5 && response && typeof response === 'object'; depth += 1) {
      if (response.success === false) {
        throw new Error(response.message || response.error || 'Unable to load channel messages.')
      }
      if (Array.isArray(response)) return { messages: response, pagination }
      if (response.pagination && typeof response.pagination === 'object') {
        pagination = response.pagination
      }
      const list = response.messages ?? response.channel_messages ?? response.items
      if (Array.isArray(list)) return { messages: list, pagination }
      response = response.data
    }
    throw new Error('The channel messages response does not contain a message list.')
  }

  function sortMessages(messages) {
    return messages.sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || '')
      const rightTime = Date.parse(right.createdAt || '')
      return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? leftTime - rightTime : 0
    })
  }

  function readHasMorePages(pagination, page) {
    const hasMore = pagination?.has_more_pages ?? pagination?.hasMorePages
    if (typeof hasMore === 'boolean') return hasMore
    if (typeof hasMore === 'string') return ['true', '1'].includes(hasMore.toLowerCase())
    const lastPage = Number(pagination?.last_page ?? pagination?.lastPage)
    return Number.isFinite(lastPage) && lastPage > page
  }

  function normalizeMessage(record) {
    if (!record || typeof record !== 'object') {
      throw new Error('The channel messages response contains an invalid message.')
    }
    const message = record.message ?? record.channel_message ?? record
    const voiceNoteId = voiceNoteIdFrom(record)
    const sender =
      message.sender && typeof message.sender === 'object'
        ? message.sender
        : message.user && typeof message.user === 'object'
          ? message.user
          : message.author && typeof message.author === 'object'
            ? message.author
            : {}
    const id = message.id ?? message.message_id ?? message.messageId
    if (id == null) throw new Error('A channel message is missing its ID.')
    const senderId =
      message.sender_id ?? message.user_id ?? message.from ?? sender.id ?? sender.user_id
    const userId = getAuthUserId()
    const deleted = isDeletedMessage(record)
    const attachments = deleted ? [] : normalizeMessageAttachments(record)
    const content = deleted
      ? ''
      : normalizeMessageContent(record.content ?? record.body ?? record.text ?? record.message ?? '')

    return {
      ...record,
      ...message,
      id: String(id),
      content: String(content),
      text: String(content),
      ...((message.isCode ?? message.is_code) !== undefined
        ? { isCode: Boolean(message.isCode ?? message.is_code) }
        : {}),
      ...(voiceNoteId != null ? { voiceNoteId: String(voiceNoteId) } : {}),
      serverBacked: true,
      backendSynced: true,
      deleted,
      ...(deleted
        ? {
            deletedAt: message.deleted_at ?? message.deletedAt ?? new Date().toISOString(),
            attachments: [],
            reactions: [],
          }
        : {}),
      ...(!deleted && attachments.length ? { attachments } : {}),
      author:
        message.author_name ??
        message.sender_name ??
        sender.name ??
        sender.full_name ??
        (typeof message.author === 'string' ? message.author : ''),
      ...(senderId != null ? { from: String(senderId), authorId: String(senderId) } : {}),
      mine: userId != null && senderId != null && String(userId) === String(senderId),
      createdAt: message.created_at ?? message.createdAt ?? message.created_on ?? '',
      editedAt: message.edited_at ?? message.editedAt,
      forwardedFrom: message.forwarded_from ?? message.forwardedFrom,
      reactions: deleted ? [] : Array.isArray(message.reactions) ? message.reactions : [],
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

  async function fetchChannelMessages(channelId, { page = 1, olderPage = false } = {}) {
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

    const requestKey = `${key}:${page}`
    const requestId = (messageRequests.get(requestKey) ?? 0) + 1
    messageRequests.set(requestKey, requestId)
    if (page === 1 && !olderPage) loadingByChannel.value[key] = true
    errorsByChannel.value[key] = ''

    const result = await getChannelMessages(companyId, teamId, key, {
      page,
      perPage: API_PAGE_SIZE,
    })
    if (messageRequests.get(requestKey) !== requestId) return result
    if (page === 1 && !olderPage) loadingByChannel.value[key] = false

    if (!result.success) {
      errorsByChannel.value[key] = result.error
      return result
    }

    try {
      const { messages: records, pagination } = unwrapMessages(result.data)
      const currentMessages = messagesFor(key)
      const currentById = new Map(currentMessages.map((message) => [String(message.id), message]))
      const fetched = records.map((record) => {
        const message = normalizeMessage(record)
        const previous = currentById.get(message.id)
        if (!message.forwardedFrom && previous?.forwardedFrom) {
          message.forwardedFrom = previous.forwardedFrom
        }
        if (message.isCode === undefined && previous?.isCode !== undefined) {
          message.isCode = previous.isCode
        }
        return message
      })
      const deletedMessages = currentMessages.filter((message) => message.deleted)
      const deletedIds = new Set(deletedMessages.map((message) => String(message.id)))
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

      const merged = new Map(
        currentMessages
          .filter((message) => !deletedIds.has(String(message.id)) || message.deleted)
          .map((message) => [String(message.id), message]),
      )
      for (const message of fetched) {
        if (deletedIds.has(message.id)) continue
        const existing = merged.get(message.id)
        const voiceNoteId =
          message.voiceNoteId ??
          message.voice_note_id ??
          message.voice_note?.id ??
          existing?.voiceNoteId ??
          existing?.voice_note_id ??
          existing?.voice_note?.id
        if (voiceNoteId != null) message.voiceNoteId = String(voiceNoteId)
        if (existing?.attachments?.length && message.attachments?.length) {
          const localAttachments = new Map(
            existing.attachments
              .filter((attachment) => attachment.localPreviewUrl)
              .map((attachment) => [attachment.name, attachment.localPreviewUrl]),
          )
          message.attachments = message.attachments.map((attachment) => ({
            ...attachment,
            ...(localAttachments.has(attachment.name)
              ? { localPreviewUrl: localAttachments.get(attachment.name) }
              : {}),
          }))
        } else if (!message.attachments?.length && existing?.attachments?.length) {
          message.attachments = existing.attachments
        }
        merged.set(message.id, message)
      }
      for (const message of visiblePending) merged.set(String(message.id), message)
      messagesByChannel.value[key] = sortMessages([...merged.values()])

      const responsePage = Number(pagination?.current_page ?? pagination?.currentPage ?? page)
      currentPageByChannel.value[key] = Math.max(currentPageByChannel.value[key] || 0, responsePage)
      const lastPage = Number(pagination?.last_page ?? pagination?.lastPage)
      if (Number.isFinite(lastPage) && lastPage > 0) {
        lastPageByChannel.value[key] = lastPage
        hasMorePagesByChannel.value[key] = currentPageByChannel.value[key] < lastPage
      } else if (responsePage >= (currentPageByChannel.value[key] || 1)) {
        hasMorePagesByChannel.value[key] = readHasMorePages(pagination, responsePage)
      }
      return { success: true, data: fetched }
    } catch (error) {
      errorsByChannel.value[key] =
        error instanceof Error ? error.message : 'Unable to read channel messages.'
      return { success: false, error: errorsByChannel.value[key] }
    } finally {
      if (page === 1 && !olderPage && messageRequests.get(requestKey) === requestId) {
        loadingByChannel.value[key] = false
      }
    }
  }

  async function postChannelMessage(channelId, payload) {
    const key = String(channelId ?? '')
    const rawContent = typeof payload?.content === 'string' ? payload.content : ''
    const content = payload?.isCode ? rawContent : rawContent.trim()
    if (!key.trim()) return { success: false, error: 'A channel ID is required to send a message.' }
    if (!content.trim() && !payload?.attachment) {
      return { success: false, error: 'Message content is required.' }
    }

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
    const result = await sendChannelMessage(companyId, teamId, key, {
      ...metadata,
      content,
      text: content,
      isCode: Boolean(payload.isCode),
    })
    if (!result.success) {
      errorsByChannel.value[key] = result.error
      return result
    }

    const createdRecord = findCreatedMessage(result.data)
    const serverConfirmedAttachment = Boolean(
      payload.attachment && normalizeMessageAttachments(createdRecord ?? {}).length,
    )
    if (createdRecord) {
      const localPreviewUrl =
        payload.attachment && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(payload.attachment)
          : null
      const responseAttachments = normalizeMessageAttachments(createdRecord)
      const localAttachments =
        payload.attachment && localPreviewUrl
          ? responseAttachments.length
            ? responseAttachments.map((attachment) => ({
                ...attachment,
                ...(attachment.name === payload.attachment.name ? { localPreviewUrl } : {}),
              }))
            : [
                {
                  name: payload.attachment.name,
                  size: payload.attachment.size,
                  type: payload.attachment.type,
                  localOnly: true,
                  localPreviewUrl,
                },
              ]
          : responseAttachments
      const message = {
        ...normalizeMessage(createdRecord),
        attachments: localAttachments,
        isCode: Boolean(payload.isCode),
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

    void fetchChannelMessages(key)
    if (payload.attachment && !serverConfirmedAttachment) persist()
    return {
      success: true,
      data: createdRecord,
      ...(payload.attachment ? { attachmentPersisted: serverConfirmedAttachment } : {}),
    }
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
    const visible = messages.slice(-count)
    const visibleIds = new Set(visible.map((message) => String(message.id)))
    return [
      ...messages.filter((message) => message.deleted && !visibleIds.has(String(message.id))),
      ...visible,
    ]
  }

  function hasOlderMessages(channelId) {
    const key = String(channelId)
    const visibleCount = visibleCounts.value[key] || PAGE_SIZE
    return messagesFor(key).length > visibleCount || Boolean(hasMorePagesByChannel.value[key])
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messagesByChannel.value, (key, value) =>
          key === 'localPreviewUrl' ? undefined : value,
        ),
      )
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

  async function loadOlder(channelId) {
    const key = String(channelId)
    if (loadingOlderByChannel.value[key] || !hasOlderMessages(key)) return false

    const visibleCount = visibleCounts.value[key] || PAGE_SIZE
    if (messagesFor(key).length > visibleCount) {
      visibleCounts.value[key] = visibleCount + PAGE_SIZE
      return true
    }

    if (!hasMorePagesByChannel.value[key]) return false
    loadingOlderByChannel.value[key] = true
    const nextPage = (currentPageByChannel.value[key] || 1) + 1
    try {
      const result = await fetchChannelMessages(key, { page: nextPage, olderPage: true })
      if (!result.success || !result.data.length) return false
      visibleCounts.value[key] = visibleCount + PAGE_SIZE
      return true
    } finally {
      loadingOlderByChannel.value[key] = false
    }
  }

  function sendMessage(channelId, payload, author, conversationName = String(channelId)) {
    const key = String(channelId)
    const message = {
      backendSynced: payload.backendSynced === true,
      id: payload.id == null ? createId() : String(payload.id),
      content: payload.content ?? '',
      author,
      authorId: 'current-user',
      mine: true,
      createdAt: payload.createdAt ?? new Date().toISOString(),
      isCode: Boolean(payload.isCode),
      reactions: [],
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.forwardedFrom ? { forwardedFrom: payload.forwardedFrom } : {}),
      ...(payload.voiceNoteId ? { voiceNoteId: String(payload.voiceNoteId) } : {}),
      ...(payload.attachment
        ? {
            attachments: [
              {
                name: payload.attachment.name,
                size: payload.attachment.size,
                type: payload.attachment.type,
              },
            ],
          }
        : {}),
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
    if (!message.scheduled && !message.backendSynced) {
      void syncMessage(channelId, message, payload)
    }
    return message
  }

  async function syncMessage(channelId, message, payload) {
    try {
      const teams = useTeamsStore()
      const { replyTo, ...metadata } = payload
      const apiPayload = {
        ...metadata,
        content: payload.content ?? payload.body ?? '',
        text: payload.content ?? payload.body ?? '',
        isCode: Boolean(payload.isCode),
        ...(replyTo?.id != null ? { parentMessageId: String(replyTo.id) } : {}),
      }
      const result = await sendChannelMessage(
        teams.activeWorkspaceId,
        teams.activeTeamId,
        channelId,
        apiPayload,
      )
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to sync channel message.')
      }
      const saved = findCreatedMessage(result.data)
      const savedId = saved?.id ?? saved?.message_id ?? saved?.messageId
      if (savedId == null) throw new Error('The server did not return a message ID.')

      const current = messagesFor(channelId).find((item) => item.id === message.id)
      if (!current) return
      current.id = String(savedId)
      current.serverBacked = true
      current.backendSynced = true
      current.createdAt = saved.created_at ?? saved.createdAt ?? current.createdAt
      persist()
    } catch (error) {
      console.error('Unable to sync channel message:', error)
      message.syncError = error.message || 'Unable to sync channel message.'
      persist()
    }
  }

  function mergeChannelMessages(channelId, incoming) {
    const key = String(channelId)
    const merged = new Map(messagesFor(key).map((message) => [String(message.id), message]))
    const reconciledIds = new Set()
    for (const message of incoming) {
      if (message?.id == null) continue
      const id = String(message.id)
      let existing = merged.get(id)
      if (
        !existing &&
        !(message.voiceNoteId ?? message.voice_note_id ?? message.voice_note?.id) &&
        message.mine
      ) {
        const messageTime = Date.parse(message.createdAt || '')
        const candidates = [...merged.values()]
          .filter((candidate) => {
            const candidateTime = Date.parse(candidate.createdAt || '')
            const candidateVoiceNoteId =
              candidate.voiceNoteId ?? candidate.voice_note_id ?? candidate.voice_note?.id
            return (
              !reconciledIds.has(String(candidate.id)) &&
              candidateVoiceNoteId &&
              candidate.mine &&
              String(candidate.content ?? candidate.text ?? '')
                .trim()
                .toLowerCase() === 'voice message' &&
              String(message.content ?? message.text ?? '')
                .trim()
                .toLowerCase() === 'voice message' &&
              Number.isFinite(messageTime) &&
              Number.isFinite(candidateTime) &&
              Math.abs(messageTime - candidateTime) <= 5 * 60_000
            )
          })
          .sort(
            (left, right) =>
              Math.abs(Date.parse(left.createdAt) - messageTime) -
              Math.abs(Date.parse(right.createdAt) - messageTime),
          )
        existing = candidates[0]
        if (existing) {
          merged.delete(String(existing.id))
          reconciledIds.add(String(existing.id))
        }
      }
      merged.set(id, {
        ...existing,
        ...message,
        id,
        voiceNoteId:
          message.voiceNoteId ??
          message.voice_note_id ??
          message.voice_note?.id ??
          existing?.voiceNoteId ??
          existing?.voice_note_id ??
          existing?.voice_note?.id,
        reactions: message.reactions ?? existing?.reactions ?? [],
        mine: message.mine ?? existing?.mine ?? false,
      })
    }
    messagesByChannel.value[key] = [...merged.values()].sort(
      (left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0),
    )
    persist()
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
    if (
      !message ||
      !message.serverBacked ||
      !message.mine ||
      message.scheduled ||
      message.deleted
    ) {
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
    const content = message.content ?? message.text ?? ''
    delete message.deleteScheduledAt
    finalizeDeletion(message)
    persist()

    const restoreMessage = () => {
      for (const field of ['deleted', 'deletedAt', 'deleteScheduledAt', 'gif', 'poll']) {
        if (!Object.hasOwn(previousMessage, field)) delete message[field]
      }
      Object.assign(message, previousMessage)
      persist()
    }

    const messageBody = [previousMessage.content, previousMessage.text, previousMessage.body].find(
      (value) => typeof value === 'string' && value.trim(),
    )
    const request = removeChannelMessage(companyId, teamId, key, message.id, messageBody ?? content)
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
          error:
            error instanceof Error ? error.message : 'The channel message could not be deleted.',
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
    loadingOlderByChannel,
    errorsByChannel,
    currentPageByChannel,
    lastPageByChannel,
    hasMorePagesByChannel,
    messagesFor,
    visibleMessagesFor,
    hasOlderMessages,
    loadOlder,
    fetchChannelMessages,
    postChannelMessage,
    updateServerMessage,
    deleteServerMessage,
    sendMessage,
    mergeChannelMessages,
    editMessage,
    deleteMessage,
    toggleReaction,
    cancelScheduledMessage,
  }
})
