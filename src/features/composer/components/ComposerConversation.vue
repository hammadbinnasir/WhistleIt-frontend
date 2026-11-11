<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import { useChannelsStore } from '@/features/channels'
import {
  pinMessage,
  sendChannelVoiceMessage,
  unpinMessage,
} from '@/features/channels/api/channels.api'
import { useDmStore } from '@/features/dms/stores/dms'
import VoiceNotePlayer from '@/features/media/VoiceNotePlayer.vue'
import MessageAttachment from '@/features/messages/MessageAttachment.vue'
import { getAuthUser, getAuthUserId } from '@/features/auth/session'
import { useMessagesStore } from '@/features/messages/messages'
import {
  createLinkPreview,
  dateLabel,
  formattedMessageHtml,
  messageSegments,
  sameDay,
  timeLabel,
} from '@/features/messages/message-utils'
import { useUiStore } from '@/stores/ui'
import { useTeamsStore } from '@/stores/teams'
import { useUserStore } from '@/features/account/composables/useUserStore'
import { useRemindersStore } from '@/features/search/reminders'
import { addMockMessage, removeMockMessage, updateMockMessage } from '@/features/search/search'
import SetReminderModal from '@/features/search/SetReminderModal.vue'
import systemProfile from '@/assets/system-profile.webp'
import { createScheduledMessage, getScheduledMessages } from '../api/scheduledMessagesApi'
import { usePoll } from '../composables/usePoll'
import MessageComposer from './MessageComposer.vue'
import PollMessage from './PollMessage.vue'
import { normalizeMessageText } from '../messageText'
import pinChatIcon from '@/assets/pin-chat.svg'
import unpinChatIcon from '@/assets/unpin-chat.svg'

const props = defineProps({
  conversationId: { type: [String, Number], default: null },
  conversationType: { type: String, default: 'channel' },
})

const dms = useDmStore()
const pollApi = usePoll()
const channelsStore = useChannelsStore()
const teamsStore = useTeamsStore()
const ui = useUiStore()
const userStore = useUserStore()
const messageStore = useMessagesStore()
const reminderStore = useRemindersStore()
const messagesContainer = ref(null)
const messageComposer = ref(null)
const editingId = ref(null)
const editDraft = ref('')
const replyTo = ref(null)
const openMenuId = ref(null)
const deleteTarget = ref(null)
const scheduleDelete = ref(false)
const scheduledDeleteAt = ref('')
const openReactionId = ref(null)
const reminderTarget = ref(null)
const snoozeTarget = ref(null)
const forwardTarget = ref(null)
const forwardDestinationId = ref('')
const dmVisibleCount = ref(20)
const participatedPolls = ref(new Set())
const activePoll = ref(null)
const activePollMode = ref('respond')
const pollResponses = ref({})
const pollResults = ref({})
const closedPolls = ref(new Set())
const minimumDeleteDate = computed(() => toLocalDateTimeValue(new Date(Date.now() + 60_000)))

const currentUserName = computed(
  () => dms.usersById[dms.meId]?.name || getAuthUser()?.fullName || 'You',
)
let messageClickTimer = null
let channelMessagesRefreshTimer = null

const pollClock = ref(Date.now())
let pollClockTimer = null
const LOCAL_SCHEDULED_MESSAGES_KEY = 'whistleit:composer-scheduled-messages'
const channelId = computed(() => String(props.conversationId ?? 'general'))
const conversation = computed(() => {
  if (props.conversationType !== 'dm' || props.conversationId == null) return null
  return dms.conversations.find((item) => String(item.id) === String(props.conversationId)) || null
})
const conversationLabel = computed(() =>
  conversation.value
    ? dms.titleOf(conversation.value)
    : channelsStore.getById(channelId.value)?.name || channelId.value.replaceAll('-', ' '),
)
const canSendMessages = computed(() => {
  if (props.conversationType === 'dm') return true

  const channel = channelsStore.getById(channelId.value)
  if (!channel) return !channelsStore.loaded

  const userId = getAuthUserId() ?? dms.meId
  const isChannelAdmin =
    teamsStore.isAdmin ||
    channel.canManage ||
    channel.isOwner ||
    (userId != null && String(channel.createdById ?? channel.createdBy) === String(userId))
  const isAllowedSender =
    userId != null &&
    (channel.allowedSenderIds || []).some((sender) => {
      const senderId =
        sender && typeof sender === 'object'
          ? (sender.id ?? sender.user_id ?? sender.userId ?? sender.member_id)
          : sender
      return senderId != null && String(senderId) === String(userId)
    })
  const usesSelectedMembersPermission = ['selected_members', 'specific'].includes(
    channel.messagePermission,
  )

  if (usesSelectedMembersPermission && isAllowedSender) return true
  if (channel.isMember === false) return false

  if (channel.messagePermission === 'creator_only' || channel.messagePermission === 'admins') {
    return isChannelAdmin
  }
  if (usesSelectedMembersPermission) {
    return isChannelAdmin || isAllowedSender
  }
  return channel.isMember !== false
})

const messagesLoading = computed(() => Boolean(conversation.value) && dms.messagesLoading)
const messagesError = computed(() => (conversation.value ? dms.messagesError : ''))
const currentReminderConversationType = computed(() =>
  props.conversationType === 'dm' ? 'dm' : 'channel',
)
const dueReminders = computed(() =>
  reminderStore.dueItems
    .filter(
      (reminder) =>
        String(reminder.conversationId ?? 'general') === channelId.value &&
        (reminder.conversationType === 'dm' ? 'dm' : 'channel') ===
          currentReminderConversationType.value,
    )
    .sort((a, b) => new Date(a.firedAt) - new Date(b.firedAt)),
)
const deletedReminders = computed(() =>
  reminderStore.deletedItems
    .filter(
      (reminder) =>
        String(reminder.conversationId ?? 'general') === channelId.value &&
        (reminder.conversationType === 'dm' ? 'dm' : 'channel') ===
          currentReminderConversationType.value &&
        (reminder.dismissed || !reminder.fired) &&
        !reminder.hideFromChat,
    )
    .sort((a, b) => new Date(a.deletedAt || a.remindAt) - new Date(b.deletedAt || b.remindAt)),
)
const activeReminders = computed(() =>
  reminderStore.sorted.filter(
    (reminder) =>
      String(reminder.conversationId ?? 'general') === channelId.value &&
      (reminder.conversationType === 'dm' ? 'dm' : 'channel') ===
        currentReminderConversationType.value,
  ),
)

function remindersForMessage(message) {
  const messageId = String(message.messageId ?? message.id)
  return activeReminders.value.filter((reminder) => String(reminder.messageId) === messageId)
}

function retryConversationMessages() {
  if (conversation.value) void dms.loadMessages(conversation.value.id, { force: true })
}

function retryMessage(message) {
  if (conversation.value) dms.retryMessage(conversation.value.id, message.id)
}

// Edit/delete API fail ho to toast dikhao
watch(
  () => dms.actionError,
  (message) => {
    if (!message) return
    ui.toast('Action failed', message, 'error')
    dms.actionError = ''
  },
)

const conversationMeta = computed(() => ({
  id: channelId.value,
  name: conversationLabel.value,
  kind: props.conversationType === 'dm' ? 'dm' : 'public',
}))
const forwardDestinations = computed(() => [
  ...channelsStore.visibleChannels.map((channel) => ({
    id: channel.id,
    name: `#${channel.name}`,
    type: 'channel',
  })),
  ...dms.conversations
    .filter((item) => item.id !== conversation.value?.id)
    .map((item) => ({
      id: item.id,
      name: dms.titleOf(item),
      type: 'dm',
    })),
])
const allMessages = computed(() =>
  conversation.value ? conversation.value.messages : messageStore.messagesFor(channelId.value),
)
const hasOlderMessages = computed(() =>
  conversation.value
    ? allMessages.value.length > dmVisibleCount.value
    : messageStore.hasOlderMessages(channelId.value),
)
const loadingOlderMessages = computed(
  () => !conversation.value && Boolean(messageStore.loadingOlderByChannel[channelId.value]),
)
const visibleMessages = computed(() =>
  conversation.value
    ? allMessages.value.slice(-dmVisibleCount.value)
    : messageStore.visibleMessagesFor(channelId.value),
)
const renderedMessages = computed(() => {
  const currentUser = currentUserName.value
  let previous = null

  return [...visibleMessages.value]
    .filter((message, index, messages) => {
      if (!message.scheduled || !isScheduledMessageDelivered(message)) return true
      const content = String(message.content ?? message.text ?? message.body ?? '').trim()
      const scheduledAt = scheduledTimestamp(message)
      return !messages.some((candidate, candidateIndex) => {
        if (candidateIndex === index || candidate.scheduled || candidate.deleted) return false
        const candidateContent = String(
          candidate.content ?? candidate.text ?? candidate.body ?? '',
        ).trim()
        const sentAt = Date.parse(candidate.createdAt || '')
        return (
          candidateContent === content &&
          Number.isFinite(scheduledAt) &&
          Number.isFinite(sentAt) &&
          Math.abs(sentAt - scheduledAt) <= 5 * 60_000
        )
      })
    })
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((message) => {
      const voiceNoteId = message.voiceNoteId ?? message.voice_note_id ?? message.voice_note?.id
      const messageContent = message.text ?? message.content ?? ''
      const normalizedContent = normalizeMessageText(messageContent)
      const content = message.deleted
        ? '(message deleted)'
        : voiceNoteId && normalizedContent.trim().toLowerCase() === 'voice message'
          ? ''
          : normalizedContent
      const author =
        message.from === dms.meId
          ? currentUser
          : message.from
            ? dms.usersById[message.from]?.name || message.author || conversationLabel.value
            : message.author || currentUser
      const authorId = message.from ?? message.authorId ?? author
      const grouped =
        previous &&
        authorId === previous.authorId &&
        sameDay(previous.createdAt, message.createdAt) &&
        new Date(message.createdAt) - new Date(previous.createdAt) < 5 * 60_000
      const rendered = {
        ...message,
        content,
        important: isImportantMessage(message),
        formattedContent: formattedMessageHtml(content),
        author,
        authorId,
        mine: message.mine ?? message.from === dms.meId,
        showDate: !previous || !sameDay(previous.createdAt, message.createdAt),
        dateHeading: dateLabel(message.createdAt),
        time: timeLabel(message.createdAt),
        grouped: Boolean(grouped),
        segments: messageSegments(content),
        preview: createLinkPreview(content),
        reply: message.replyTo
          ? allMessages.value.find((item) => item.id === message.replyTo.id) ||
            (typeof message.replyTo === 'object'
              ? message.replyTo
              : allMessages.value.find((item) => item.id === message.replyTo))
          : null,
        reactions: message.reactions || [],
      }
      previous = rendered
      return rendered
    })
})

function isImportantMessage(message) {
  const value = message.important ?? message.is_important
  return value === true || value === 1 || value === '1' || value === 'true'
}

const reminderMessage = computed(() => {
  const target = reminderTarget.value || snoozeTarget.value
  if (!target) return null
  return {
    conversationId: channelId.value,
    conversationName: conversationLabel.value,
    conversationType: props.conversationType,
    messageId: String(target.messageId ?? target.id),
    text: target.text ?? target.content ?? '',
  }
})

function formatReminderDate(value) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function dismissDueReminder(reminder) {
  reminderStore.dismissDue(reminder.id)
}

function snoozeDueReminder(reminder) {
  snoozeTarget.value = reminder
}

function reminderModalClosed() {
  reminderTarget.value = null
  snoozeTarget.value = null
}

function reminderSaved() {
  ui.toast(
    snoozeTarget.value ? 'Reminder snoozed' : 'Reminder set',
    snoozeTarget.value
      ? 'The reminder has been scheduled again.'
      : 'You will be reminded about this message.',
    'success',
  )
}

watch(
  () => `${props.conversationType}:${props.conversationId}`,
  () => {
    dmVisibleCount.value = 20
    editingId.value = null
    replyTo.value = null
    openMenuId.value = null
    deleteTarget.value = null
    openReactionId.value = null
    reminderTarget.value = null
    forwardTarget.value = null
    clearInterval(channelMessagesRefreshTimer)
    channelMessagesRefreshTimer = null
    if (props.conversationType === 'channel' && props.conversationId != null) {
      void messageStore.fetchChannelMessages(props.conversationId)
      channelMessagesRefreshTimer = window.setInterval(() => {
        if (!document.hidden) void messageStore.fetchChannelMessages(props.conversationId)
      }, 10_000)
    }
    loadScheduledMessages()
    nextTick(scrollMessagesToLatest)
  },
  { immediate: true },
)

