<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import { useChannelsStore } from '@/features/channels'
import {
  listMembers,
  pinMessage,
  sendChannelVoiceMessage,
  unpinMessage,
} from '@/features/channels/api/channels.api'
import { useDmStore } from '@/features/dms/stores/dms'
import VoiceNotePlayer from '@/features/media/VoiceNotePlayer.vue'
import MessageAttachment from '@/features/messages/MessageAttachment.vue'
import { getAuthUser, getAuthUserId } from '@/features/auth/session'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { useRepliesStore } from '@/features/replies/stores/replies'
import { useMessagesStore } from '@/features/messages/messages'
import { useTeamsStore } from '@/stores/teams'
import { forwardChannelMessage } from '@/features/messages/channelMessageService'
import {
  createLinkPreview,
  dateLabel,
  formattedMessageHtml,
  fullDateTimeLabel,
  messageSegments,
  relativeTimeLabel,
  sameDay,
  timeLabel,
} from '@/features/messages/message-utils'
import { useUiStore } from '@/stores/ui'
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
import PresenceDot from '@/features/dms/components/PresenceDot.vue'
import TimeAgo from '@/features/dms/components/TimeAgo.vue'
import ReplySummary from '@/features/replies/components/ReplySummary.vue'
import ThreadPanel from '@/features/replies/components/ThreadPanel.vue'
import { dayLabel } from '@/features/dms/utils/time'
import pinChatIcon from '@/assets/pin-chat.svg'
import unpinChatIcon from '@/assets/unpin-chat.svg'

const props = defineProps({
  conversationId: { type: [String, Number], default: null },
  conversationType: { type: String, default: 'channel' },
})

// (naya) Yeh constants upar hain: setup ke dauran (watch immediate) bhi istemal hote hain,
// neeche hote to "Cannot access 'HTML_TAG' before initialization" se poori chat khali ho jati
// ---------- (naya) <p>hi</p> / &lt;p&gt;hi&lt;/p&gt; ki jagah "hi" ----------
const HTML_TAG =
  /<\/?(p|br|div|span|strong|b|em|i|u|s|strike|del|ul|ol|li|code|pre|blockquote|a|h[1-6])\b[^>]*>/i

// (naya) Forward ka invisible nishan (dms.js / dmApi.js jaisa): doosre user ko bhi "(forwarded)"
const FORWARD_MARK = '\u2063\u200b\u2063'

// (naya) Forward ka nishan jo text ke saath server tak jata hai (dms.js jaisa)
const FORWARD_TEXT_PREFIX = '[Forwarded] '
const FORWARD_TEXT_RE = /^\s*\[forwarded\]\s*/i

const dms = useDmStore()
const pollApi = usePoll()
const repliesStore = useRepliesStore()
const teamsStore = useTeamsStore()
const channelsStore = useChannelsStore()
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
const menuAnchor = ref(null)
const actionMenu = ref(null)
const actionMenuPosition = ref({})
const deleteTarget = ref(null)
const deletingMessage = ref(false)
const scheduleDelete = ref(false)
const scheduledDeleteAt = ref('')
const openReactionId = ref(null)
const reminderTarget = ref(null)
const snoozeTarget = ref(null)
const forwardTarget = ref(null)
const forwardDestinationId = ref('')
const channelThreadMessage = ref(null)
const dmVisibleCount = ref(20)
const pollParticipationStorageKey = `whistleit:participated-polls:${getAuthUserId() ?? dms.meId ?? 'anonymous'}`
const storedParticipatedPolls = JSON.parse(
  localStorage.getItem(pollParticipationStorageKey) || '[]',
)
const participatedPolls = ref(
  new Set(Array.isArray(storedParticipatedPolls) ? storedParticipatedPolls.map(String) : []),
)
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
  const creatorId = channel.createdById ?? channel.created_by_id ?? channel.createdBy
  const isChannelCreator =
    channel.isOwner || (userId != null && creatorId != null && String(creatorId) === String(userId))
  const isChannelAdmin =
    teamsStore.isAdmin ||
    channel.canManage ||
    channel.isAdmin ||
    (userId != null &&
      (channel.adminIds || []).some((admin) => {
        const adminId =
          admin && typeof admin === 'object'
            ? (admin.id ?? admin.user_id ?? admin.userId ?? admin.member_id)
            : admin
        return adminId != null && String(adminId) === String(userId)
      }))
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

  if (channel.messagePermission === 'creator_only') {
    return isChannelCreator
  }
  if (channel.messagePermission === 'admins') {
    return isChannelAdmin || isChannelCreator
  }
  if (usesSelectedMembersPermission) {
    return isAllowedSender
  }
  if (channel.isMember === false) return false
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

// (naya) Reply ka quote: asli message mile to uska naam / text (deleted ho to "(message deleted)")
function replyPreviewOf(message, byId) {
  if (!message.replyTo) return null
  const ref = typeof message.replyTo === 'object' ? message.replyTo : { id: message.replyTo }
  const original = ref.id != null ? byId.get(String(ref.id)) : null
  const source = original || ref
  const author =
    source.author ||
    (source.from
      ? source.from === dms.meId
        ? currentUserName.value
        : dms.usersById[source.from]?.name
      : '') ||
    ref.author ||
    'Message'
  return {
    id: ref.id,
    author,
    deleted: Boolean(original?.deleted),
    content: source.content ?? source.text ?? ref.content ?? '',
  }
}

// (naya) Schedule kiya hua delete cancel
function cancelScheduledDelete(message) {
  if (conversation.value) dms.cancelScheduledDelete?.(conversation.value.id, message.id)
}

// (naya) Offline banner: messages / edits / reactions queue mein, internet aate hi khud jaate hain
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
function updateOnline() {
  isOnline.value = navigator.onLine !== false
}
onMounted(() => {
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})

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
// (naya) DM: adhoora / ajeeb shakal ka message (list ka preview, purana cache, kachcha server data)
// poori chat ko khali na kare: text hamesha string, reactions { emoji, users: [] }, attachments bina null
function dmTextOf(value) {
  if (typeof value === 'string') return value
  if (value == null) return value
  if (typeof value === 'object') {
    const inner = value.html ?? value.text ?? value.body ?? value.content
    return typeof inner === 'string' ? inner : ''
  }
  return String(value)
}
function safeDmMessage(message) {
  const safe = { ...message }
  for (const field of ['text', 'content', 'body']) {
    if (field in safe && safe[field] != null && typeof safe[field] !== 'string')
      safe[field] = dmTextOf(safe[field])
  }
  if (!Array.isArray(safe.reactions)) {
    safe.reactions = []
  } else {
    safe.reactions = safe.reactions
      .filter((r) => r && typeof r === 'object' && r.emoji != null && r.emoji !== '')
      .map((r) => {
        const users = r.users ?? r.user_ids ?? r.userIds
        return Array.isArray(users) ? r : { ...r, users: [] }
      })
  }
  if ('attachments' in safe) {
    safe.attachments = Array.isArray(safe.attachments)
      ? safe.attachments.filter((file) => file && typeof file === 'object')
      : []
  }
  return safe
}