watch(
  () => allMessages.value.at(-1)?.id,
  (id, previousId) => {
    if (id != null && id !== previousId) scrollMessagesToLatest()
  },
)

watch(
  () => dueReminders.value.length,
  (count, previousCount) => {
    if (count > previousCount) scrollMessagesToLatest()
  },
)

function isPinned(message) {
  return ui.pinnedMessages.some(
    (item) =>
      String(item.id) === String(message.id) &&
      String(item.conversation?.id ?? '') === String(conversationMeta.value.id) &&
      (item.conversation?.kind === 'dm' || item.conversation?.type === 'dm') ===
        (props.conversationType === 'dm'),
  )
}

function messageAuthorUserId(message) {
  if (message.mine || message.from === dms.meId) return null
  const authorId = message.from ?? message.authorId
  if (dms.usersById[authorId]) return authorId
  return dms.users.find((user) => user.name === message.author)?.id || null
}

function openMessageAuthor(message) {
  const userId = messageAuthorUserId(message)
  if (!userId || userId === dms.meId) return
  dms.startDm(userId)
  ui.activePanel = null
}

async function togglePin(message) {
  if (props.conversationType === 'dm') {
    if (!message.backendSynced) {
      ui.toast(
        'Unable to pin message',
        'This direct message is not available on the server yet.',
        'error',
      )
      return
    }
  } else if (!message.serverBacked && message.backendSynced !== true) {
    ui.toast(
      'Unable to pin message',
      'This channel message is not available on the server yet.',
      'error',
    )
    return
  }

  const pinned = isPinned(message)
  try {
    if (props.conversationType === 'dm') {
      if (pinned) await dms.unpinMessage(props.conversationId, message.id)
      else await dms.pinMessage(props.conversationId, message.id)
    } else if (pinned) {
      await unpinMessage(channelId.value, message.id)
    } else {
      await pinMessage(channelId.value, message.id)
    }
    ui.togglePinnedMessage(message, conversationMeta.value)
  } catch (error) {
    ui.toast('Unable to update pin', error.message || 'Please try again.', 'error')
  }
}

async function addMessage(payload) {
  const messagePayload = {
    ...payload,
    is_important: Boolean(payload.important),
    ...(replyTo.value ? { replyTo: { ...replyTo.value } } : {}),
  }
  const hasContent = typeof payload.content === 'string' && payload.content.trim()
  const hasAttachment = Boolean(payload.attachment)
  const canSendToChannelApi =
    !conversation.value &&
    (hasContent || hasAttachment) &&
    !payload.poll &&
    !payload.gif &&
    !payload.scheduledAt &&
    !payload.voiceNoteId &&
    !replyTo.value

  if (canSendToChannelApi) {
    const result = await messageStore.postChannelMessage(channelId.value, messagePayload)
    if (!result.success) {
      ui.toast(
        'Message not sent',
        result.error || 'The channel message could not be sent.',
        'error',
      )
      return
    }
    if (result.attachmentPersisted === false) {
      ui.toast(
        'Attachment not confirmed',
        'The message was sent, but the server did not confirm that the attachment was saved.',
        'warning',
      )
    }

    const channelMessages = messageStore.messagesFor(channelId.value)
    const responseMessageId = result.data?.id ?? result.data?.message_id ?? result.data?.messageId
    const sentMessage = responseMessageId
      ? channelMessages.find((message) => String(message.id) === String(responseMessageId))
      : [...channelMessages].reverse().find((message) => message.content === payload.content)
    if (sentMessage) {
      sentMessage.important = messagePayload.is_important
      addMockMessage({
        id: sentMessage.id,
        text: sentMessage.content,
        sender: sentMessage.author,
        conversation: conversationMeta.value,
      })
    }
    replyTo.value = null
    scrollMessagesToLatest()
    return
  }

  let sentMessage
  if (conversation.value) {
    sentMessage = dms.sendMessage(conversation.value.id, messagePayload)
    if (sentMessage && payload.voiceNoteId) {
      messageComposer.value?.clearVoiceNote(payload.voiceNoteId)
    }
  } else if (payload.voiceNoteId) {
    try {
      const saved = await sendChannelVoiceMessage(
        channelId.value,
        payload.voiceNoteId,
        payload.content,
      )
      sentMessage = messageStore.sendMessage(
        channelId.value,
        {
          ...messagePayload,
          id: saved?.id,
          createdAt: saved?.created_at ?? saved?.createdAt,
          voiceNoteId: String(payload.voiceNoteId),
          backendSynced: true,
        },
        currentUserName.value,
        conversationMeta.value.name,
      )
      messageComposer.value?.clearVoiceNote(payload.voiceNoteId)
    } catch (error) {
      console.error('Unable to send channel voice message:', error)
      messageComposer.value?.setVoiceNoteSending(false)
      ui.toast(
        'Voice message not sent',
        error.message || 'The voice message could not be sent.',
        'error',
      )
      return
    }
  } else {
    sentMessage = messageStore.sendMessage(
      channelId.value,
      messagePayload,
      currentUserName.value,
      conversationMeta.value.name,
    )
  }
  if (!sentMessage) {
    ui.toast('Message not sent', 'The conversation could not be found.', 'error')
    return
  }
  if (payload.poll) sentMessage.poll = payload.poll
  if (!conversation.value && !sentMessage.scheduled) {
    ui.addPoll(sentMessage, conversationMeta.value)
    addMockMessage({
      id: sentMessage.id,
      text: sentMessage.content,
      sender: sentMessage.author,
      conversation: conversationMeta.value,
    })
  }
  replyTo.value = null
  scrollMessagesToLatest()
}