const renderedMessages = computed(() => {
  const currentUser = currentUserName.value
  const byId = new Map(allMessages.value.filter(Boolean).map((item) => [String(item.id), item])) // (naya)
  let previous = null

  return [...visibleMessages.value]
    .filter((message, index, messages) => {
      if (conversation.value && !message) return false // (naya) DM: khali entry se chat crash na ho
      if (conversation.value && isHiddenThreadReply(message)) return false // (naya) DM: thread reply sirf card mein
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
      if (conversation.value) message = safeDmMessage(message)
      const voiceNoteId = message.voiceNoteId ?? message.voice_note_id ?? message.voice_note?.id
      const messageContent = message.text ?? message.content ?? ''
      const normalizedContent = normalizeMessageText(messageContent)
      const content = message.deleted
        ? '(message deleted)'
        : voiceNoteId && normalizedContent.trim().toLowerCase() === 'voice message'
          ? ''
          : normalizedContent
      const pollId = message.poll_id ?? message.pollId
      const poll =
        message.poll ??
        (pollId != null
          ? {
              id: pollId,
              title: message.poll_title ?? message.pollTitle ?? message.title ?? content,
              description: message.poll_description ?? message.pollDescription ?? '',
              questions: pollQuestionsFromResponse(
                message.poll_questions ?? message.pollQuestions ?? message.questions ?? [],
              ),
            }
          : null)
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
      const replyTarget =
        message.replyTo != null
          ? allMessages.value.find(
              (item) => String(item.id) === String(message.replyTo?.id ?? message.replyTo),
            ) ||
            (typeof message.replyTo === 'object' && message.replyTo && 'id' in message.replyTo
              ? message.replyTo
              : allMessages.value.find((item) => String(item.id) === String(message.replyTo)))
          : null
      const rendered = {
        ...message,
        ...(poll ? { poll } : {}),
        content,
        important: isImportantMessage(message),
        formattedContent: formattedMessageHtml(content),
        author,
        authorId,
        mine: message.mine ?? message.from === dms.meId,
        showDate: !previous || !sameDay(previous.createdAt, message.createdAt),
        dateHeading: dateLabel(message.createdAt),
        time: relativeTimeLabel(message.createdAt, pollClock.value),
        fullTime: fullDateTimeLabel(message.createdAt),
        grouped: Boolean(grouped),
        segments: messageSegments(content),
        preview: createLinkPreview(content),
        reply: replyTarget,
        reactions: message.reactions || [],
      }
      rendered.replySummary = replySummaryFor(rendered)
      if (conversation.value && rendered.reply) rendered.reply = replyPreviewOf(message, byId) // (naya) DM: asli naam/text
      // (naya) Text mein HTML tags aa jayein (<p>hi</p>) to saaf text dikhao (forward bhi saaf jata hai)
      // (naya) Forward ka invisible nishan (channel / purana cache): "(forwarded)" + nishan hatao
      if (
        conversation.value &&
        typeof rendered.content === 'string' &&
        rendered.content.includes(FORWARD_MARK)
      ) {
        rendered.content = rendered.content.split(FORWARD_MARK).join('')
        rendered.formattedContent = formattedMessageHtml(rendered.content)
        rendered.forwardedFrom = rendered.forwardedFrom || 'forwarded'
      }
      // (naya) "[Forwarded] ..." (server se aaya nishan): prefix hatao, neeche "(forwarded)"
      if (!rendered.deleted && typeof rendered.content === 'string') {
        const shown = htmlToPlainText(rendered.content)
        if (FORWARD_TEXT_RE.test(shown)) {
          const clean = shown.replace(FORWARD_TEXT_RE, '')
          rendered.forwardedFrom = rendered.forwardedFrom || 'forwarded'
          rendered.formattedContent = formattedMessageHtml(clean)
          rendered.segments = messageSegments(clean)
          rendered.preview = createLinkPreview(clean)
          if (conversation.value) rendered.content = clean
        } else if (!conversation.value && shown !== rendered.content) {
          // Channel: "<p>hi</p>" ki jagah "hi" dikhao (edit / copy ke liye asli content wahi rehta hai)
          rendered.formattedContent = formattedMessageHtml(shown)
          rendered.segments = messageSegments(shown)
          rendered.preview = createLinkPreview(shown)
        }
      }
      // (naya) Channel: is browser se forward kiya hua message -> "(forwarded)"
      if (
        !conversation.value &&
        !rendered.forwardedFrom &&
        isRememberedForward(channelId.value, message)
      ) {
        rendered.forwardedFrom = 'forwarded'
      }
      // (naya) Backend replies_count na de: parent_id wale replies se ginti (doosre user ko bhi)
      // DM thread summary (localStorage + network): jo ginti bari ho, aur sab se naya "last reply"
      if (conversation.value) {
        const info = dms.threadInfo?.(conversation.value.id, message.id)
        if (info?.count && info.count >= (rendered.replyCount || 0)) {
          rendered.replyCount = info.count
          const ours = Date.parse(info.lastAt)
          const theirs = Date.parse(rendered.lastReplyAt)
          if (Number.isFinite(ours) && (!Number.isFinite(theirs) || ours > theirs))
            rendered.lastReplyAt = info.lastAt
        }
      }
      if (conversation.value && !message.deleted && typeof rendered.content === 'string') {
        const plain = htmlToPlainText(rendered.content)
        if (plain !== rendered.content) {
          rendered.content = plain
          rendered.formattedContent = formattedMessageHtml(plain)
          rendered.segments = messageSegments(plain)
          rendered.preview = createLinkPreview(plain)
        }
      }
      previous = rendered
      return rendered
    })
})

function isImportantMessage(message) {
  const value = message.important ?? message.is_important
  return value === true || value === 1 || value === '1' || value === 'true'
}

function replySummaryFor(message) {
  const target = {
    teamId: conversation.value ? null : teamsStore.activeTeamId,
    channelId: channelId.value,
    messageId: String(message.id),
  }
  const replyCountFields = [
    message.reply_count,
    message.replyCount,
    message.replies_count,
    message.repliesCount,
    message.thread_reply_count,
    message.threadReplyCount,
    message.reply_total,
    message.replyTotal,
    message.thread_replies_count,
    message.threadRepliesCount,
    Array.isArray(message.replies) ? message.replies.length : null,
  ]
  const serverCounts = replyCountFields
    .filter((value) => value != null && String(value).trim() !== '')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0)
  const cachedReplies = repliesStore.repliesOf(target)
  const count = Math.max(0, ...serverCounts, cachedReplies.length)
  const lastReplyAt = [
    message.last_reply_at ??
      message.lastReplyAt ??
      message.last_reply_created_at ??
      message.lastReplyCreatedAt ??
      message.latest_reply_at ??
      message.latestReplyAt ??
      message.last_reply?.created_at ??
      message.last_reply?.createdAt ??
      message.lastReply?.created_at ??
      message.lastReply?.createdAt,
    ...cachedReplies
      .map((reply) => reply.createdAt)
      .filter(Boolean)
      .sort((a, b) => Date.parse(b) - Date.parse(a)),
  ].find((value) => value && Number.isFinite(Date.parse(value)))
  const parsedLastReplyAt = lastReplyAt ? Date.parse(lastReplyAt) : NaN
  return {
    count,
    lastReplyAt: Number.isFinite(parsedLastReplyAt) ? lastReplyAt : '',
    lastReplyLabel: Number.isFinite(parsedLastReplyAt)
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          parsedLastReplyAt,
        )
      : '',
  }
}