function addScheduledMessage(message) {
  const optimisticId = `scheduled-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const optimisticMessage = normalizeScheduledMessage(
    {
      id: optimisticId,
      body: message.content,
      scheduled_at: message.scheduledAt,
      status: 'pending',
    },
    message,
  )
  appendScheduledMessage(optimisticMessage)
  scrollMessagesToLatest()

  const payload = {
    channel_id: channelId.value,
    body: message.content,
    scheduled_at: message.scheduledAt,
    timezone: message.timeZone,
    conversation_type: props.conversationType,
    ...(message.important ? { important: true } : {}),
    ...(message.attachment ? { attachment: message.attachment } : {}),
  }

  createScheduledMessage(payload)
    .then((response) => {
      const scheduledMessage = normalizeScheduledMessage(response, message)
      if (!scheduledMessage) {
        throw new Error('Scheduled message response did not contain a message.')
      }
      replaceScheduledMessage(optimisticId, scheduledMessage)
      ui.toast('Message scheduled', 'Your message was scheduled successfully.', 'success')
      scrollMessagesToLatest()
    })
    .catch((error) => {
      removeScheduledMessage(optimisticId)
      console.error('Unable to schedule message:', error)
      ui.toast(
        'Message not scheduled',
        error.message || 'The scheduled message could not be created.',
        'error',
      )
    })
}

function scheduledMessageFromResponse(response) {
  if (!response || typeof response !== 'object') return null
  return response.data || response.message || response.scheduled_message || response
}

function normalizeScheduledMessage(response, fallback = {}) {
  const source = scheduledMessageFromResponse(response)
  if (!source || typeof source !== 'object') return null
  const id = source.id ?? source.message_id
  if (id == null) return null
  const status = String(source.status ?? fallback.status ?? 'pending').toLowerCase()
  const scheduledAt = source.scheduledAt ?? source.scheduled_at ?? fallback.scheduledAt ?? ''
  const isPending = ![
    'sent',
    'delivered',
    'completed',
    'published',
    'processed',
    'success',
  ].includes(status)
  const sentAt = source.sentAt ?? source.sent_at ?? (isPending ? '' : scheduledAt)
  const createdAt = isPending
    ? (source.createdAt ?? source.created_at ?? new Date().toISOString())
    : sentAt || scheduledAt || source.createdAt || source.created_at || new Date().toISOString()
  return {
    ...source,
    id,
    content: source.content ?? source.text ?? source.body ?? fallback.content ?? '',
    author: source.author ?? currentUserName.value,
    authorId: source.authorId ?? source.author_id ?? source.user_id ?? dms.meId,
    mine: true,
    createdAt,
    scheduled: isPending,
    scheduledAt,
    timeZone: source.timeZone ?? source.timezone ?? fallback.timeZone ?? 'Asia/Karachi',
    scheduledStatus: status,
    attachments: source.attachments ?? fallback.attachments ?? [],
  }
}

function scheduledMessageLabel(message) {
  const timestamp = Date.parse(message.scheduledAt || '')
  if (!Number.isFinite(timestamp)) return message.scheduledAt
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function scheduledTimestamp(message) {
  const scheduledAt = String(message.scheduledAt ?? message.scheduled_at ?? '').trim()
  if (!scheduledAt) return NaN
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(scheduledAt)) return Date.parse(scheduledAt)

  const parts = scheduledAt.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
  )
  if (!parts) return Date.parse(scheduledAt)

  const [, year, month, day, hour, minute, second = '0', milliseconds = '0'] = parts
  const naiveTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(milliseconds.padEnd(3, '0')),
  )
  const timeZone = message.timeZone ?? message.timezone
  if (!timeZone) return naiveTimestamp

  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(naiveTimestamp))
    const values = Object.fromEntries(
      formatted
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, Number(value)]),
    )
    const timezoneTimestamp = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
      Number(milliseconds.padEnd(3, '0')),
    )
    return naiveTimestamp - (timezoneTimestamp - naiveTimestamp)
  } catch {
    return naiveTimestamp
  }
}

function scheduledMessageFingerprint(message) {
  const content = String(message.content ?? message.text ?? message.body ?? '').trim()
  const scheduledAt = String(message.scheduledAt ?? message.scheduled_at ?? '').trim()
  const timestamp = scheduledTimestamp(message)
  return `${content}\u0000${Number.isFinite(timestamp) ? timestamp : scheduledAt}`
}

function isOptimisticScheduledMessage(message) {
  return String(message?.id ?? '').startsWith('scheduled-')
}

function isCompletedScheduledMessage(message) {
  return ['sent', 'delivered', 'completed', 'published', 'processed', 'success'].includes(
    String(message?.scheduledStatus ?? message?.status ?? '').toLowerCase(),
  )
}

function isScheduledMessageDelivered(message) {
  if (isCompletedScheduledMessage(message)) return true
  const scheduledAt = scheduledTimestamp(message)
  return Number.isFinite(scheduledAt) && scheduledAt <= pollClock.value
}

function mergeScheduledMessages(existing, incoming) {
  if (!existing) return incoming
  if (!incoming) return existing
  if (isCompletedScheduledMessage(existing) && !isCompletedScheduledMessage(incoming)) {
    return { ...incoming, ...existing }
  }
  if (!isOptimisticScheduledMessage(existing) && isOptimisticScheduledMessage(incoming)) {
    return { ...incoming, ...existing }
  }
  return { ...existing, ...incoming }
}

function appendScheduledMessage(message) {
  let messages
  if (conversation.value) {
    messages = conversation.value.messages
  } else {
    const key = String(channelId.value)
    if (!messageStore.messagesByChannel[key]) {
      messageStore.messagesByChannel[key] = []
    }
    messages = messageStore.messagesByChannel[key]
  }
  const fingerprint = scheduledMessageFingerprint(message)
  const existingIndex = messages.findIndex(
    (item) =>
      String(item.id) === String(message.id) || scheduledMessageFingerprint(item) === fingerprint,
  )
  if (existingIndex >= 0) {
    messages.splice(existingIndex, 1, mergeScheduledMessages(messages[existingIndex], message))
    persistLocalScheduledMessage(message)
    return
  }
  messages.push(message)
  persistLocalScheduledMessage(message)
}

function replaceScheduledMessage(previousId, message) {
  const messages = conversation.value
    ? conversation.value.messages
    : messageStore.messagesByChannel[String(channelId.value)] || []
  const index = messages.findIndex((item) => String(item.id) === String(previousId))
  const duplicateIndex = messages.findIndex(
    (item, itemIndex) =>
      itemIndex !== index &&
      scheduledMessageFingerprint(item) === scheduledMessageFingerprint(message),
  )
  if (duplicateIndex >= 0) {
    const targetIndex = isOptimisticScheduledMessage(messages[duplicateIndex])
      ? index
      : duplicateIndex
    const staleIndex = targetIndex === duplicateIndex ? index : duplicateIndex
    if (staleIndex >= 0) {
      messages.splice(staleIndex, 1)
    }
    const replacementIndex = targetIndex > staleIndex ? targetIndex - 1 : targetIndex
    if (replacementIndex >= 0 && replacementIndex < messages.length) {
      messages.splice(
        replacementIndex,
        1,
        mergeScheduledMessages(messages[replacementIndex], message),
      )
      persistLocalScheduledMessage(message)
      return
    }
  }
  if (index >= 0) {
    messages.splice(index, 1, mergeScheduledMessages(messages[index], message))
  } else {
    appendScheduledMessage(message)
    return
  }
  persistLocalScheduledMessage(message)
}

function removeScheduledMessage(messageId) {
  const messages = conversation.value
    ? conversation.value.messages
    : messageStore.messagesByChannel[String(channelId.value)] || []
  const index = messages.findIndex((item) => String(item.id) === String(messageId))
  if (index >= 0) messages.splice(index, 1)
  removeLocalScheduledMessage(messageId)
}

function readLocalScheduledMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_SCHEDULED_MESSAGES_KEY) || '{}')
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch (error) {
    console.error('Unable to load local scheduled messages:', error)
    return {}
  }
}

function persistLocalScheduledMessage(message) {
  try {
    const saved = readLocalScheduledMessages()
    const key = String(channelId.value)
    const messages = Array.isArray(saved[key]) ? saved[key] : []
    const index = messages.findIndex(
      (item) =>
        String(item.id) === String(message.id) ||
        scheduledMessageFingerprint(item) === scheduledMessageFingerprint(message),
    )
    if (index >= 0) {
      messages.splice(index, 1, mergeScheduledMessages(messages[index], message))
    } else messages.push(message)
    saved[key] = messages
    localStorage.setItem(LOCAL_SCHEDULED_MESSAGES_KEY, JSON.stringify(saved))
  } catch (error) {
    console.error('Unable to save local scheduled message:', error)
  }
}

function removeLocalScheduledMessage(messageId) {
  try {
    const saved = readLocalScheduledMessages()
    const key = String(channelId.value)
    if (!Array.isArray(saved[key])) return
    saved[key] = saved[key].filter((item) => String(item.id) !== String(messageId))
    localStorage.setItem(LOCAL_SCHEDULED_MESSAGES_KEY, JSON.stringify(saved))
  } catch (error) {
    console.error('Unable to remove local scheduled message:', error)
  }
}

function loadLocalScheduledMessages() {
  const saved = readLocalScheduledMessages()
  const direct = saved[String(channelId.value)]
  const values = Array.isArray(direct) ? direct : []
  values
    .map((item) => normalizeScheduledMessage(item))
    .filter(Boolean)
    .forEach(appendScheduledMessage)
}

function loadScheduledMessages() {
  const requestedConversationId = channelId.value
  loadLocalScheduledMessages()
  getScheduledMessages()
    .then((response) => {
      const values = Array.isArray(response)
        ? response
        : response?.data || response?.messages || response?.scheduled_messages || []
      values
        .map((item) => normalizeScheduledMessage(item))
        .filter(
          (item) =>
            item &&
            String(
              item.channel_id ??
                item.conversation_id ??
                item.conversationId ??
                requestedConversationId,
            ) === requestedConversationId,
        )
        .forEach(appendScheduledMessage)
    })
    .catch((error) => {
      console.error('Unable to load scheduled messages:', error)
    })
}

async function loadOlder() {
  if (conversation.value) {
    dmVisibleCount.value += 20
    return
  }
  const container = messagesContainer.value
  const previousHeight = container?.scrollHeight || 0
  const previousTop = container?.scrollTop || 0
  await messageStore.loadOlder(channelId.value)
  await nextTick()
  if (container) container.scrollTop = previousTop + container.scrollHeight - previousHeight
}

function startEdit(message) {
  editingId.value = message.id
  editDraft.value = message.content
  openMenuId.value = null
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = ''
}

async function saveEdit(message) {
  if (!editDraft.value.trim()) {
    ui.toast('Message not updated', 'A message cannot be empty.', 'error')
    return
  }
  if (conversation.value) {
    if (!dms.editMessage(conversation.value.id, message.id, editDraft.value)) {
      ui.toast('Message not updated', 'Only your unscheduled messages can be edited.', 'error')
      return
    }
  } else if (message.serverBacked) {
    const result = await messageStore.updateServerMessage(
      channelId.value,
      message.id,
      editDraft.value,
    )
    if (!result.success) {
      ui.toast(
        'Message not updated',
        result.error || 'The channel message could not be updated.',
        'error',
      )
      return
    }
    updateMockMessage(message.id, editDraft.value.trim())
  } else if (!messageStore.editMessage(channelId.value, message.id, editDraft.value)) {
    ui.toast('Message not updated', 'Only your unscheduled messages can be edited.', 'error')
    return
  }
  cancelEdit()
}

function deleteMessage(message) {
  openMenuId.value = null
  deleteTarget.value = message
  scheduleDelete.value = false
  scheduledDeleteAt.value = ''
}

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function confirmMessageDeletion() {
  const message = deleteTarget.value
  if (!message) return

  let deleteAt = null
  if (scheduleDelete.value) {
    const date = new Date(scheduledDeleteAt.value)
    if (
      !scheduledDeleteAt.value ||
      !Number.isFinite(date.getTime()) ||
      date.getTime() <= Date.now()
    ) {
      ui.toast('Message not scheduled for deletion', 'Choose a future date and time.', 'error')
      return
    }
    deleteAt = date.toISOString()
  }

  let deleted
  if (conversation.value) {
    deleted = dms.deleteMessage(conversation.value.id, message.id, deleteAt)
  } else if (message.serverBacked && !deleteAt) {
    const result = messageStore.deleteServerMessage(channelId.value, message.id)
    if (result?.success === false) {
      ui.toast(
        'Message not deleted',
        result.error || 'The channel message could not be deleted.',
        'error',
      )
      return
    }
    deleted = true
    void Promise.resolve(result).then((apiResult) => {
      if (!apiResult.success) {
        ui.toast(
          'Message not deleted',
          apiResult.error || 'The channel message could not be deleted.',
          'error',
        )
      }
    })
  } else {
    deleted = messageStore.deleteMessage(channelId.value, message.id, deleteAt)
  }
  if (!deleted) {
    ui.toast('Message not deleted', 'Only your unscheduled messages can be deleted.', 'error')
    return
  }
  if (!conversation.value) removeMockMessage(message.id)
  if (isPinned(message)) ui.togglePinnedMessage(message, conversationMeta.value)
  deleteTarget.value = null
}

function closeDeleteDialog() {
  deleteTarget.value = null
}

async function copyMessage(message) {
  openMenuId.value = null
  try {
    let copied = false
    try {
      if (typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(message.content)
        copied = true
      }
    } catch {
      // Fall back to the browser's copy command when clipboard permissions are unavailable.
    }

    if (!copied) {
      const input = document.createElement('textarea')
      input.value = message.content
      input.setAttribute('readonly', '')
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.append(input)
      input.select()
      try {
        if (typeof document.execCommand !== 'function' || !document.execCommand('copy')) {
          throw new Error('Clipboard access is unavailable.')
        }
      } finally {
        input.remove()
      }
    }
    ui.toast('Copied', 'Message copied to clipboard.', 'success')
  } catch (error) {
    ui.toast(
      'Unable to copy message',
      error?.message || 'Clipboard access is unavailable.',
      'error',
    )
  }
}

function toggleReaction(message, emoji) {
  const updated = conversation.value
    ? dms.toggleReaction(conversation.value.id, message.id, emoji)
    : messageStore.toggleReaction(channelId.value, message.id, emoji)
  if (!updated) ui.toast('Reaction not added', 'Please try again.', 'error')
  openReactionId.value = null
}

function beginReply(message) {
  replyTo.value = { id: message.id, author: message.author, content: message.content }
  openMenuId.value = null
  nextTick(() => document.querySelector('[contenteditable="true"]')?.focus())
}

function setReminder(message) {
  reminderTarget.value = message
  openMenuId.value = null
}

async function setOneHourReminder(message) {
  try {
    await reminderStore.add({
      conversationId: channelId.value,
      conversationName: conversationLabel.value,
      conversationType: 'channel',
      messageId: String(message.messageId ?? message.id),
      text: message.text ?? message.content ?? '',
      title: '',
      remindAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    ui.toast('Reminder set', 'You will be reminded about this message in one hour.', 'success')
  } catch (error) {
    ui.toast('Unable to set reminder', error?.message || 'Please try again.', 'error')
  }
}

function handleMessageClick(event, message) {
  if (
    userStore.state.preferences.leftClick !== 'menu' ||
    event.detail > 1 ||
    event.target.closest('button, a, input')
  ) {
    return
  }

  clearTimeout(messageClickTimer)
  messageClickTimer = setTimeout(() => {
    openMenuId.value = message.id
    messageClickTimer = null
  }, 250)
}

function handleMessageDoubleClick(event, message) {
  clearTimeout(messageClickTimer)
  messageClickTimer = null
  if (
    userStore.state.preferences.doubleClick === 'reminder' &&
    !message.deleted &&
    !event.target.closest('button, a, input')
  ) {
    event.preventDefault()
    if (props.conversationType === 'channel') {
      void setOneHourReminder(message)
    } else {
      setReminder(message)
    }
  }
}

function openForwardDialog(message) {
  forwardTarget.value = message
  openMenuId.value = null
  forwardDestinationId.value =
    forwardDestinations.value.find((destination) => destination.id !== channelId.value)?.id || ''
}

async function forwardMessage() {
  const destination = forwardDestinations.value.find(
    (item) => item.id === forwardDestinationId.value,
  )
  if (!destination || !forwardTarget.value) {
    ui.toast('Unable to forward message', 'Choose a destination first.', 'error')
    return
  }

  const payload = {
    content: forwardTarget.value.content,
    forwardedFrom: `${forwardTarget.value.author} in ${conversationLabel.value}`,
    ...(forwardTarget.value.attachments?.length
      ? { attachments: forwardTarget.value.attachments }
      : {}),
    ...(forwardTarget.value.gif ? { gif: forwardTarget.value.gif } : {}),
  }
  if (destination.type === 'dm') {
    const forwarded = dms.sendMessage(destination.id, payload)
    if (!forwarded) {
      ui.toast('Unable to forward message', 'The destination is no longer available.', 'error')
      return
    }
  } else {
    const result = await messageStore.postChannelMessage(destination.id, payload)
    if (!result.success) {
      ui.toast(
        'Unable to forward message',
        result.error || 'The channel message could not be sent.',
        'error',
      )
      return
    }
    const forwarded =
      result.data ??
      messageStore
        .messagesFor(destination.id)
        .find(
          (message) =>
            message.forwardedFrom === payload.forwardedFrom && message.content === payload.content,
        )
    if (forwarded) {
      addMockMessage({
        id: forwarded.id,
        text: forwarded.content,
        sender: forwarded.author || currentUserName.value,
        conversation: { id: destination.id, name: destination.name.slice(1), kind: 'public' },
      })
    }
  }
  forwardTarget.value = null
  ui.toast('Message forwarded', `Sent to ${destination.name}.`, 'success')
}

function selectReaction(message, emoji) {
  if (!emoji?.i) return
  toggleReaction(message, emoji.i)
}

function closeMessageActions() {
  openMenuId.value = null
  openReactionId.value = null
}

function closeActionsOnOutsideClick(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement
  if (!target?.closest('.composer-conversation__actions')) closeMessageActions()
}

function pollQueryParams(poll, key) {
  return poll[key] || { poll_id: poll.id }
}

function hasServerPollId(poll) {
  return poll?.id != null && !String(poll.id).startsWith('poll-')
}

function pollQuestionsFromResponse(response) {
  const questions = Array.isArray(response)
    ? response
    : Array.isArray(response?.questions)
      ? response.questions
      : Array.isArray(response?.poll_questions)
        ? response.poll_questions
        : Array.isArray(response?.result)
          ? response.result
          : []
  return questions.map((question) => ({
    ...question,
    id: question.id ?? question.question_id,
    text: question.text ?? question.question ?? '',
    type: ['open-ended', 'open_ended'].includes(question.type)
      ? 'openEnded'
      : (question.type ?? 'choice'),
    required: question.required !== false,
    multiple: question.multiple ?? question.multiple_select ?? false,
    options: question.options ?? question.choices ?? [],
  }))
}

function normalizePollResult(response, poll) {
  const result = response?.result ?? response
  if (
    !result ||
    typeof result !== 'object' ||
    (!result.totalVotes &&
      !result.total_votes &&
      !result.total &&
      !result.questions &&
      !result.results &&
      !result.responses)
  ) {
    return null
  }
  const sourceQuestions = Array.isArray(result)
    ? result
    : (result?.questions ?? result?.results ?? [])
  const questions = poll.questions.map((question, questionIndex) => {
    const source = sourceQuestions[questionIndex] || {}
    const sourceVotes = source.votes ?? source.answers ?? source.options ?? []
    return {
      votes: question.options.map((_, optionIndex) => {
        const vote = sourceVotes[optionIndex]
        return typeof vote === 'number'
          ? vote
          : Number(vote?.votes ?? vote?.count ?? vote?.total ?? vote ?? 0)
      }),
    }
  })
  return {
    totalVotes: Number(
      result?.totalVotes ?? result?.total_votes ?? result?.total ?? result?.pagination?.total ?? 0,
    ),
    questions,
    responses: result?.responses ?? questions.map(() => []),
  }
}

async function createPollInChannel(targetChannelId, pollDraft, existingMessage = null) {
  const {
    title,
    description,
    questions,
    audience,
    resultsVisibility,
    startNow: draftStartNow,
    scheduleStartEnabled: draftScheduleStartEnabled,
    scheduleCloseEnabled: draftScheduleCloseEnabled,
    scheduleStart,
    scheduleClose,
  } = pollDraft
  const scheduleStartEnabled = draftScheduleStartEnabled ?? Boolean(scheduleStart)
  const scheduleCloseEnabled = draftScheduleCloseEnabled ?? Boolean(scheduleClose)
  const startNow = draftStartNow ?? !scheduleStartEnabled
  const apiQuestions = questions.map((question) => ({
    text: question.text,
    type: question.type === 'openEnded' ? 'open_ended' : question.type,
    required: question.required,
    // The backend currently validates two options for open-ended questions, then discards them.
    options:
      question.type === 'openEnded' ? ['__open_ended__', '__open_ended__'] : question.options,
    ...(question.type === 'rating'
      ? { rating_scale: Number(question.ratingType.split('-')[1]) }
      : {}),
    ...(question.type === 'choice' ? { multiple_select: Boolean(question.multiple) } : {}),
  }))
  const payload = {
    title,
    description,
    questions: apiQuestions,
    audience_responses: audience,
    results_visibility:
      {
        private: 'owner_only',
        'after-close': 'after_close',
        realtime: 'real_time',
      }[resultsVisibility] ?? resultsVisibility,
    start_now: startNow,
    schedule_start: scheduleStartEnabled,
    schedule_close: scheduleCloseEnabled,
    ...(scheduleStartEnabled ? { start_at: scheduleStart } : {}),
    ...(scheduleCloseEnabled ? { close_at: scheduleClose } : {}),
  }
  try {
    const response = await pollApi.createPoll(targetChannelId, payload)
    const responsePoll =
      response?.poll ??
      response?.poll_data ??
      response?.data?.poll ??
      response?.data?.data?.poll ??
      response?.data ??
      response ??
      {}
    const serverPollId = responsePoll.id ?? responsePoll.poll_id
    if (serverPollId == null || serverPollId === '') {
      throw new Error('The server did not return a poll ID.')
    }
    const poll = {
      ...pollDraft,
      ...(typeof responsePoll === 'object' && !Array.isArray(responsePoll) ? responsePoll : {}),
      id: serverPollId,
      creatorId: responsePoll.creatorId ?? responsePoll.creator_id ?? dms.meId,
      scheduleStart:
        responsePoll.scheduleStart !== undefined
          ? responsePoll.scheduleStart
          : responsePoll.start_at !== undefined
            ? responsePoll.start_at
            : (pollDraft.scheduleStart ?? ''),
      scheduleClose:
        responsePoll.scheduleClose !== undefined
          ? responsePoll.scheduleClose
          : responsePoll.close_at !== undefined
            ? responsePoll.close_at
            : (pollDraft.scheduleClose ?? ''),
      audience: responsePoll.audience ?? responsePoll.audience_responses ?? pollDraft.audience,
      resultsVisibility:
        responsePoll.resultsVisibility ??
        responsePoll.results_visibility ??
        pollDraft.resultsVisibility,
      alreadyVoted:
        responsePoll.alreadyVoted ??
        responsePoll.already_voted ??
        responsePoll.user_has_voted ??
        false,
      questions: pollQuestionsFromResponse(responsePoll).length
        ? pollQuestionsFromResponse(responsePoll)
        : pollDraft.questions,
    }
    const message = existingMessage || {
      id: `poll-message-${poll.id}`,
      content: `Poll: ${poll.title}`,
      author: currentUserName.value,
      authorId: dms.meId,
      mine: true,
      backendSynced: true,
      createdAt: new Date().toISOString(),
      poll,
    }
    if (existingMessage) {
      existingMessage.poll = poll
      existingMessage.backendSynced = true
    } else {
      const targetConversation =
        conversation.value && String(conversation.value.id) === String(targetChannelId)
          ? conversation.value
          : null
      if (targetConversation) {
        targetConversation.messages.push(message)
      } else {
        const key = String(targetChannelId)
        if (!messageStore.messagesByChannel[key]) messageStore.messagesByChannel[key] = []
        messageStore.messagesByChannel[key].push(message)
      }
      ui.addPoll(message, conversationMeta.value)
      if (!targetConversation) {
        addMockMessage({
          id: message.id,
          text: message.content,
          sender: message.author,
          conversation: conversationMeta.value,
        })
      }
    }
    await scrollMessagesToLatest()
    return poll
  } catch (error) {
    ui.toast('Poll not created', error.message || 'The poll could not be created.', 'error')
    return null
  }
}

function publishLegacyPoll(message) {
  if (!message.mine || pollApi.loading.value || hasServerPollId(message.poll)) return
  const storedMessage = allMessages.value.find((item) => String(item.id) === String(message.id))
  if (!storedMessage) return
  void createPollInChannel(channelId.value, storedMessage.poll, storedMessage)
}

function canClosePoll(message) {
  const poll = message.poll
  if (!hasServerPollId(poll)) return false
  const creatorId = poll.creatorId ?? poll.creator_id ?? poll.createdBy ?? poll.created_by
  const authUserId = getAuthUser()?.id ?? getAuthUser()?.userId
  return Boolean(
    message.mine ||
    (creatorId != null &&
      [dms.meId, authUserId].some((id) => id != null && String(id) === String(creatorId))) ||
    poll.canClose === true ||
    poll.can_close === true ||
    poll.permissions?.close === true,
  )
}

async function participateInPoll(pollId) {
  if (pollApi.loading.value || !hasServerPollId({ id: pollId })) return
  const message = renderedMessages.value.find((item) => item.poll?.id === pollId)
  if (!message?.poll || !isPollActive(message.poll)) return
  activePoll.value = message.poll
  activePollMode.value = 'respond'
  pollResponses.value = {}
  try {
    const response = await pollApi.getPollQuestions(
      pollQueryParams(message.poll, 'questionsQueryParams'),
    )
    const questions = pollQuestionsFromResponse(response)
    if (questions.length) {
      message.poll.questions = questions
      activePoll.value = { ...message.poll, questions }
    }
  } catch (error) {
    ui.toast('Unable to load poll', error.message || 'Poll questions could not be loaded.', 'error')
  }
}

async function closePoll(pollId) {
  if (pollApi.loading.value || !hasServerPollId({ id: pollId })) return
  const message = renderedMessages.value.find((item) => item.poll?.id === pollId)
  if (!message?.poll || !canClosePoll(message)) return
  try {
    await pollApi.closePoll(pollId)
    closedPolls.value = new Set([...closedPolls.value, pollId])
    message.poll.closed = true
  } catch (error) {
    ui.toast('Unable to close poll', error.message || 'The poll could not be closed.', 'error')
  }
}

function pollStartTime(poll) {
  return poll.scheduleStart ? Date.parse(poll.scheduleStart) : NaN
}

function pollCloseTime(poll) {
  return poll.scheduleClose ? Date.parse(poll.scheduleClose) : NaN
}

function isPollActive(poll) {
  const now = pollClock.value
  const startsAt = pollStartTime(poll)
  const closesAt = pollCloseTime(poll)
  return (
    !isPollClosed(poll) &&
    (!Number.isFinite(startsAt) || startsAt <= now) &&
    (!Number.isFinite(closesAt) || closesAt > now)
  )
}

function isPollClosed(poll) {
  return (
    closedPolls.value.has(poll.id) ||
    poll.closed === true ||
    poll.is_closed === true ||
    ['closed', 'complete', 'completed'].includes(String(poll.status || '').toLowerCase()) ||
    (Number.isFinite(pollCloseTime(poll)) && pollCloseTime(poll) <= pollClock.value)
  )
}

function isPollScheduled(poll) {
  const startsAt = pollStartTime(poll)
  return (
    (Number.isFinite(startsAt) && startsAt > pollClock.value) ||
    (String(poll.status || '').toLowerCase() === 'scheduled' && !Number.isFinite(startsAt))
  )
}

function exportPollResults(pollId) {
  const message = renderedMessages.value.find((item) => item.poll?.id === pollId)
  if (!message?.poll) return
  const rows = ['Question,Option,Votes,Percentage']
  message.poll.questions.forEach((question, questionIndex) => {
    question.options.forEach((option, optionIndex) => {
      const result = pollResultFor(pollId, questionIndex, optionIndex)
      rows.push(
        [question.text, option, result.votes, `${result.percentage}%`]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
    })
  })
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${message.poll.title || 'poll'}-results.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function viewPollResults(pollId) {
  if (pollApi.loading.value || !hasServerPollId({ id: pollId })) return
  const message = renderedMessages.value.find((item) => item.poll?.id === pollId)
  if (!message?.poll) return
  activePoll.value = message.poll
  activePollMode.value = 'results'
  pollResponses.value = {}
  try {
    const response = await pollApi.getPollResult(
      pollQueryParams(message.poll, 'resultsQueryParams'),
    )
    const result = normalizePollResult(response, message.poll)
    if (result) pollResults.value = { ...pollResults.value, [pollId]: result }
  } catch (error) {
    ui.toast(
      'Unable to load poll results',
      error.message || 'Poll results could not be loaded.',
      'error',
    )
  }
}

function closePollResponse() {
  activePoll.value = null
  activePollMode.value = 'respond'
  pollResponses.value = {}
}

function pollResultFor(pollId, questionIndex, optionIndex) {
  const result = pollResults.value[pollId]?.questions?.[questionIndex]
  const votes = result?.votes?.[optionIndex] || 0
  const totalVotes = pollResults.value[pollId]?.totalVotes || 0
  return {
    votes,
    percentage: totalVotes ? Math.round((votes / totalVotes) * 100) : 0,
  }
}

function pollResponseKey(questionIndex, optionIndex = '') {
  return `${questionIndex}-${optionIndex}`
}

function togglePollResponse(question, questionIndex, optionIndex) {
  if (question.multiple) {
    const key = pollResponseKey(questionIndex, optionIndex)
    pollResponses.value[key] = !pollResponses.value[key]
    return
  }
  pollResponses.value = {
    ...pollResponses.value,
    [questionIndex]: optionIndex,
  }
}

async function submitPollResponse() {
  if (!activePoll.value || pollApi.loading.value || isPollClosed(activePoll.value)) return
  const poll = activePoll.value
  const missingRequiredResponse = poll.questions.some(
    (question, questionIndex) =>
      question.required &&
      question.type === 'openEnded' &&
      !String(pollResponses.value[questionIndex] || '').trim(),
  )
  if (missingRequiredResponse) return
  if (poll.questions.some((question) => question.id == null && question.question_id == null)) {
    ui.toast(
      'Vote not submitted',
      'Poll questions could not be loaded. Reopen the poll and try again.',
      'error',
    )
    return
  }
  const answers = Object.fromEntries(
    poll.questions
      .map((question, questionIndex) => {
        let answer
        if (question.type === 'openEnded') {
          answer = String(pollResponses.value[questionIndex] || '').trim()
        } else if (question.multiple) {
          answer = question.options.filter(
            (_, optionIndex) => pollResponses.value[pollResponseKey(questionIndex, optionIndex)],
          )
        } else {
          const optionIndex = pollResponses.value[questionIndex]
          answer = typeof optionIndex === 'number' ? question.options[optionIndex] : ''
        }
        return [question.id ?? question.question_id, answer]
      })
      .filter(([, answer]) => (Array.isArray(answer) ? answer.length > 0 : Boolean(answer))),
  )
  if (!Object.keys(answers).length) return
  try {
    await pollApi.submitPollAnswer({ channel_id: channelId.value, poll_id: poll.id, answers })
  } catch (error) {
    ui.toast(
      'Vote not submitted',
      error.message || 'Your response could not be submitted.',
      'error',
    )
    return
  }
  const existingResult = pollResults.value[poll.id] || {
    totalVotes: 0,
    questions: poll.questions.map((question) => ({
      votes: Array(question.options.length).fill(0),
    })),
    responses: poll.questions.map(() => []),
  }
  if (!existingResult.responses) {
    existingResult.responses = poll.questions.map(() => [])
  }
  existingResult.totalVotes += 1
  poll.questions.forEach((question, questionIndex) => {
    if (question.type === 'openEnded') {
      const response = String(pollResponses.value[questionIndex] || '').trim()
      if (response) existingResult.responses[questionIndex].push(response)
      return
    }
    if (question.multiple) {
      question.options.forEach((_, optionIndex) => {
        if (pollResponses.value[pollResponseKey(questionIndex, optionIndex)]) {
          existingResult.questions[questionIndex].votes[optionIndex] += 1
        }
      })
      return
    }
    const optionIndex = pollResponses.value[questionIndex]
    if (typeof optionIndex === 'number') {
      existingResult.questions[questionIndex].votes[optionIndex] += 1
    }
  })
  pollResults.value = { ...pollResults.value, [poll.id]: existingResult }
  participatedPolls.value = new Set([...participatedPolls.value, activePoll.value.id])
  closePollResponse()
  try {
    const response = await pollApi.getPollResult(pollQueryParams(poll, 'resultsQueryParams'))
    const result = normalizePollResult(response, poll)
    if (result) pollResults.value = { ...pollResults.value, [poll.id]: result }
  } catch (error) {
    ui.toast(
      'Vote submitted',
      error.message || 'Your vote was saved, but results are unavailable.',
      'error',
    )
  }
}

async function scrollMessagesToLatest() {
  await nextTick()
  const container = messagesContainer.value
  if (container) container.scrollTop = container.scrollHeight
}

onMounted(() => {
  document.addEventListener('pointerdown', closeActionsOnOutsideClick)
  pollClockTimer = window.setInterval(() => {
    pollClock.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeActionsOnOutsideClick)
  clearTimeout(messageClickTimer)
  clearInterval(channelMessagesRefreshTimer)
  if (pollClockTimer) window.clearInterval(pollClockTimer)
})
</script>

<template>
  <section class="composer-conversation" @keydown.esc="closeMessageActions">
    <div ref="messagesContainer" class="composer-conversation__messages" aria-live="polite">
      <button
        v-if="hasOlderMessages"
        type="button"
        class="composer-conversation__load-older"
        :disabled="loadingOlderMessages"
        @click="loadOlder"
      >
        {{ loadingOlderMessages ? 'Loading older messages...' : 'Load older messages' }}
      </button>
      <p
        v-if="props.conversationType === 'channel' && messageStore.loadingByChannel[channelId]"
        class="composer-conversation__status"
        role="status"
      >
        Loading channel messages...
      </p>
      <p
        v-else-if="props.conversationType === 'channel' && messageStore.errorsByChannel[channelId]"
        class="composer-conversation__status composer-conversation__status--error"
        role="alert"
      >
        {{ messageStore.errorsByChannel[channelId] }}
        <button type="button" @click="messageStore.fetchChannelMessages(channelId)">Retry</button>
      </p>
      <p v-else-if="messagesLoading" class="composer-conversation__status" role="status">
        Loading messages...
      </p>
      <p
        v-else-if="messagesError"
        class="composer-conversation__status composer-conversation__status--error"
        role="alert"
      >
        {{ messagesError }}
        <button type="button" @click="retryConversationMessages">Retry</button>
      </p>
      <p
        v-else-if="
          conversation &&
          !renderedMessages.length &&
          !dueReminders.length &&
          !deletedReminders.length
        "
        class="composer-conversation__status"
      >
        No messages yet.
      </p>
      <template v-for="message in renderedMessages" :key="message.id">
        <div v-if="message.showDate" class="composer-conversation__date">
          <span>{{ message.dateHeading }}</span>
        </div>

        <article
          class="composer-conversation__message"
          :class="{ 'composer-conversation__message--grouped': message.grouped }"
          :data-message-id="message.id"
        >
          <span v-if="!message.grouped" class="composer-conversation__avatar" aria-hidden="true">
            {{
              message.author
                ?.split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
            }}
          </span>
          <span v-else class="composer-conversation__avatar-spacer" aria-hidden="true"></span>

          <div class="composer-conversation__message-content">
            <p
              v-for="reminder in remindersForMessage(message)"
              :key="`message-reminder-${reminder.id}`"
              class="composer-conversation__message-reminder"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Remind you at {{ formatReminderDate(reminder.remindAt) }}
            </p>
            <header
              v-if="!message.grouped || isPinned(message)"
              class="composer-conversation__message-heading"
            >
              <button
                v-if="messageAuthorUserId(message)"
                type="button"
                class="composer-conversation__author"
                :aria-label="`Open direct message with ${message.author}`"
                @click="openMessageAuthor(message)"
              >
                {{ message.author }}
              </button>
              <strong v-else>{{ message.author }}</strong>
              <time :datetime="message.createdAt">{{ message.time }}</time>
              <span v-if="isPinned(message)" class="composer-conversation__pinned">PINNED</span>
            </header>

            <div
              class="composer-conversation__message-bubble"
              :class="{ 'composer-conversation__message-bubble--deleted': message.deleted }"
              :data-poll-title="message.content?.match(/^Poll:\s*(.+)$/m)?.[1]?.trim()"
              @click="handleMessageClick($event, message)"
              @dblclick="handleMessageDoubleClick($event, message)"
            >
              <template v-if="!message.deleted">
                <span v-if="message.forwardedFrom" class="composer-conversation__forwarded">
                  (forwarded)
                </span>
                <span v-if="message.important" class="composer-conversation__important">
                  IMPORTANT!
                </span>
                <PollMessage
                  v-if="message.poll"
                  :poll="message.poll"
                  :backend-available="hasServerPollId(message.poll)"
                  :can-publish="message.mine"
                  :result="pollResults[message.poll.id]"
                  :closed="isPollClosed(message.poll)"
                  :scheduled="isPollScheduled(message.poll)"
                  :already-voted="
                    participatedPolls.has(message.poll.id) ||
                    Boolean(
                      message.poll.alreadyVoted ??
                      message.poll.already_voted ??
                      message.poll.user_has_voted,
                    )
                  "
                  :can-close="canClosePoll(message)"
                  :loading="pollApi.loading.value"
                  @participate="participateInPoll(message.poll.id)"
                  @results="viewPollResults(message.poll.id)"
                  @close="closePoll(message.poll.id)"
                  @export="exportPollResults(message.poll.id)"
                  @publish="publishLegacyPoll(message)"
                />

                <div v-if="message.reply" class="composer-conversation__reply-quote">
                  <strong>{{ message.reply.author || 'Message' }}</strong>
                  <span>{{
                    message.reply.deleted
                      ? '(message deleted)'
                      : (message.reply.content ?? message.reply.text)
                  }}</span>
                </div>

                <form
                  v-if="editingId === message.id"
                  class="composer-conversation__edit-form"
                  @submit.prevent="saveEdit(message)"
                >
                  <textarea v-model="editDraft" aria-label="Edit message" rows="2"></textarea>
                  <div>
                    <button type="button" @click="cancelEdit">Cancel</button>
                    <button type="submit">Save</button>
                  </div>
                </form>

                <template v-else>
                  <p v-if="message.content" v-html="message.formattedContent"></p>
                  <img
                    v-if="message.gif"
                    class="composer-conversation__gif"
                    :src="message.gif.url"
                    :alt="message.gif.title"
                  />
                </template>

                <a
                  v-if="message.preview && editingId !== message.id"
                  class="composer-conversation__link-preview"
                  :href="message.preview.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="composer-conversation__link-preview-host">{{
                    message.preview.hostname
                  }}</span>
                  <strong>{{ message.preview.title }}</strong>
                  <span>{{ message.preview.description }}</span>
                  <span class="composer-conversation__link-preview-url">{{
                    message.preview.href
                  }}</span>
                </a>

                <span
                  v-if="message.scheduled && !isScheduledMessageDelivered(message)"
                  class="composer-conversation__scheduled"
                  :title="`Scheduled to send ${scheduledMessageLabel(message)} (${message.timeZone || 'local time'})`"
                >
                  Scheduled for {{ scheduledMessageLabel(message) }} ({{
                    message.timeZone || 'local time'
                  }})
                </span>
                <span v-if="message.deleteScheduledAt" class="composer-conversation__scheduled">
                  Scheduled to delete {{ new Date(message.deleteScheduledAt).toLocaleString() }}
                </span>

                <VoiceNotePlayer
                  v-if="message.voiceNoteId || message.voice_note_id || message.voice_note?.id"
                  :voice-note-id="
                    message.voiceNoteId || message.voice_note_id || message.voice_note.id
                  "
                />

                <ul
                  v-if="message.attachments?.length"
                  class="composer-conversation__attachment-list"
                >
                  <li
                    v-for="(file, fileIndex) in message.attachments"
                    :key="file.id || `${file.name}-${file.size}-${fileIndex}`"
                    class="composer-conversation__attachment"
                  >
                    <MessageAttachment :attachment="file" />
                  </li>
                </ul>

                <div v-if="message.reactions.length" class="composer-conversation__reactions">
                  <button
                    v-for="reaction in message.reactions"
                    :key="reaction.emoji"
                    type="button"
                    :aria-label="`${reaction.emoji} reaction, ${reaction.users.length} people`"
                    :aria-pressed="reaction.users.includes(dms.meId || 'current-user')"
                    @click="toggleReaction(message, reaction.emoji)"
                  >
                    {{ reaction.emoji }} {{ reaction.users.length }}
                  </button>
                </div>
              </template>
              <p v-else class="composer-conversation__deleted-message">(message deleted)</p>
              <span
                v-if="message.editedAt && !message.deleted"
                class="composer-conversation__edited"
                >(edited)</span
              >
            </div>

            <div
              v-if="!message.deleted"
              class="composer-conversation__actions"
              role="group"
              :aria-label="`Actions for ${message.author}'s message`"
            >
              <div
                v-if="openReactionId === message.id"
                class="composer-conversation__reaction-picker"
              >
                <EmojiPicker
                  :native="false"
                  :hide-search="false"
                  :hide-group-names="true"
                  :disable-skin-tones="true"
                  :disable-sticky-group-names="true"
                  :display-recent="true"
                  :static-texts="{ placeholder: 'Search emoji' }"
                  @select="selectReaction(message, $event)"
                />
              </div>
              <div class="composer-conversation__action-toolbar">
                <button
                  type="button"
                  aria-label="Add reaction"
                  title="Add reaction"
                  @click="openReactionId = openReactionId === message.id ? null : message.id"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <path d="M9 9h.01M15 9h.01" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Copy message"
                  title="Copy message"
                  @click="copyMessage(message)"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="8" y="8" width="13" height="13" rx="2" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
                <button
                  type="button"
                  :aria-label="isPinned(message) ? 'Unpin message' : 'Pin message'"
                  :title="isPinned(message) ? 'Unpin message' : 'Pin message'"
                  @click="togglePin(message)"
                >
                  <span>
                    <img
                      class="composer-conversation__pin-icon"
                      :src="isPinned(message) ? unpinChatIcon : pinChatIcon"
                      alt=""
                      aria-hidden="true"
                    />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="More message actions"
                  title="More actions"
                  :aria-expanded="openMenuId === message.id"
                  @click="openMenuId = openMenuId === message.id ? null : message.id"
                >
                  ⋯
                </button>
              </div>
              <div v-if="openMenuId === message.id" class="composer-conversation__menu">
                <button type="button" @click="copyMessage(message)">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="8" y="8" width="13" height="13" rx="2" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                  </svg>
                  <span>Copy</span>
                  <span class="composer-conversation__shortcuts"><kbd>Ctrl</kbd><kbd>G</kbd></span>
                </button>
                <button
                  v-if="message.mine && !message.scheduled && !message.deleteScheduledAt"
                  type="button"
                  title="Edit message"
                  @click="startEdit(message)"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m16 5 3 3M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                  </svg>
                  <span>Edit</span>
                  <span class="composer-conversation__shortcuts"><kbd>Ctrl</kbd><kbd>E</kbd></span>
                </button>
                <button
                  v-if="message.mine && !message.scheduled && !message.deleteScheduledAt"
                  type="button"
                  class="composer-conversation__delete-action"
                  title="Delete message"
                  @click="deleteMessage(message)"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                  </svg>
                  <span>Delete</span>
                  <span class="composer-conversation__shortcuts"><kbd>Ctrl</kbd><kbd>D</kbd></span>
                </button>
                <button type="button" @click="openForwardDialog(message)">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m14 5 7 7-7 7" />
                    <path d="M21 12H9a4 4 0 0 0-4 4v3" />
                  </svg>
                  <span>Forward</span>
                  <span class="composer-conversation__shortcuts"><kbd>Ctrl</kbd><kbd>H</kbd></span>
                </button>
                <button type="button" @click="beginReply(message)">
                  <span aria-hidden="true">↩</span>
                  <span>Reply</span>
                  <span class="composer-conversation__shortcuts"><kbd>Ctrl</kbd><kbd>J</kbd></span>
                </button>
                <button type="button" @click="setReminder(message)">
                  <span aria-hidden="true">◷</span>
                  <span>Set Reminder</span>
                  <span class="composer-conversation__shortcuts"><kbd>Ctrl</kbd><kbd>A</kbd></span>
                </button>
              </div>
            </div>

            <span
              v-if="message.status === 'sending'"
              class="composer-conversation__sent-status composer-conversation__sent-status--sending"
              aria-label="Sending"
            >
              Sending…
            </span>
            <button
              v-if="message.status === 'failed'"
              type="button"
              class="composer-conversation__sent-status composer-conversation__sent-status--failed"
              :title="message.error"
              @click="retryMessage(message)"
            >
              Not sent · Retry
            </button>

            <span
              v-if="
                message.mine &&
                !message.deleted &&
                (!message.scheduled || isScheduledMessageDelivered(message))
              "
              class="composer-conversation__sent-status"
              aria-label="Sent"
            >
              ✓✓
            </span>
          </div>
        </article>
      </template>
      <article
        v-for="reminder in dueReminders"
        :key="`due-reminder-${reminder.id}`"
        class="composer-conversation__reminder-notice"
      >
        <div class="composer-conversation__reminder-time">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span
            >Reminded you at {{ formatReminderDate(reminder.firedAt || reminder.remindAt) }}</span
          >
        </div>
        <div class="composer-conversation__reminder-content">
          <img
            class="composer-conversation__reminder-system-icon"
            :src="systemProfile"
            alt=""
            aria-hidden="true"
          />
          <div class="composer-conversation__reminder-details">
            <header class="composer-conversation__reminder-heading">
              <strong>System</strong>
              <time :datetime="reminder.firedAt || reminder.remindAt">
                {{ timeLabel(reminder.firedAt || reminder.remindAt) }}
              </time>
            </header>
            <strong class="composer-conversation__reminder-label">Message</strong>
            <p class="composer-conversation__reminder-message">
              <template
                v-for="(segment, index) in messageSegments(reminder.text || '')"
                :key="`${reminder.id}-${index}`"
              >
                <a
                  v-if="segment.href"
                  :href="segment.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ segment.text }}</a
                >
                <span v-else>{{ segment.text }}</span>
              </template>
            </p>
            <footer class="composer-conversation__reminder-actions">
              <button type="button" @click="dismissDueReminder(reminder)">Delete Reminder</button>
              <span
                class="composer-conversation__reminder-action-divider"
                aria-hidden="true"
              ></span>
              <button
                type="button"
                title="Snooze for 5 minutes"
                @click="snoozeDueReminder(reminder)"
              >
                Snooze
              </button>
            </footer>
          </div>
        </div>
      </article>
      <article
        v-for="reminder in deletedReminders"
        :key="`deleted-reminder-${reminder.id}`"
        class="composer-conversation__reminder-notice"
      >
        <div class="composer-conversation__reminder-time">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span
            >Reminder deleted at
            {{ formatReminderDate(reminder.deletedAt || reminder.remindAt) }}</span
          >
        </div>
        <div class="composer-conversation__reminder-content">
          <img
            class="composer-conversation__reminder-system-icon"
            :src="systemProfile"
            alt=""
            aria-hidden="true"
          />
          <div class="composer-conversation__reminder-details">
            <header class="composer-conversation__reminder-heading">
              <strong>System</strong>
              <time :datetime="reminder.deletedAt || reminder.remindAt">
                {{ timeLabel(reminder.deletedAt || reminder.remindAt) }}
              </time>
            </header>
            <strong class="composer-conversation__reminder-label">Message</strong>
            <p class="composer-conversation__reminder-message">
              <template
                v-for="(segment, index) in messageSegments(reminder.text || '')"
                :key="`deleted-${reminder.id}-${index}`"
              >
                <a
                  v-if="segment.href"
                  :href="segment.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ segment.text }}</a
                >
                <span v-else>{{ segment.text }}</span>
              </template>
            </p>
            <p class="composer-conversation__reminder-deleted-label">Reminder deleted</p>
          </div>
        </div>
      </article>
    </div>

    <div v-if="replyTo" class="composer-conversation__replying">
      <div>
        <strong>Replying to {{ replyTo.author }}</strong>
        <p>{{ replyTo.content }}</p>
      </div>
      <button type="button" aria-label="Cancel reply" @click="replyTo = null">×</button>
    </div>
    <MessageComposer
      ref="messageComposer"
      v-if="canSendMessages"
      :channel-id="channelId"
      :conversation-type="conversationType"
      :create-poll="createPollInChannel"
      :poll-loading="pollApi.loading.value"
      :poll-error="pollApi.error.value"
      @send="addMessage"
      @schedule="addScheduledMessage"
      @clear-poll-error="pollApi.clearError"
    />
    <div
      v-else-if="conversationType !== 'dm'"
      class="mx-4 mb-3 rounded-sm bg-[#f0f0f7] px-4 py-3 text-sm text-slate-500"
      role="status"
    >
      Only certain people can post in this channel.
    </div>

    <SetReminderModal
      v-if="reminderMessage"
      :message="reminderMessage"
      :mode="snoozeTarget ? 'snooze' : 'create'"
      :reminder="snoozeTarget"
      @close="reminderModalClosed"
      @saved="reminderSaved"
    />

    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="composer-conversation__delete-backdrop"
        @mousedown.self="closeDeleteDialog"
      >
        <section
          class="composer-conversation__delete-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="composer-delete-title"
        >
          <header class="composer-conversation__delete-header">
            <h2 id="composer-delete-title">Delete Message</h2>
            <button type="button" aria-label="Close" @click="closeDeleteDialog">&times;</button>
          </header>
          <div class="composer-conversation__delete-body">
            <p>Are you sure you want to delete this Message?</p>
            <label class="composer-conversation__schedule-delete">
              <input v-model="scheduleDelete" type="checkbox" />
              <span>Schedule Delete</span>
            </label>
            <label v-if="scheduleDelete" class="composer-conversation__delete-date">
              <span>Delete on</span>
              <input
                v-model="scheduledDeleteAt"
                type="datetime-local"
                :min="minimumDeleteDate"
                required
              />
              <small>Your local time</small>
            </label>
          </div>
          <footer class="composer-conversation__delete-footer">
            <button type="button" class="is-cancel" @click="closeDeleteDialog">Cancel</button>
            <button type="button" class="is-delete" @click="confirmMessageDeletion">Delete</button>
          </footer>
        </section>
      </div>

      <div
        v-if="activePoll"
        class="composer-conversation__poll-backdrop"
        @mousedown.self="!pollApi.loading.value && closePollResponse()"
      >
        <section
          class="composer-conversation__poll-response-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="`${activePoll.title} poll ${activePollMode === 'results' ? 'results' : 'response'}`"
        >
          <header class="composer-conversation__poll-response-header">
            <h2>{{ activePoll.title }}</h2>
            <button type="button" aria-label="Close poll response" @click="closePollResponse">
              &times;
            </button>
          </header>
          <div class="composer-conversation__poll-response-summary">
            <span>Creator: {{ activePoll.creator || 'You' }}</span>
            <span
              class="composer-conversation__poll-status"
              :class="{ 'is-closed': isPollClosed(activePoll) }"
            >
              <i
                class="composer-conversation__poll-status-icon"
                :class="
                  isPollClosed(activePoll)
                    ? 'is-closed'
                    : isPollScheduled(activePoll)
                      ? 'is-scheduled'
                      : 'is-open'
                "
                aria-hidden="true"
              >
                {{ isPollClosed(activePoll) ? '×' : isPollScheduled(activePoll) ? '◷' : '✓' }}
              </i>
              {{
                isPollClosed(activePoll)
                  ? 'Closed'
                  : isPollScheduled(activePoll)
                    ? 'Scheduled'
                    : 'Open'
              }}
            </span>
            <span class="composer-conversation__poll-meta-divider" aria-hidden="true"></span>
            <span class="composer-conversation__poll-visibility">
              <i aria-hidden="true">◉</i>
              {{ activePoll.audience === 'anonymous' ? 'Anonymous' : 'Public' }}
            </span>
            <strong>* Required</strong>
          </div>
          <p v-if="activePoll.description" class="composer-conversation__poll-response-description">
            Description: {{ activePoll.description }}
          </p>
          <div
            v-for="(question, questionIndex) in activePoll.questions"
            :key="questionIndex"
            class="composer-conversation__poll-response-question"
          >
            <h3>Q{{ questionIndex + 1 }}. {{ question.text }}<b v-if="question.required"> *</b></h3>
            <template v-if="activePollMode === 'results'">
              <div
                v-if="question.type === 'openEnded'"
                class="composer-conversation__poll-text-results"
              >
                <p v-if="pollResults[activePoll.id]?.responses?.[questionIndex]?.length">
                  Responses
                </p>
                <blockquote
                  v-for="response in pollResults[activePoll.id].responses[questionIndex]"
                  :key="response"
                >
                  {{ response }}
                </blockquote>
                <strong class="composer-conversation__poll-total-votes">
                  Total Responses:
                  {{ pollResults[activePoll.id]?.responses?.[questionIndex]?.length || 0 }}
                </strong>
              </div>
              <div v-else class="composer-conversation__poll-results-options">
                <div
                  v-for="(option, optionIndex) in question.options"
                  :key="option"
                  class="composer-conversation__poll-result"
                >
                  <span>{{ option }}</span>
                  <div class="composer-conversation__poll-result-row">
                    <div class="composer-conversation__poll-result-bar">
                      <span
                        class="composer-conversation__poll-result-fill"
                        :style="{
                          width: `${pollResultFor(activePoll.id, questionIndex, optionIndex).percentage}%`,
                        }"
                      ></span>
                      <strong>
                        {{ pollResultFor(activePoll.id, questionIndex, optionIndex).percentage }}%
                      </strong>
                    </div>
                    <span class="composer-conversation__poll-result-votes">
                      {{ pollResultFor(activePoll.id, questionIndex, optionIndex).votes }} VOTE
                    </span>
                  </div>
                </div>
                <strong class="composer-conversation__poll-total-votes">
                  Total Votes: {{ pollResults[activePoll.id]?.totalVotes || 0 }}
                </strong>
              </div>
            </template>
            <template v-else-if="question.type === 'rating'">
              <div class="composer-conversation__poll-rating-labels">
                <span>Weak</span><span>Strong</span>
              </div>
              <div class="composer-conversation__poll-rating-options">
                <label v-for="(option, optionIndex) in question.options" :key="option">
                  <span>{{ option }}</span>
                  <input
                    type="radio"
                    :disabled="pollApi.loading.value"
                    :name="`poll-${activePoll.id}-question-${questionIndex}`"
                    :checked="pollResponses[questionIndex] === optionIndex"
                    @change="togglePollResponse(question, questionIndex, optionIndex)"
                  />
                </label>
              </div>
            </template>
            <textarea
              v-else-if="question.type === 'openEnded'"
              v-model="pollResponses[questionIndex]"
              :disabled="pollApi.loading.value"
              class="composer-conversation__poll-open-ended-input"
              :aria-label="`Response to question ${questionIndex + 1}`"
              :placeholder="
                question.required
                  ? 'Write your response (required)'
                  : 'Write your response (optional)'
              "
              rows="4"
            ></textarea>
            <div v-else class="composer-conversation__poll-choice-options">
              <label v-for="(option, optionIndex) in question.options" :key="option">
                <input
                  :type="question.multiple ? 'checkbox' : 'radio'"
                  :disabled="pollApi.loading.value"
                  :name="`poll-${activePoll.id}-question-${questionIndex}`"
                  :checked="
                    question.multiple
                      ? pollResponses[pollResponseKey(questionIndex, optionIndex)]
                      : pollResponses[questionIndex] === optionIndex
                  "
                  @change="togglePollResponse(question, questionIndex, optionIndex)"
                />
                <span>{{ option }}</span>
              </label>
            </div>
          </div>
          <footer class="composer-conversation__poll-response-footer">
            <p v-if="pollApi.error.value" role="alert">{{ pollApi.error.value }}</p>
            <button
              v-if="activePollMode !== 'results'"
              type="button"
              :disabled="pollApi.loading.value || isPollClosed(activePoll)"
              @click="submitPollResponse"
            >
              {{ pollApi.loading.value ? 'Submitting...' : 'Submit Response' }}
            </button>
            <button
              type="button"
              class="is-close"
              :disabled="pollApi.loading.value"
              @click="closePollResponse"
            >
              Close
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <div
      v-if="forwardTarget"
      class="composer-conversation__forward-overlay"
      @click.self="forwardTarget = null"
    >
      <form class="composer-conversation__forward-dialog" @submit.prevent="forwardMessage">
        <h2>Forward message</h2>
        <p>{{ forwardTarget.content || 'Attachment' }}</p>
        <label for="forward-destination">Send to</label>
        <select id="forward-destination" v-model="forwardDestinationId" required>
          <option value="" disabled>Select a conversation</option>
          <option
            v-for="destination in forwardDestinations"
            :key="`${destination.type}:${destination.id}`"
            :value="destination.id"
          >
            {{ destination.name }}
          </option>
        </select>
        <footer>
          <button type="button" @click="forwardTarget = null">Cancel</button>
          <button type="submit" :disabled="!forwardDestinationId">Forward</button>
        </footer>
      </form>
    </div>
  </section>
</template>

<style scoped>
.composer-conversation {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #f8f9fc;
}

.composer-conversation__messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.composer-conversation__load-older {
  display: block;
  margin: 0 auto 16px;
  padding: 7px 12px;
  border: 1px solid #dfe1ea;
  border-radius: 6px;
  background: white;
  color: #5552c7;
  cursor: pointer;
}

.composer-conversation__date {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 12px;
  color: #717487;
  font-size: 12px;
  font-weight: 600;
}

.composer-conversation__date::before,
.composer-conversation__date::after {
  height: 1px;
  flex: 1;
  background: #e4e6ed;
  content: '';
}

.composer-conversation__message {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 10px;
  margin: 0 0 12px;
}

.composer-conversation__message--grouped {
  margin-top: -8px;
}

.composer-conversation__avatar,
.composer-conversation__avatar-spacer {
  width: 30px;
  height: 30px;
}

.composer-conversation__avatar {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #77c941;
  color: #25263a;
  font-size: 11px;
  font-weight: 600;
}

.composer-conversation__message-content {
  position: relative;
  min-width: 0;
}

.composer-conversation__message-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 5px;
  color: #25263a;
  font-size: 14px;
}

.composer-conversation__author {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.composer-conversation__author:hover {
  color: #514bc7;
  text-decoration: underline;
}

.composer-conversation__message-heading time,
.composer-conversation__edited {
  display: block;
  margin-top: 8px;
  color: #696d81;
  font-size: 12px;
}

.composer-conversation__pinned {
  border-radius: 3px;
  background: #6159d8;
  padding: 2px 6px;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 12px;
}

.composer-conversation__message-bubble {
  position: relative;
  min-height: 36px;
  padding: 8px 10px;
  background: #edeef6;
  color: #25263a;
  overflow-wrap: anywhere;
}

.composer-conversation__message-bubble--deleted {
  color: #777987;
  font-style: italic;
}

.composer-conversation__deleted-message {
  margin: 0;
  color: #777987;
  font-style: italic;
}

.composer-conversation__message-bubble p {
  margin: 0;
  white-space: pre-wrap;
}

.composer-conversation__message-bubble a {
  color: #514bc7;
  text-decoration: underline;
}

.composer-conversation__reminder-notice {
  margin: 0 0 12px;
  padding: 12px 12px 8px;
  background: #f7f7fb;
  color: #25263a;
}

.composer-conversation__reminder-time {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 4px;
  color: #696d81;
  font-size: 16px;
  line-height: 1.5;
}

.composer-conversation__reminder-time svg {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  color: #ff334b;
}

.composer-conversation__reminder-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.composer-conversation__reminder-system-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  object-fit: cover;
}