// ---------- DM: online dot, replies thread (naya) ----------
const presence = usePresenceStore()
const replies = repliesStore
const threadMessageId = ref(null) // DM ka khula "Reply Thread"

// Avatar par online/away/offline dot: jab author ka asli user id maloom ho (sirf DM)
function presenceUserId(message) {
  if (!conversation.value) return null
  const id = message.from ?? message.authorId
  return id && dms.usersById[id] ? id : null
}

// Replies API sirf server par gaye DM messages ke liye
function canThread(message) {
  return (
    Boolean(conversation.value) &&
    Boolean(message) && // (naya)
    !message.deleted &&
    !message.scheduled &&
    !String(message.id).startsWith('local-')
  )
}
function replyTarget(message) {
  return { channelId: String(conversation.value.id), messageId: String(message.id) }
}
// (naya) replies store ki purani (khali) ginti DM list wali ginti ko na chhupaye: dono mein se bari
function dmThreadSummary(message) {
  const info = dms.threadInfo?.(conversation.value.id, message.id)
  const count = Math.max(
    replies.countOf(replyTarget(message), message.replyCount ?? 0) ?? 0,
    message.replyCount ?? 0,
    info?.count ?? 0,
  )
  const times = [
    replies.lastReplyAtOf(replyTarget(message), message.lastReplyAt),
    message.lastReplyAt,
    info?.lastAt,
  ].filter(Boolean)
  const lastAt = times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a), times[0])
  return { count, lastAt }
}
function replyCountOf(message) {
  if (conversation.value) return dmThreadSummary(message).count // (naya)
  return replies.countOf(replyTarget(message), message.replyCount ?? 0)
}
function lastReplyAtOf(message) {
  if (conversation.value) return dmThreadSummary(message).lastAt ?? message.lastReplyAt // (naya)
  return replies.lastReplyAtOf(replyTarget(message), message.lastReplyAt)
}
function openThread(message) {
  if (conversation.value) {
    if (!canThread(message)) return
    threadMessageId.value = message.id
  } else {
    channelThreadMessage.value = message
  }
  openMenuId.value = null
}

// Replies API reply ko ek id deti hai, DM / channel list mein wahi reply doosri id se aata hai:
// isliye id ke ilawa bhejne wala + text + waqt (2 min) se bhi pehchano
function sameAsReply(message, reply, parentId) {
  if (!message || String(message.id) === String(parentId)) return false
  const author = String(message.from ?? message.authorId ?? '')
  const replyAuthor = String(reply.from ?? reply.authorId ?? reply.user_id ?? '')
  const text = htmlToPlainText(String(message.text ?? message.content ?? '')).trim()
  const replyText = htmlToPlainText(String(reply.text ?? reply.content ?? reply.body ?? '')).trim()
  const gap = Math.abs(Date.parse(message.createdAt) - Date.parse(reply.createdAt))
  return Boolean(
    text &&
    text === replyText &&
    (!author || !replyAuthor || author === replyAuthor) &&
    Number.isFinite(gap) &&
    gap < 2 * 60_000,
  )
}
function replyCopiesIn(list, parent, threadReplies) {
  const ids = []
  for (const reply of threadReplies ?? []) {
    if (reply?.id != null) ids.push(String(reply.id))
    for (const message of list) {
      if (sameAsReply(message, reply, parent.id)) ids.push(String(message.id))
    }
  }
  return ids
}
const knownThreadReplyIds = computed(() => {
  if (!conversation.value) return []
  const ids = []
  const list = allMessages.value
  for (const message of list) {
    if (!canThread(message)) continue
    ids.push(...replyCopiesIn(list, message, replies.repliesOf(replyTarget(message))))
  }
  return ids
})
watch(
  knownThreadReplyIds,
  (ids) => {
    if (ids.length && conversation.value) dms.markThreadReplies?.(conversation.value.id, ids)
  },
  { immediate: true },
)

// (naya) Reply Thread ki list (bhejte hi optimistic bhi) -> store ki thread summary (localStorage)
// Isse "N replies · Last reply" foran badalta hai aur reload ke baad bhi rehta hai.
const loadedThreads = computed(() => {
  if (!conversation.value) return []
  const out = []
  for (const message of allMessages.value) {
    if (!canThread(message)) continue
    const list = replies.repliesOf(replyTarget(message)) ?? []
    if (list.length) out.push({ parentId: String(message.id), list })
  }
  return out
})
watch(
  loadedThreads,
  (threads) => {
    if (!conversation.value) return
    for (const { parentId, list } of threads)
      dms.noteThreadReplies?.(conversation.value.id, parentId, list)
  },
  { immediate: true },
)

// (naya) DM: thread reply ka parent (backend jo bhi naam de)
function parentIdOf(message) {
  const id =
    message?.parentId ??
    message?.parent_id ??
    message?.parent_message_id ??
    message?.parentMessageId ??
    message?.thread_parent_id ??
    message?.reply_parent_id ??
    message?.reply_to_id ??
    message?.reply_to_message_id ??
    message?.thread_id
  return id == null || id === '' ? null : String(id)
}

// (naya) DM: yeh message kisi thread ka reply hai? (to main chat mein nahi, sirf card mein)
function isHiddenThreadReply(message) {
  if (!conversation.value || !message || message.scheduled) return false
  if (parentIdOf(message)) return true
  return knownThreadReplyIds.value.includes(String(message.id))
}

// ---------- (naya) Doosre user ki thread replies bhi dikhein ----------
// Backend message list mein replies_count na bheje to "1 reply" kabhi nahi aata tha (sirf jisne
// reply kiya usay pata tha). Khuli DM ke aakhri messages ki replies chupke se check karte hain.
// Backend replies_count bheje to yeh koi request nahi karta.
const REPLY_SCAN_EVERY_MS = 60_000 // har message ki replies zyada se zyada 1 dafa / minute
const REPLY_SCAN_LAST = 10
const replyScannedAt = new Map()
let replyScanTimer = null
let replyScanning = false
async function scanReplyCounts() {
  if (!conversation.value || replyScanning || (typeof document !== 'undefined' && document.hidden))
    return
  replyScanning = true
  try {
    const candidates = allMessages.value
      .filter((m) => m && !m.replyCount && canThread(m) && !isHiddenThreadReply(m)) // undefined ya 0
      // khula thread ThreadPanel khud poll karta hai: dobara request nahi
      .filter((m) => String(m.id) !== String(threadMessageId.value))
      .slice(-REPLY_SCAN_LAST)
    for (const message of candidates) {
      const key = `${conversation.value?.id}:${message.id}`
      if (Date.now() - (replyScannedAt.get(key) ?? 0) < REPLY_SCAN_EVERY_MS) continue
      replyScannedAt.set(key, Date.now())
      try {
        await replies.loadReplies(replyTarget(message), { force: true })
      } catch {
        /* agli dafa dobara */
      }
    }
  } finally {
    replyScanning = false
  }
}
watch(
  () => conversation.value?.id,
  (id) => {
    clearInterval(replyScanTimer)
    replyScanTimer = null
    if (id == null || typeof window === 'undefined') return
    void scanReplyCounts()
    replyScanTimer = window.setInterval(() => void scanReplyCounts(), REPLY_SCAN_EVERY_MS)
  },
  { immediate: true },
)
// naye message aaye to un ki replies bhi
watch(
  () => allMessages.value.at(-1)?.id,
  () => void scanReplyCounts(),
)
onBeforeUnmount(() => clearInterval(replyScanTimer))