.composer-conversation__reminder-details {
  min-width: 0;
  flex: 1;
}

.composer-conversation__message-reminder {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: #252525;
  font-size: 14px;
  line-height: 1.4;
}

.composer-conversation__message-reminder svg {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: #ff334b;
}

.composer-conversation__reminder-heading {
  display: flex;
  align-items: baseline;
  gap: 28px;
  margin: 0 0 10px;
  font-size: 18px;
}

.composer-conversation__reminder-heading time {
  color: #696d81;
  font-size: 16px;
}

.composer-conversation__reminder-label {
  display: block;
  margin-bottom: 6px;
  font-size: 18px;
}

.composer-conversation__reminder-message {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 18px;
  white-space: pre-wrap;
}

.composer-conversation__reminder-message a {
  color: #514bc7;
  text-decoration: underline;
}

.composer-conversation__reminder-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 44px;
  font-size: 16px;
}

.composer-conversation__reminder-actions button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #696d81;
  font: inherit;
  cursor: pointer;
}

.composer-conversation__reminder-actions button:first-child {
  color: #ff334b;
}

.composer-conversation__reminder-action-divider {
  width: 1px;
  height: 20px;
  background: #d3d5de;
}

.composer-conversation__reminder-actions button:hover {
  text-decoration: underline;
}

.composer-conversation__reminder-deleted-label {
  margin: 20px 0 0;
  color: #ff334b;
  font-size: 12px;
}

.composer-conversation__reply-quote {
  display: grid;
  gap: 2px;
  margin-bottom: 7px;
  padding-left: 9px;
  border-left: 3px solid #7771dc;
  color: #626579;
  font-size: 12px;
}

.composer-conversation__reply-quote span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-conversation__edit-form textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid #a6a4e0;
  border-radius: 5px;
  padding: 7px;
  background: white;
  color: #25263a;
}

.composer-conversation__edit-form div {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.composer-conversation__edit-form button {
  border-radius: 4px;
  padding: 4px 9px;
  color: #5552c7;
  cursor: pointer;
}

.composer-conversation__edit-form button[type='submit'] {
  background: #5b5be2;
  color: white;
}

.composer-conversation__link-preview {
  display: grid;
  gap: 4px;
  max-width: 440px;
  margin-top: 10px;
  padding: 12px;
  border: 1px solid #dfe1ea;
  border-left: 4px solid #7771dc;
  border-radius: 6px;
  background: white;
  color: #25263a !important;
  text-decoration: none !important;
}

.composer-conversation__link-preview-host,
.composer-conversation__link-preview-url {
  color: #717487;
  font-size: 11px;
}

.composer-conversation__link-preview-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-conversation__gif {
  display: block;
  max-width: min(100%, 320px);
  max-height: 320px;
  border-radius: 4px;
  object-fit: contain;
}

.composer-conversation__actions {
  position: absolute;
  z-index: 2;
  top: -12px;
  right: 4px;
  display: grid;
  justify-items: end;
}
.composer-conversation__poll-card {
  overflow: hidden;
  border-left: 4px solid #1717ff;
  background: #edeef6;
}

.composer-conversation__poll-card h2 {
  margin: 0;
  padding: 18px 16px 12px;
  border-bottom: 1px solid #d5d7e2;
  font-size: 23px;
  font-weight: 600;
}

.composer-conversation__poll-description {
  padding: 12px 16px 0;
  color: #696d81;
  font-size: 14px;
}

.composer-conversation__poll-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 16px 9px;
  color: #696d81;
  font-size: 14px;
}