// (naya) Jo messages kisi thread ke replies hain (Reply Thread card mein), woh main chat mein
// alag message ki tarah na aayein: store ko bata do, woh unhein chat se hata deta hai

// ---------- (naya) Channel mein forward kiye messages yaad rakho ----------
// Messages store forward ki maloomat (forwardedFrom) nahi rakhta, isliye bhejne wale ko bhi
// "(forwarded)" nahi dikhta tha. Yahan (localStorage mein) yaad rakhte hain, reload ke baad bhi.
const FORWARDED_KEY = 'whistleit:forwarded-messages'
function readForwarded() {
  try {
    const saved = JSON.parse(localStorage.getItem(FORWARDED_KEY) || '{}')
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}
const forwardedByChannel = ref(readForwarded())
function rememberForwarded(destinationId, sent, content) {
  const key = String(destinationId)
  const list = Array.isArray(forwardedByChannel.value[key])
    ? [...forwardedByChannel.value[key]]
    : []
  list.push({
    id: sent?.id != null ? String(sent.id) : null,
    text: htmlToPlainText(String(content ?? ''))
      .replace(FORWARD_TEXT_RE, '')
      .trim(),
    at: Date.parse(sent?.createdAt ?? sent?.created_at ?? '') || Date.now(),
  })
  forwardedByChannel.value = { ...forwardedByChannel.value, [key]: list.slice(-200) }
  try {
    localStorage.setItem(FORWARDED_KEY, JSON.stringify(forwardedByChannel.value))
  } catch {
    /* storage full */
  }
}
function isRememberedForward(key, message) {
  const list = forwardedByChannel.value[String(key)]
  if (!Array.isArray(list) || !message) return false
  const id = String(message.id)
  const text = htmlToPlainText(String(message.content ?? message.text ?? '')).trim()
  const at = Date.parse(message.createdAt)
  return list.some(
    (item) =>
      (item.id && item.id === id) ||
      (item.text === text.replace(FORWARD_TEXT_RE, '') &&
        Number.isFinite(at) &&
        Math.abs(at - item.at) < 10 * 60_000),
  )
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
function htmlToPlainText(value) {
  if (typeof value !== 'string' || !value) return value
  let text = value
  if (!HTML_TAG.test(text) && /&lt;\/?[a-z]/i.test(text)) text = decodeEntities(text)
  if (!HTML_TAG.test(text)) return value
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------- (naya) ⋯ menu / emoji picker: neeche jagah na ho to UPAR khule ----------
const flipUpId = ref(null)
watch(
  [openMenuId, openReactionId],
  async ([menuId, reactionId]) => {
    const id = menuId ?? reactionId
    if (id == null) {
      flipUpId.value = null
      return
    }
    await nextTick()
    const container = messagesContainer.value
    const safeId = String(id).replace(/["\\]/g, '\\$&')
    const article = container?.querySelector(`[data-message-id="${safeId}"]`)
    const toolbar = article?.querySelector('.composer-conversation__action-toolbar')
    if (!container || !toolbar) {
      flipUpId.value = null
      return
    }
    // Card ki asli unchai naap kar (zoom / font size par bhi sahi): neeche poora na aaye to upar
    const panel = article.querySelector(
      menuId != null ? '.composer-conversation__menu' : '.composer-conversation__reaction-picker',
    )
    const box = container.getBoundingClientRect()
    const bar = toolbar.getBoundingClientRect()
    const needed = (panel?.offsetHeight || (menuId != null ? 380 : 340)) + 16
    // Chat box ya browser window, jo pehle khatam ho (dono ke andar poora dikhna chahiye)
    const bottomLimit = Math.min(box.bottom, window.innerHeight || box.bottom)
    const below = bottomLimit - bar.bottom
    const above = bar.top - Math.max(box.top, 0)
    flipUpId.value = below < needed && above > below ? id : null
  },
  { flush: 'post' },
)
const threadMessage = computed(() => {
  if (!conversation.value) return channelThreadMessage.value
  return threadMessageId.value != null
    ? allMessages.value.find((item) => item.id === threadMessageId.value) || null
    : null
})
// Thread wala message delete ho jaye, ya doosri conversation khule, to panel band
watch(threadMessage, (message) => {
  if (!message && conversation.value) threadMessageId.value = null
})
watch(
  () => `${props.conversationType}:${props.conversationId}`,
  () => {
    threadMessageId.value = null
    channelThreadMessage.value = null
  },
)
// Emoji picker khula ho to store ko batao: picker se wahi emoji dobara chunne par hatao mat
watch(openReactionId, (id) => dms.setReactionPicker?.(id), { flush: 'sync' })

// (naya) Edit box: Enter = Save, Shift+Enter = nayi line, Esc = Cancel
function onEditKeydown(event) {
  if (editingId.value == null) return
  const target = event.target
  if (
    !(target instanceof HTMLTextAreaElement) ||
    target.getAttribute('aria-label') !== 'Edit message'
  )
    return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
    return
  }
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  const message = allMessages.value.find((item) => item.id === editingId.value)
  if (message) saveEdit(message)
}
onMounted(() => document.addEventListener('keydown', onEditKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onEditKeydown))

// (naya) DM pagination: 20-30 naye messages aane par purane screen se na hatein
let lastDmKey = ''
let lastDmCount = 0
let growingForNewMessages = false
watch(
  () => [conversation.value?.id ?? '', allMessages.value.length],
  ([id, count]) => {
    if (!conversation.value) {
      lastDmKey = ''
      return
    }
    if (id === lastDmKey && count > lastDmCount) {
      growingForNewMessages = true
      dmVisibleCount.value += count - lastDmCount // dikhne wali "window" bhi utni badhao
    }
    lastDmKey = id
    lastDmCount = count
  },
)
// "Load older messages" (20 aur): upar jud kar screen apni jagah rahe, koode nahi
watch(
  dmVisibleCount,
  (next, previous) => {
    const container = messagesContainer.value
    const forNew = growingForNewMessages
    growingForNewMessages = false
    if (!conversation.value || !container || forNew || next <= previous) return
    const height = container.scrollHeight
    const top = container.scrollTop
    nextTick(() => {
      container.scrollTop = top + container.scrollHeight - height
    })
  },
  { flush: 'pre' },
)
// Apne paas ke sab dikh gaye aur server par aur purane hain: GET .../messages?page=N
const dmCanLoadOlderFromServer = computed(
  () =>
    Boolean(conversation.value) &&
    !hasOlderMessages.value &&
    Boolean(dms.hasMoreOlder?.(conversation.value.id)),
)
// (naya) Upar scroll karte hi purane messages khud (button dabane ki zaroorat nahi)
let autoLoading = false
async function onMessagesScroll() {
  const container = messagesContainer.value
  if (!conversation.value || !container || autoLoading || container.scrollTop > 80) return
  autoLoading = true
  try {
    if (hasOlderMessages.value) loadOlder()
    else if (dmCanLoadOlderFromServer.value) await loadOlderFromServer()
  } finally {
    setTimeout(() => {
      autoLoading = false
    }, 300)
  }
}
watch(
  messagesContainer,
  (element, previous) => {
    previous?.removeEventListener('scroll', onMessagesScroll)
    element?.addEventListener('scroll', onMessagesScroll, { passive: true })
  },
  { immediate: true },
)
onBeforeUnmount(() => messagesContainer.value?.removeEventListener('scroll', onMessagesScroll))

async function loadOlderFromServer() {
  const container = messagesContainer.value
  const height = container?.scrollHeight || 0
  const top = container?.scrollTop || 0
  const added = await dms.loadOlderMessages(conversation.value.id)
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0)) // purana "neeche scroll" pehle ho le
  if (container && added) container.scrollTop = top + container.scrollHeight - height
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
    loadScheduledMessages()
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
  if (!canSendMessages.value) {
    ui.toast('Message not sent', 'You do not have permission to post in this channel.', 'error')
    return
  }

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
  if (!canSendMessages.value) {
    ui.toast(
      'Message not scheduled',
      'You do not have permission to post in this channel.',
      'error',
    )
    return
  }

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

async function confirmMessageDeletion() {
  const message = deleteTarget.value
  if (!message || deletingMessage.value) return

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
    deletingMessage.value = true
    try {
      const result = await messageStore.deleteServerMessage(channelId.value, message.id)
      if (!result.success) {
        ui.toast(
          'Message not deleted',
          result.error || 'The channel message could not be deleted.',
          'error',
        )
        return
      }
      deleted = true
    } catch (error) {
      ui.toast(
        'Message not deleted',
        error.message || 'The channel message could not be deleted.',
        'error',
      )
      return
    } finally {
      deletingMessage.value = false
    }
  } else {
    deleted = messageStore.deleteMessage(channelId.value, message.id, deleteAt)
  }
  if (!deleted) {
    ui.toast('Message not deleted', 'Only your unscheduled messages can be deleted.', 'error')
    return
  }
  // (naya) Sirf schedule hua hai: abhi pin / search se mat hatao
  if (deleteAt && conversation.value) {
    deleteTarget.value = null
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
  // (naya) Reply = side par "Reply Thread" card + message ke neeche "1 reply · Last reply".
  // Jo message abhi server par nahi (local / scheduled), uska purana quote wala reply.
  if (canThread(message)) {
    openThread(message)
    return
  }
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
    ...(conversation.value ? { forwardedFromMessageId: forwardTarget.value.id } : {}), // (naya) DM: backend forwarded_from_message_id
    ...(forwardTarget.value.attachments?.length
      ? { attachments: forwardTarget.value.attachments }
      : {}),
    ...(forwardTarget.value.gif ? { gif: forwardTarget.value.gif } : {}),
  }
  // Forward HTML/plain-text payloads in the same format as regular messages.
  if (typeof payload.content === 'string') payload.content = htmlToPlainText(payload.content)
  if (destination.type !== 'dm') delete payload.forwardedFromMessageId
  if (destination.type !== 'dm' && payload.content) {
    payload.content = `${FORWARD_TEXT_PREFIX}${payload.content.replace(FORWARD_TEXT_RE, '')}`
  }

  if (!conversation.value) {
    if (!forwardTarget.value.serverBacked) {
      ui.toast(
        'Unable to forward message',
        'Wait until the message is sent, then try again.',
        'error',
      )
      return
    }

    let destinationPayload
    if (destination.type === 'channel') {
      try {
        let { items, total } = await listMembers(destination.id, { limit: 100 })
        if (items.length < total) {
          const completeList = await listMembers(destination.id, { limit: total })
          items = completeList.items
          total = completeList.total
        }
        const memberIds = [...new Set(items.map((member) => String(member.id)).filter(Boolean))]
        if (memberIds.length < total) {
          throw new Error('The destination channel member list is incomplete.')
        }
        const senderId = getAuthUserId() ?? dms.meId
        destinationPayload = {
          channel_ids: [destination.id],
          user_ids: memberIds.filter((memberId) => String(memberId) !== String(senderId)),
        }
      } catch (error) {
        ui.toast(
          'Unable to forward message',
          error?.message || 'Could not load the destination channel members.',
          'error',
        )
        return
      }
    } else {
      destinationPayload = {
        user_ids: (
          dms.conversations.find((item) => String(item.id) === String(destination.id))?.members ??
          []
        ).filter((memberId) => String(memberId) !== String(dms.meId)),
      }
    }
    if (!destinationPayload.user_ids?.length) {
      ui.toast('Unable to forward message', 'The destination has no available recipients.', 'error')
      return
    }

    const result = await forwardChannelMessage(
      teamsStore.activeWorkspaceId,
      teamsStore.activeTeamId,
      channelId.value,
      forwardTarget.value.id,
      destinationPayload,
    )
    if (!result.success) {
      ui.toast(
        'Unable to forward message',
        result.error || 'The channel message could not be forwarded.',
        'error',
      )
      return
    }
    if (destination.type === 'channel') {
      await messageStore.fetchChannelMessages(destination.id)
    } else {
      await dms.loadMessages(destination.id, { force: true })
    }
  } else if (destination.type === 'dm') {
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
    rememberForwarded(destination.id, forwarded, payload.content) // (naya) "(forwarded)" neeche
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
  menuAnchor.value = null
  actionMenuPosition.value = {}
}

function positionActionMenu() {
  const anchor = menuAnchor.value
  const menu = Array.isArray(actionMenu.value) ? actionMenu.value[0] : actionMenu.value
  if (!anchor || !menu || openMenuId.value == null) return

  const anchorRect = anchor.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight
  const margin = 8
  const gap = 6
  const width = Math.max(0, Math.min(224, viewportWidth - margin * 2))
  const height = menuRect.height || menu.scrollHeight || 260
  const spaceAbove = Math.max(0, anchorRect.top - gap - margin)
  const spaceBelow = Math.max(0, viewportHeight - anchorRect.bottom - gap - margin)
  const placeAbove = height <= spaceAbove || spaceAbove >= spaceBelow
  const availableHeight = placeAbove ? spaceAbove : spaceBelow
  const displayedHeight = Math.min(height, availableHeight)
  const left = Math.max(margin, Math.min(anchorRect.right - width, viewportWidth - width - margin))
  const top = placeAbove
    ? Math.max(margin, anchorRect.top - gap - displayedHeight)
    : Math.min(viewportHeight - margin - displayedHeight, anchorRect.bottom + gap)

  actionMenuPosition.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${width}px`,
    maxHeight: `${displayedHeight}px`,
  }
}

function toggleMessageMenu(event, message) {
  if (openMenuId.value === message.id) {
    closeMessageActions()
    return
  }

  openReactionId.value = null
  openMenuId.value = message.id
  menuAnchor.value = event.currentTarget
  nextTick(positionActionMenu)
}

function closeActionsOnOutsideClick(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement
  if (!target?.closest('.composer-conversation__actions')) closeMessageActions()
}

function pollQueryParams(poll, key) {
  return poll[key] || { poll_id: poll.id }
}

function pollResultQueryParams(poll) {
  return {
    ...(pollQueryParams(poll, 'resultsQueryParams') || {}),
    channel_id: channelId.value,
    poll_id: poll.id,
  }
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
  const payload = response?.data ?? response
  const result = payload?.result ?? payload?.results ?? payload
  const sourceQuestions = Array.isArray(result)
    ? result
    : Array.isArray(result?.questions)
      ? result.questions
      : Array.isArray(result?.poll_questions)
        ? result.poll_questions
        : Array.isArray(result?.results)
          ? result.results
          : result?.answers
            ? [result]
            : []
  if (!sourceQuestions.length && !result?.totalVotes && !result?.total_votes && !result?.total) {
    return null
  }
  const legacyResponses = result?.responses ?? payload?.responses
  const responseQuestions = pollQuestionsFromResponse(sourceQuestions)
  const pollQuestions =
    Array.isArray(poll?.questions) && poll.questions.length ? poll.questions : responseQuestions
  const questions = pollQuestions.map((question, questionIndex) => {
    const questionId = question.id ?? question.question_id
    const source =
      sourceQuestions.find(
        (item) =>
          item && questionId != null && String(item.id ?? item.question_id) === String(questionId),
      ) ||
      sourceQuestions[questionIndex] ||
      {}
    const sourceVotes = source.votes ?? source.answers ?? source.options ?? []
    const sourceResponses =
      source.responses ?? (question.type === 'openEnded' ? source.answers : null)
    const responses = Array.isArray(sourceResponses)
      ? sourceResponses
          .map((item) =>
            typeof item === 'string'
              ? item
              : (item?.answer ?? item?.response ?? item?.text ?? item?.value),
          )
          .filter((item) => typeof item === 'string' && item.trim())
      : Array.isArray(legacyResponses?.[questionIndex])
        ? legacyResponses[questionIndex]
        : []
    return {
      votes: (Array.isArray(question.options) ? question.options : []).map((_, optionIndex) => {
        const vote = sourceVotes[optionIndex]
        return typeof vote === 'number'
          ? vote
          : Number(
              vote?.votes ??
                vote?.count ??
                vote?.total ??
                vote?.total_votes ??
                (Array.isArray(vote?.users) ? vote.users.length : null) ??
                vote ??
                0,
            )
      }),
      responses,
    }
  })
  return {
    totalVotes: Number(
      result?.totalVotes ??
        result?.total_votes ??
        result?.total ??
        payload?.pagination?.total ??
        sourceQuestions[0]?.total_votes ??
        0,
    ),
    questions,
    pollQuestions,
    responses: questions.map((question, index) =>
      question.responses.length ? question.responses : (legacyResponses?.[index] ?? []),
    ),
  }
}

function removePublishedDraft(targetChannelId, existingMessage, targetConversation) {
  if (!existingMessage) return
  const messages = targetConversation
    ? targetConversation.messages
    : messageStore.messagesByChannel[String(targetChannelId)] || []
  const index = messages.findIndex((message) => String(message.id) === String(existingMessage.id))
  if (index !== -1) messages.splice(index, 1)
}

async function sendPollMessage(targetChannelId, poll, existingMessage = null) {
  const targetConversation = dms.conversations.find(
    (item) => String(item.id) === String(targetChannelId),
  )
  if (targetConversation) {
    const message = dms.sendMessage(targetConversation.id, {
      content: poll.title,
      poll_id: poll.id,
      poll,
    })
    if (!message) throw new Error('The poll message could not be added to this conversation.')
    message.poll = poll
    message.poll_id = poll.id
    removePublishedDraft(targetChannelId, existingMessage, targetConversation)
    return message
  }

  const result = await messageStore.postChannelMessage(targetChannelId, {
    content: poll.title,
    poll_id: poll.id,
  })
  if (!result.success) {
    throw new Error(result.error || 'The poll message could not be sent to the channel.')
  }

  const responseMessageId = result.data?.id ?? result.data?.message_id ?? result.data?.messageId
  const channelMessages = messageStore.messagesFor(targetChannelId)
  let message =
    responseMessageId == null
      ? channelMessages.find((item) => String(item.poll_id ?? '') === String(poll.id))
      : channelMessages.find((item) => String(item.id) === String(responseMessageId))
  if (!message && responseMessageId != null) {
    message = {
      ...result.data,
      id: String(responseMessageId),
      content: result.data.content ?? result.data.body ?? poll.title,
      author: result.data.author || currentUserName.value,
      authorId: result.data.authorId ?? dms.meId,
      mine: true,
      createdAt: result.data.createdAt || new Date().toISOString(),
    }
    channelMessages.push(message)
  }
  if (!message) throw new Error('The server did not return the poll message ID.')
  message.content ||= poll.title
  message.text ||= poll.title
  message.poll_id = poll.id
  message.poll = poll
  message.mine = true
  removePublishedDraft(targetChannelId, existingMessage, null)
  ui.addPoll(message, conversationMeta.value)
  addMockMessage({
    id: message.id,
    text: message.content,
    sender: message.author,
    conversation: conversationMeta.value,
  })
  return message
}

async function createPollInChannel(targetChannelId, pollDraft, existingMessage = null) {
  if (!canSendMessages.value) {
    ui.toast('Poll not created', 'You do not have permission to post in this channel.', 'error')
    return null
  }

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
    if (existingMessage) {
      existingMessage.poll = poll
    }
    await sendPollMessage(targetChannelId, poll, existingMessage)
    await scrollMessagesToLatest()
    return poll
  } catch (error) {
    ui.toast(
      'Poll not sent',
      error.message || 'The poll was created but its message could not be sent.',
      'error',
    )
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

function hasAlreadyVoted(poll) {
  return (
    participatedPolls.value.has(String(poll?.id)) ||
    Boolean(poll?.alreadyVoted ?? poll?.already_voted ?? poll?.user_has_voted)
  )
}

async function participateInPoll(pollId) {
  if (pollApi.loading.value || !hasServerPollId({ id: pollId })) return
  const message = renderedMessages.value.find((item) => item.poll?.id === pollId)
  if (!message?.poll || hasAlreadyVoted(message.poll) || !isPollActive(message.poll)) return
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
    message.poll.status = 'Closed'
    ui.addPoll(message, conversationMeta.value)
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
    const response = await pollApi.getPollResult(pollResultQueryParams(message.poll))
    const result = normalizePollResult(response, message.poll)
    if (result) {
      if (result.pollQuestions.length) {
        message.poll.questions = result.pollQuestions
        activePoll.value = { ...message.poll, questions: result.pollQuestions }
      }
      pollResults.value = { ...pollResults.value, [pollId]: result }
    }
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
  participatedPolls.value = new Set([...participatedPolls.value, String(poll.id)])
  localStorage.setItem(pollParticipationStorageKey, JSON.stringify([...participatedPolls.value]))
  closePollResponse()
  try {
    const response = await pollApi.getPollResult(pollResultQueryParams(poll))
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
  document.addEventListener('scroll', positionActionMenu, true)
  window.addEventListener('resize', positionActionMenu)
  pollClockTimer = window.setInterval(() => {
    pollClock.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeActionsOnOutsideClick)
  document.removeEventListener('scroll', positionActionMenu, true)
  window.removeEventListener('resize', positionActionMenu)
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
      <!-- (naya) Server se purane messages (GET .../messages?page=N) -->
      <button
        v-else-if="dmCanLoadOlderFromServer"
        type="button"
        class="composer-conversation__load-older"
        data-test="load-older-server"
        :disabled="dms.isLoadingOlder(conversation.id)"
        @click="loadOlderFromServer"
      >
        {{
          dms.isLoadingOlder(conversation.id) ? 'Loading older messages...' : 'Load older messages'
        }}
      </button>
      <!-- (naya) Internet nahi -->
      <p v-if="conversation && !isOnline" class="composer-conversation__offline" role="status">
        You're offline. New messages, edits and reactions will sync when you reconnect.
      </p>
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
          <!-- (naya) DM: din ki pill "Today" / "Yesterday" / "Oct 14, 2026" (purana label CSS se chhupta hai) -->
          <span v-if="conversation" class="composer-conversation__dm-date">{{
            dayLabel(message.createdAt)
          }}</span>
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
            <!-- (naya) Online (hara) / Away (peela) / Offline (grey): live, sirf DM -->
            <PresenceDot
              v-if="presenceUserId(message)"
              class="composer-conversation__presence"
              :state="presence.stateOf(presenceUserId(message))"
              ring="border-white"
              :size="11"
            />
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
              <TimeAgo
                v-if="conversation && message.createdAt"
                class="composer-conversation__dm-time"
                :value="message.createdAt"
              />
              <time
                v-else
                :datetime="message.createdAt"
                :data-time-tooltip="message.fullTime"
                :aria-label="message.fullTime"
                tabindex="0"
              >
                {{ message.time }}
              </time>
              <span v-if="message.editedAt" class="composer-conversation__edited">(edited)</span>
              <span v-if="isPinned(message)" class="composer-conversation__pinned">PINNED</span>
            </header>

            <div
              class="composer-conversation__message-bubble"
              :class="{ 'composer-conversation__message-bubble--deleted': message.deleted }"
              :data-poll-id="message.poll?.id"
              :data-poll-title="
                message.poll?.title ??
                message.poll?.question ??
                message.poll_title ??
                message.pollTitle ??
                message.content?.match(/^Poll:\s*(.+)$/m)?.[1]?.trim()
              "
              @click="handleMessageClick($event, message)"
              @dblclick="handleMessageDoubleClick($event, message)"
            >
              <template v-if="!message.deleted">
                <!-- (naya) DM + channel: upar wala "Forwarded from" chhupao, neeche "(forwarded)" -->
                <span
                  v-if="message.forwardedFrom"
                  class="composer-conversation__dm-forward-marker"
                  hidden
                />
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
                  :closed="isPollClosed(message.poll)"
                  :scheduled="isPollScheduled(message.poll)"
                  :already-voted="hasAlreadyVoted(message.poll)"
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
                  <button
                    v-if="conversation"
                    type="button"
                    class="composer-conversation__inline-link"
                    @click.stop="cancelScheduledDelete(message)"
                  >
                    Cancel
                  </button>
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
                  <!-- (naya) DM: ☺+ se aur reaction (maujooda emoji picker khulta hai) -->
                  <button
                    v-if="conversation"
                    type="button"
                    class="composer-conversation__reaction-add"
                    aria-label="Add reaction"
                    title="Add reaction"
                    @click.stop="openReactionId = openReactionId === message.id ? null : message.id"
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
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
              </template>
              <p v-else class="composer-conversation__deleted-message">(message deleted)</p>
              <!-- (naya) "(forwarded)" message ke neeche -->
              <span
                v-if="message.forwardedFrom && !message.deleted"
                class="composer-conversation__forwarded composer-conversation__forwarded-below"
                >(forwarded)</span
              >
              <!-- (naya) offline mein edit / delete / reaction: internet aate hi sync -->
              <span
                v-if="message.syncPending"
                class="composer-conversation__sync-pending"
                title="Saved on this device. Will sync when the connection is back."
                >◷ Waiting for connection</span
              >
              <span
                v-if="message.editedAt && !message.deleted"
                :class="'composer-conversation__edited-below'"
                class="composer-conversation__edited"
                >(edited)</span
              >
            </div>

            <ReplySummary
              v-if="canThread(message)"
              class="composer-conversation__reply-summary"
              :count="replyCountOf(message)"
              :last-reply-at="lastReplyAtOf(message)"
              @open="openThread(message)"
            />
            <button
              v-else-if="!conversation && message.replySummary.count > 0"
              type="button"
              class="composer-conversation__thread-summary"
              :aria-label="`${message.replySummary.count} ${message.replySummary.count === 1 ? 'reply' : 'replies'}${message.replySummary.lastReplyLabel ? `, last reply ${message.replySummary.lastReplyLabel}` : ''}`"
              @click="openThread(message)"
            >
              <span>
                {{ message.replySummary.count }}
                {{ message.replySummary.count === 1 ? 'reply' : 'replies' }}
              </span>
              <span v-if="message.replySummary.lastReplyLabel">
                Last reply: {{ message.replySummary.lastReplyLabel }}
              </span>
            </button>

            <div
              v-if="!message.deleted"
              class="composer-conversation__actions"
              :class="{ 'composer-conversation__actions--up': flipUpId === message.id }"
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
                  @click="toggleMessageMenu($event, message)"
                >
                  ⋯
                </button>
              </div>
              <div
                v-if="openMenuId === message.id"
                ref="actionMenu"
                class="composer-conversation__menu"
                :style="actionMenuPosition"
              >
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
                <button type="button" @click="openThread(message)">
                  <span aria-hidden="true">↳</span>
                  <span>View replies</span>
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
      :company-id="teamsStore.activeWorkspaceId"
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

    <!-- (naya) Daayein taraf "Reply Thread" (DM replies API, polling se live) -->
    <aside v-if="conversation && threadMessage" class="composer-conversation__thread">
      <ThreadPanel
        :message="threadMessage"
        :channel-id="String(conversation.id)"
        @close="threadMessageId = null"
      />
    </aside>

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
            <button
              type="button"
              class="is-delete"
              :disabled="deletingMessage"
              @click="confirmMessageDeletion"
            >
              {{ deletingMessage ? 'Deleting…' : 'Delete' }}
            </button>
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

    <div v-if="!conversation && threadMessage" class="composer-conversation__thread-overlay">
      <ThreadPanel
        :message="threadMessage"
        :channel-id="channelId"
        :team-id="conversation ? null : teamsStore.activeTeamId"
        @close="channelThreadMessage = null"
      />
    </div>
  </section>
</template>

<style scoped>
.composer-conversation {
  position: relative;
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

.composer-conversation__thread-summary {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 12px;
  margin: 4px 0 0;
  border: 0;
  border-radius: 0 0 4px 4px;
  background: #eceef6;
  padding: 3px 10px 6px;
  color: #777b8d;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}

.composer-conversation__thread-summary span:first-child {
  color: #4c52c8;
}

.composer-conversation__thread-summary:hover span:first-child {
  text-decoration: underline;
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

.composer-conversation__message-heading time {
  position: relative;
}

.composer-conversation__message-heading time::after {
  position: absolute;
  z-index: 20;
  bottom: calc(100% + 8px);
  left: 50%;
  width: max-content;
  max-width: min(320px, 80vw);
  border-radius: 4px;
  background: #30313a;
  padding: 6px 9px;
  color: #fff;
  content: attr(data-time-tooltip);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 3px);
  transition:
    opacity 120ms ease,
    transform 120ms ease;
  visibility: hidden;
}

.composer-conversation__message-heading time:hover::after,
.composer-conversation__message-heading time:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
  visibility: visible;
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
  z-index: 1000;
  display: grid;
  width: 224px;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 5px;
  border: 1px solid #e6e7ed;
  border-radius: 7px;
  background: white;
  box-shadow: 0 8px 24px #14141f2e;
  overscroll-behavior: contain;
}

.composer-conversation__menu button {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  gap: 7px;
  padding: 8px;
  border-radius: 4px;
  color: #303044;
  text-align: left;
  cursor: pointer;
}

.composer-conversation__menu button > span:nth-child(2) {
  min-width: 0;
  overflow-wrap: anywhere;
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

.composer-conversation__menu .composer-conversation__shortcuts {
  flex-shrink: 0;
  white-space: nowrap;
}

.composer-conversation__thread-overlay {
  position: absolute;
  z-index: 30;
  inset: 0 0 0 auto;
  width: min(390px, 100%);
  border-left: 1px solid #e1e3eb;
  background: #fff;
  box-shadow: -8px 0 24px #14141f1f;
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

<!-- (naya) DM: online dot, waqt, reactions ☺+, replies, Reply Thread.
     Upar wale purane styles ko chheda nahi gaya. -->
<style scoped>
.composer-conversation__avatar {
  position: relative;
}

.composer-conversation__presence {
  position: absolute;
  right: -3px;
  bottom: -3px;
}

/* DM mein naya "3 days ago" dikhta hai, uske foran baad wala purana time chhupta hai */
.composer-conversation__dm-time + time {
  display: none;
}

/* DM: upar wala "Forwarded from …" chhupa, neeche "(forwarded)" */
.composer-conversation__dm-forward-marker + .composer-conversation__forwarded {
  display: none;
}

/* DM: din ki pill (purana label chhupa) */
.composer-conversation__dm-date + span {
  display: none;
}

.composer-conversation__dm-date {
  padding: 4px 16px;
  border: 1px solid #dfe2ea;
  border-radius: 999px;
  background: white;
  color: #2f3142;
  font-size: 13px;
  font-weight: 500;
}

/* DM: "(edited)" upar naam ke saath nahi, message ke neeche */
.composer-conversation__dm-time ~ .composer-conversation__edited {
  display: none;
}

.composer-conversation__edited-below {
  display: block;
  margin-top: 6px;
}

.composer-conversation__reaction-add {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: #6b7085;
}

.composer-conversation__reaction-add svg {
  width: 15px;
  height: 15px;
}

.composer-conversation__reply-summary {
  margin: 4px 0 0 -8px;
}

/* (naya) */
.composer-conversation__forwarded-below {
  margin: 6px 0 0;
}

.composer-conversation__sync-pending {
  display: block;
  margin-top: 4px;
  color: #a3730a;
  font-size: 11px;
}

.composer-conversation__offline {
  margin: 0 0 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #fff7e6;
  color: #8a5a00;
  font-size: 12px;
  text-align: center;
}

.composer-conversation__inline-link {
  margin-left: 6px;
  color: #5552c7;
  text-decoration: underline;
  cursor: pointer;
}

/* (naya) ⋯ menu / emoji picker aakhri messages par upar khulein (composer ke peeche na katein) */
.composer-conversation__actions--up {
  z-index: 30;
}

.composer-conversation__actions--up .composer-conversation__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  margin-top: 0;
}

.composer-conversation__actions--up .composer-conversation__reaction-picker {
  top: auto;
  bottom: calc(100% + 6px);
}

/* Menu ya picker khula ho to toolbar dikhta rahe aur dusre messages ke upar rahe */
.composer-conversation__actions:has(.composer-conversation__menu),
.composer-conversation__actions:has(.composer-conversation__reaction-picker) {
  z-index: 30;
}

.composer-conversation__actions:has(.composer-conversation__menu)
  .composer-conversation__action-toolbar,
.composer-conversation__actions:has(.composer-conversation__reaction-picker)
  .composer-conversation__action-toolbar {
  opacity: 1;
}

.composer-conversation__actions {
  right: 8px;
}

/* (naya) ⋯ menu ka UI */
.composer-conversation__menu {
  min-width: 210px;
  margin-top: 6px;
  padding: 6px;
  border: 1px solid #e3e4ec;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 12px 32px rgb(20 20 31 / 16%);
}

.composer-conversation__menu button {
  width: 100%;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  color: #2f3142;
  font-size: 14px;
  line-height: 18px;
}

.composer-conversation__menu button:hover {
  background: #f1f0fa;
}

.composer-conversation__menu button svg {
  width: 18px;
  height: 18px;
  color: #5b5e73;
}

.composer-conversation__menu .composer-conversation__delete-action,
.composer-conversation__menu .composer-conversation__delete-action svg {
  color: #c92f43;
}

.composer-conversation__menu .composer-conversation__delete-action:hover {
  background: #fdecee;
}

.composer-conversation__menu .composer-conversation__shortcuts kbd {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #eef0f6;
  color: #4a4c60;
  font-size: 10px;
  line-height: 16px;
}

/* Reply Thread: daayein taraf panel */
.composer-conversation__thread {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  width: min(440px, 100vw);
  border-left: 1px solid #e4e6ed;
  background: white;
  box-shadow: -8px 0 24px rgb(37 38 58 / 12%);
}
</style>