.composer-conversation__poll-status,
.composer-conversation__poll-visibility {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.composer-conversation__poll-status-icon {
  display: inline-grid;
  width: 15px;
  height: 15px;
  place-items: center;
  border-radius: 3px;
  background: #4caf50;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  line-height: 1;
}

.composer-conversation__poll-status-icon.is-closed {
  background: #f04444;
}

.composer-conversation__poll-status-icon.is-scheduled {
  background: #5962ff;
}

.composer-conversation__poll-status.is-closed {
  color: #696d81;
}

.composer-conversation__poll-visibility i {
  color: #696d81;
  font-size: 16px;
  font-style: normal;
}

.composer-conversation__poll-meta-divider {
  width: 1px;
  height: 18px;
  background: #c9cbd6;
}

.composer-conversation__poll-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 14px;
}

.composer-conversation__poll-schedule-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin: 4px 12px 14px;
  border: 1px solid #d5d7e2;
  border-radius: 6px;
  background: #fff;
  color: #25263a;
}

.composer-conversation__poll-schedule-item {
  display: flex;
  min-width: 220px;
  flex: 1 1 220px;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
}

.composer-conversation__poll-schedule-item + .composer-conversation__poll-schedule-item {
  border-left: 1px solid #e1e2ea;
}

.composer-conversation__poll-schedule-icon {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #eef0ff;
  color: #5962ff;
  font-size: 15px;
  font-weight: 700;
}

.composer-conversation__poll-schedule-item > span:last-child {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.composer-conversation__poll-schedule-item small {
  color: #696d81;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.composer-conversation__poll-schedule-item strong {
  overflow: hidden;
  color: #25263a;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 620px) {
  .composer-conversation__poll-schedule-item + .composer-conversation__poll-schedule-item {
    border-top: 1px solid #e1e2ea;
    border-left: 0;
  }
}

.composer-conversation__poll-actions button {
  padding: 7px 10px;
  border: 1px solid #5962ff;
  border-radius: 4px;
  background: #fff;
  color: #5962ff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.composer-conversation__poll-actions button.is-done {
  border-color: #929bff;
  background: #929bff;
  color: #fff;
  cursor: default;
}

.composer-conversation__poll-backdrop {
  position: fixed;
  z-index: 2200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(20 16 40 / 50%);
}

.composer-conversation__poll-response-modal {
  width: min(840px, 100%);
  max-height: min(90vh, 680px);
  overflow: auto;
  background: #fff;
  box-shadow: 0 12px 40px rgb(0 0 0 / 28%);
  color: #25263a;
}

.composer-conversation__delete-backdrop {
  position: fixed;
  z-index: 2300;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(20 16 40 / 42%);
}

.composer-conversation__delete-dialog {
  width: min(500px, 100%);
  overflow: hidden;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 12px 40px rgb(0 0 0 / 28%);
  color: #414354;
}

.composer-conversation__delete-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 26px 52px 18px;
}

.composer-conversation__delete-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.composer-conversation__delete-header button {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #f0f0f7;
  color: #414354;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.composer-conversation__delete-body {
  min-height: 126px;
  padding: 12px 24px 24px;
}

.composer-conversation__delete-body > p {
  margin: 0 0 24px;
  font-size: 14px;
}

.composer-conversation__schedule-delete {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #696d75;
  cursor: pointer;
}

.composer-conversation__schedule-delete input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: #5962ff;
}

.composer-conversation__delete-date {
  display: grid;
  gap: 6px;
  margin-top: 18px;
  font-size: 13px;
}

.composer-conversation__delete-date input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid #c9ccda;
  border-radius: 4px;
  color: #25263a;
  font: inherit;
}

.composer-conversation__delete-date small {
  color: #696d81;
}

.composer-conversation__delete-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px 16px;
  border-top: 1px solid #dedfe4;
}

.composer-conversation__delete-footer button {
  min-width: 90px;
  padding: 10px 16px;
  border: 0;
  background: transparent;
  color: #414354;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
}

.composer-conversation__delete-footer button.is-delete {
  background: #ff334b;
  color: #fff;
}

.composer-conversation__delete-footer button.is-delete:hover {
  background: #e8273f;
}

.composer-conversation__poll-response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px;
  border-bottom: 1px solid #d5d7e2;
}

.composer-conversation__poll-response-header h2 {
  margin: 0;
  font-size: 27px;
  font-weight: 500;
}

.composer-conversation__poll-response-header button {
  border: 0;
  background: transparent;
  color: #777;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
}

.composer-conversation__poll-response-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px 8px;
  color: #696d81;
  font-size: 15px;
}

.composer-conversation__poll-response-summary strong {
  color: #ff2e3b;
}

.composer-conversation__poll-response-description {
  margin: 0;
  padding: 0 28px 14px;
  color: #696d81;
}

.composer-conversation__poll-response-question {
  margin: 0 28px 14px;
  padding: 0 10px 24px;
  background: #edeef6;
}

.composer-conversation__poll-response-question h3 {
  margin: 0;
  padding: 15px 0;
  border-bottom: 1px solid #d5d7e2;
  color: #5962ff;
  font-size: 23px;
  font-weight: 600;
}

.composer-conversation__poll-response-question h3 b {
  color: #ff2e3b;
}

.composer-conversation__poll-choice-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px 4px 0;
}

.composer-conversation__poll-open-ended-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 20px;
  padding: 12px;
  border: 1px solid #c9ccda;
  border-radius: 4px;
  background: #fff;
  color: #25263a;
  font: inherit;
  resize: vertical;
}

.composer-conversation__poll-open-ended-input:focus {
  border-color: #5962ff;
  outline: 2px solid rgb(89 98 255 / 20%);
}

.composer-conversation__poll-text-results {
  padding: 18px 4px 0;
  color: #696d81;
}

.composer-conversation__poll-text-results p {
  margin: 0 0 8px;
  font-weight: 600;
}

.composer-conversation__poll-text-results blockquote {
  margin: 8px 0;
  padding: 10px 12px;
  border-left: 3px solid #929bff;
  background: #fff;
}

.composer-conversation__poll-choice-options label {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #696d81;
  font-size: 17px;
}

.composer-conversation__poll-choice-options input,
.composer-conversation__poll-rating-options input {
  width: 20px;
  height: 20px;
  accent-color: #5962ff;
}

.composer-conversation__poll-rating-labels {
  display: flex;
  justify-content: space-between;
  padding: 32px 0 24px;
  color: #696d81;
  font-size: 16px;
}

.composer-conversation__poll-rating-options {
  display: flex;
  justify-content: space-evenly;
  gap: 12px;
}

.composer-conversation__poll-rating-options label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 18px;
}

.composer-conversation__poll-results-options {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 4px 0;
}

.composer-conversation__poll-result > span {
  display: block;
  margin-bottom: 5px;
  color: #696d81;
  font-size: 16px;
}

.composer-conversation__poll-result-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.composer-conversation__poll-result-bar {
  position: relative;
  display: flex;
  min-width: 0;
  height: 24px;
  flex: 1;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #d9dcfa;
  color: #25263a;
}

.composer-conversation__poll-result-fill {
  position: absolute;
  inset: 0 auto 0 0;
  min-width: 0;
  background: #5962ff;
  transition: width 180ms ease;
}

.composer-conversation__poll-result-bar strong {
  position: relative;
  z-index: 1;
  font-size: 14px;
}

.composer-conversation__poll-result-votes {
  min-width: 68px;
  padding: 6px 8px;
  border: 1px solid #5962ff;
  border-radius: 4px;
  color: #5962ff;
  font-size: 12px;
  text-align: center;
}

.composer-conversation__poll-total-votes {
  display: block;
  padding-top: 2px;
  color: #696d81;
  font-size: 14px;
}

.composer-conversation__poll-response-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  border-top: 1px solid #d5d7e2;
  padding: 28px;
}

.composer-conversation__poll-response-footer button {
  padding: 12px 16px;
  border: 1px solid #5962ff;
  border-radius: 2px;
  background: #929bff;
  color: #fff;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.composer-conversation__poll-response-footer button:hover,
.composer-conversation__poll-actions button:not(.is-done):hover {
  border-color: #27338f;
  background: #27338f;
  color: #fff;
}

.composer-conversation__poll-response-footer button.is-close {
  border-color: transparent;
  background: transparent;
  color: #25263a;
  text-transform: uppercase;
}

.composer-conversation__poll-response-footer button.is-close:hover {
  border-color: #27338f;
  background: #27338f;
  color: #fff;
}

.composer-conversation__action-toolbar {
  display: flex;
  border: 1px solid #d9dbe5;
  border-radius: 7px;
  background: white;
  box-shadow: 0 2px 6px #27243b1a;
  opacity: 0;
  transition: opacity 120ms ease;
}

.composer-conversation__message-content:hover .composer-conversation__action-toolbar,
.composer-conversation__action-toolbar:focus-within,
.composer-conversation__actions:focus-within .composer-conversation__action-toolbar {
  opacity: 1;
}

.composer-conversation__action-toolbar button,
.composer-conversation__reaction-picker button {
  min-width: 34px;
  height: 34px;
  border-radius: 5px;
  color: #414258;
  font-size: 18px;
  cursor: pointer;
}

.composer-conversation__action-toolbar button {
  display: grid;
  place-items: center;
}

.composer-conversation__action-toolbar button svg,
.composer-conversation__action-toolbar button img {
  width: 19px;
  height: 19px;
}

.composer-conversation__action-toolbar button:hover,
.composer-conversation__reaction-picker button:hover {
  background: #f1f0fa;
}

.composer-conversation__menu {
  display: grid;
  min-width: 160px;
  margin-top: 4px;
  padding: 5px;
  border: 1px solid #e6e7ed;
  border-radius: 7px;
  background: white;
  box-shadow: 0 8px 24px #14141f2e;
}

.composer-conversation__menu button {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  color: #303044;
  text-align: left;
  cursor: pointer;
}

.composer-conversation__menu button:hover {
  background: #f2f2f8;
}

.composer-conversation__menu button:disabled {
  color: #a4a5b0;
  cursor: not-allowed;
}

.composer-conversation__menu button:disabled:hover {
  background: transparent;
}

.composer-conversation__menu button svg {
  width: 20px;
  height: 20px;
}

.composer-conversation__menu .composer-conversation__delete-action {
  color: #c92f43;
}

.composer-conversation__menu .composer-conversation__delete-action:disabled {
  color: #c6a9ad;
}

.composer-conversation__shortcuts {
  display: flex;
  gap: 3px;
}

.composer-conversation__shortcuts kbd {
  min-width: 20px;
  border-radius: 5px;
  padding: 2px 4px;
  background: #414253;
  color: white;
  font: inherit;
  font-size: 11px;
  text-align: center;
}

.composer-conversation__reaction-picker {
  position: absolute;
  top: 40px;
  right: 0;
  z-index: 3;
  width: min(320px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid #d9dbe5;
  border-radius: 8px;
  background: white;
  box-shadow: 0 8px 24px #14141f2e;
}

.composer-conversation__reaction-picker :deep(.v3-emoji-picker) {
  box-sizing: border-box;
  width: 100% !important;
  min-width: 100%;
  max-width: 100%;
  height: 320px;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  --v3-picker-bg: #ffffff;
  --v3-picker-fg: #34364b;
  --v3-picker-border: #e2e2e8;
  --v3-picker-input-bg: #f8f8f9;
  --v3-picker-input-border: #dedee4;
  --v3-picker-input-focus-border: #741cff;
  --v3-picker-emoji-hover: #eeeef4;
}

.composer-conversation__reaction-picker :deep(.v3-header) {
  padding: 8px 8px 6px;
}

.composer-conversation__reaction-picker :deep(.v3-search) {
  padding: 0 8px;
}

.composer-conversation__reaction-picker :deep(.v3-search input) {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
}

.composer-conversation__reaction-picker :deep(.v3-body) {
  min-height: 0;
  padding: 0 8px 8px;
  overflow: hidden;
}

.composer-conversation__reaction-picker :deep(.v3-body-inner) {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

.composer-conversation__reaction-picker :deep(.v3-footer) {
  display: none !important;
}

.composer-conversation__reaction-picker :deep(.v3-body-inner .v3-group .v3-emojis button) {
  flex-basis: 20%;
  max-width: 20%;
  font-size: 18px;
}

.composer-conversation__reaction-picker :deep(.v3-body-inner .v3-group .v3-emojis button img) {
  width: 32px;
  height: 32px;
  max-width: 32px;
  padding: 0;
  object-fit: contain;
}

.composer-conversation__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.composer-conversation__reactions button {
  padding: 3px 8px;
  border: 1px solid #c9c7eb;
  border-radius: 999px;
  background: white;
  color: #45445f;
  font-size: 12px;
  cursor: pointer;
}

.composer-conversation__reactions button[aria-pressed='true'] {
  border-color: #6761d5;
  background: #efeeff;
}

.composer-conversation__sent-status {
  position: absolute;
  right: 8px;
  bottom: 7px;
  color: #afb5d1;
  font-size: 13px;
  letter-spacing: -4px;
}

.composer-conversation__important {
  display: inline-block;
  margin-bottom: 6px;
  padding: 1px 10px;
  border-radius: 999px;
  background: #f04444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.composer-conversation__forwarded {
  display: block;
  margin-bottom: 5px;
  color: #717487;
  font-size: 11px;
  font-style: italic;
}

.composer-conversation__scheduled {
  display: block;
  margin-top: 6px;
  color: #696d81;
  font-size: 12px;
}

.composer-conversation__attachment-list {
  display: grid;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.composer-conversation__attachment {
  min-width: 0;
}

.composer-conversation__replying {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 16px;
  border-top: 1px solid #e4e6ed;
  background: white;
  color: #414258;
  font-size: 12px;
}

.composer-conversation__replying p {
  max-width: 70vw;
  margin: 3px 0 0;
  overflow: hidden;
  color: #717487;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-conversation__replying button {
  font-size: 20px;
  cursor: pointer;
}

.composer-conversation__forward-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #0006;
}

.composer-conversation__forward-dialog {
  display: grid;
  width: min(420px, 100%);
  gap: 10px;
  border-radius: 8px;
  padding: 22px;
  background: white;
  box-shadow: 0 12px 32px #0003;
}

.composer-conversation__forward-dialog h2 {
  margin: 0;
  font-size: 20px;
}

.composer-conversation__forward-dialog p {
  margin: 0;
  overflow: hidden;
  color: #717487;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-conversation__forward-dialog select {
  min-height: 40px;
  border: 1px solid #dfe1ea;
  border-radius: 5px;
  padding: 6px 9px;
  background: white;
}

.composer-conversation__forward-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.composer-conversation__forward-dialog footer button {
  border-radius: 4px;
  padding: 8px 12px;
  color: #5552c7;
  cursor: pointer;
}

.composer-conversation__forward-dialog footer button[type='submit'] {
  background: #5b5be2;
  color: white;
}

.composer-conversation__forward-dialog footer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer-conversation__status {
  margin: 12px 0;
  color: #717487;
  font-size: 13px;
  text-align: center;
}
.composer-conversation__status--error {
  color: #c92f43;
}
.composer-conversation__status button {
  margin-left: 6px;
  color: #5552c7;
  text-decoration: underline;
  cursor: pointer;
}

@media (hover: none) {
  .composer-conversation__action-toolbar {
    opacity: 1;
  }
}

.composer-conversation__sent-status--sending,
.composer-conversation__sent-status--failed {
  font-size: 11px;
  letter-spacing: normal;
}
.composer-conversation__sent-status--failed {
  border: 0;
  padding: 0;
  background: transparent;
  color: #c92f43;
  text-decoration: underline;
  cursor: pointer;
}
/* Sending / Not sent dikhe to purana ✓✓ chhup jaye */
.composer-conversation__sent-status--sending ~ .composer-conversation__sent-status,
.composer-conversation__sent-status--failed ~ .composer-conversation__sent-status {
  display: none;
}
</style>
