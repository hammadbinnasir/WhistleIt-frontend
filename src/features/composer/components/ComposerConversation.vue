<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import { useChannelsStore } from '@/features/channels'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMessagesStore } from '@/features/messages/messages'
import {
  createLinkPreview,
  dateLabel,
  messageSegments,
  sameDay,
  timeLabel,
} from '@/features/messages/message-utils'
import { useUiStore } from '@/stores/ui'
import { addMockMessage, removeMockMessage, updateMockMessage } from '@/features/search/search'
import SetReminderModal from '@/features/search/SetReminderModal.vue'
import MessageComposer from './MessageComposer.vue'

const props = defineProps({
  conversationId: { type: [String, Number], default: null },
  conversationType: { type: String, default: 'channel' },
})

const dms = useDmStore()
const channelsStore = useChannelsStore()
const ui = useUiStore()
const messageStore = useMessagesStore()
const messagesContainer = ref(null)
const editingId = ref(null)
const editDraft = ref('')
const replyTo = ref(null)
const openMenuId = ref(null)
const openReactionId = ref(null)
const reminderTarget = ref(null)
const forwardTarget = ref(null)
const forwardDestinationId = ref('')
const dmVisibleCount = ref(20)

const channelId = computed(() => String(props.conversationId || 'general'))
const conversation = computed(() =>
  props.conversationType === 'dm'
    ? dms.conversations.find((item) => item.id === String(props.conversationId)) || null
    : null,
)
const conversationLabel = computed(() =>
  conversation.value ? dms.titleOf(conversation.value) : channelId.value.replaceAll('-', ' '),
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
const visibleMessages = computed(() =>
  conversation.value
    ? allMessages.value.slice(-dmVisibleCount.value)
    : messageStore.visibleMessagesFor(channelId.value),
)
const renderedMessages = computed(() => {
  const currentUser = dms.usersById[dms.meId]?.name || 'You'
  let previous = null

  return [...visibleMessages.value]
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((message) => {
      const content = message.text ?? message.content ?? ''
      const author =
        message.from === dms.meId
          ? currentUser
          : message.from
            ? dms.usersById[message.from]?.name || conversationLabel.value
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
          ? typeof message.replyTo === 'object'
            ? message.replyTo
            : allMessages.value.find((item) => item.id === message.replyTo)
          : null,
        reactions: message.reactions || [],
      }
      previous = rendered
      return rendered
    })
})
const reminderMessage = computed(() => {
  if (!reminderTarget.value) return null
  return {
    conversationId: channelId.value,
    conversationName: conversationLabel.value,
    conversationType: props.conversationType,
    messageId: String(reminderTarget.value.id),
    text: reminderTarget.value.text ?? reminderTarget.value.content ?? '',
  }
})

watch(
  () => `${props.conversationType}:${props.conversationId}`,
  () => {
    dmVisibleCount.value = 20
    editingId.value = null
    replyTo.value = null
    openMenuId.value = null
    openReactionId.value = null
    reminderTarget.value = null
    forwardTarget.value = null
    nextTick(scrollMessagesToLatest)
  },
)

watch(
  () => allMessages.value.length,
  (count, previousCount) => {
    if (count > previousCount) scrollMessagesToLatest()
  },
)

function isPinned(message) {
  return ui.pinnedMessages.some(
    (item) =>
      String(item.id) === String(message.id) &&
      String(item.conversation?.id ?? '') === conversationMeta.value.id,
  )
}

function togglePin(message) {
  ui.togglePinnedMessage(message, conversationMeta.value)
}

function addMessage(payload) {
  const messagePayload = replyTo.value ? { ...payload, replyTo: { ...replyTo.value } } : payload
  const sentMessage = conversation.value
    ? dms.sendMessage(conversation.value.id, messagePayload)
    : messageStore.sendMessage(
        channelId.value,
        messagePayload,
        dms.usersById[dms.meId]?.name || 'You',
      )
  if (!sentMessage) {
    ui.toast('Message not sent', 'The conversation could not be found.', 'error')
    return
  }
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
  const scheduledMessage = conversation.value
    ? dms.sendMessage(conversation.value.id, message)
    : messageStore.sendMessage(
        channelId.value,
        message,
        dms.usersById[dms.meId]?.name || 'You',
      )
  if (!scheduledMessage) {
    ui.toast('Message not scheduled', 'The conversation could not be found.', 'error')
    return
  }
  scrollMessagesToLatest()
}

function addGif(gif) {
  const message = { content: '', gif }
  const sentMessage = conversation.value
    ? dms.sendMessage(conversation.value.id, message)
    : messageStore.sendMessage(
        channelId.value,
        message,
        dms.usersById[dms.meId]?.name || 'You',
      )
  if (!sentMessage) {
    ui.toast('GIF not sent', 'The conversation could not be found.', 'error')
    return
  }
  scrollMessagesToLatest()
}

function loadOlder() {
  if (conversation.value) {
    dmVisibleCount.value += 20
    return
  }
  const container = messagesContainer.value
  const previousHeight = container?.scrollHeight || 0
  const previousTop = container?.scrollTop || 0
  messageStore.loadOlder(channelId.value)
  nextTick(() => {
    if (container) container.scrollTop = previousTop + container.scrollHeight - previousHeight
  })
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

function saveEdit(message) {
  if (!editDraft.value.trim()) {
    ui.toast('Message not updated', 'A message cannot be empty.', 'error')
    return
  }
  const updated = conversation.value
    ? dms.editMessage(conversation.value.id, message.id, editDraft.value)
    : messageStore.editMessage(channelId.value, message.id, editDraft.value)
  if (!updated) {
    ui.toast('Message not updated', 'Only your unscheduled messages can be edited.', 'error')
    return
  }
  if (!conversation.value) updateMockMessage(message.id, editDraft.value.trim())
  cancelEdit()
}

function deleteMessage(message) {
  openMenuId.value = null
  if (!window.confirm('Delete this message? This cannot be undone.')) return
  const deleted = conversation.value
    ? dms.deleteMessage(conversation.value.id, message.id)
    : messageStore.deleteMessage(channelId.value, message.id)
  if (!deleted) {
    ui.toast('Message not deleted', 'Only your unscheduled messages can be deleted.', 'error')
    return
  }
  if (!conversation.value) removeMockMessage(message.id)
  if (isPinned(message)) ui.togglePinnedMessage(message, conversationMeta.value)
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

function openForwardDialog(message) {
  forwardTarget.value = message
  openMenuId.value = null
  forwardDestinationId.value =
    forwardDestinations.value.find((destination) => destination.id !== channelId.value)?.id || ''
}

function forwardMessage() {
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
  const forwarded =
    destination.type === 'dm'
      ? dms.sendMessage(destination.id, payload)
      : messageStore.sendMessage(destination.id, payload, dms.usersById[dms.meId]?.name || 'You')

  if (!forwarded) {
    ui.toast('Unable to forward message', 'The destination is no longer available.', 'error')
    return
  }
  if (destination.type === 'channel') {
    addMockMessage({
      id: forwarded.id,
      text: forwarded.content,
      sender: forwarded.author,
      conversation: { id: destination.id, name: destination.name.slice(1), kind: 'public' },
    })
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

function reminderSaved() {
  ui.toast('Reminder set', 'You will be reminded about this message.', 'success')
}

function closeActionsOnOutsideClick(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement
  if (!target?.closest('.composer-conversation__actions')) closeMessageActions()
}

async function scrollMessagesToLatest() {
  await nextTick()
  const container = messagesContainer.value
  if (container) container.scrollTop = container.scrollHeight
}

onMounted(() => document.addEventListener('pointerdown', closeActionsOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeActionsOnOutsideClick))
</script>

<template>
  <section class="composer-conversation" @keydown.esc="closeMessageActions">
    <div ref="messagesContainer" class="composer-conversation__messages" aria-live="polite">
      <button
        v-if="hasOlderMessages"
        type="button"
        class="composer-conversation__load-older"
        @click="loadOlder"
      >
        Load older messages
      </button>

      <template v-for="message in renderedMessages" :key="message.id">
        <div v-if="message.showDate" class="composer-conversation__date">
          <span>{{ message.dateHeading }}</span>
        </div>

        <article
          class="composer-conversation__message"
          :class="{ 'composer-conversation__message--grouped': message.grouped }"
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
            <header v-if="!message.grouped" class="composer-conversation__message-heading">
              <strong>{{ message.author }}</strong>
              <time :datetime="message.createdAt">{{ message.time }}</time>
              <span v-if="message.editedAt" class="composer-conversation__edited">(edited)</span>
            </header>

            <div
              class="composer-conversation__message-bubble"
              :data-poll-title="message.content?.match(/^Poll:\s*(.+)$/m)?.[1]?.trim()"
            >
              <span v-if="message.forwardedFrom" class="composer-conversation__forwarded">
                Forwarded from {{ message.forwardedFrom }}
              </span>
              <span v-if="message.important" class="composer-conversation__important">
                IMPORTANT!
              </span>

              <div v-if="message.reply" class="composer-conversation__reply-quote">
                <strong>{{ message.reply.author || 'Message' }}</strong>
                <span>{{ message.reply.content ?? message.reply.text }}</span>
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
                <p v-if="message.content">
                  <template v-for="(segment, index) in message.segments" :key="index">
                    <a
                      v-if="segment.href"
                      :href="segment.href"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ segment.text }}</a
                    >
                    <template v-else>{{ segment.text }}</template>
                  </template>
                </p>
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

              <span v-if="message.scheduled" class="composer-conversation__scheduled">
                Scheduled for {{ message.scheduledAt }} ({{ message.timeZone || 'local time' }})
              </span>

              <ul v-if="message.attachments?.length" class="composer-conversation__attachment-list">
                <li
                  v-for="(file, fileIndex) in message.attachments"
                  :key="file.id || `${file.name}-${file.size}-${fileIndex}`"
                >
                  {{ file.name }}
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
            </div>

            <div
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
                  📌
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
                  <span class="composer-conversation__shortcuts"><kbd>⌘</kbd><kbd>G</kbd></span>
                </button>
                <button
                  v-if="message.mine && !message.scheduled"
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
                  <span class="composer-conversation__shortcuts"><kbd>⌘</kbd><kbd>E</kbd></span>
                </button>
                <button
                  v-if="message.mine && !message.scheduled"
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
                  <span class="composer-conversation__shortcuts"><kbd>⌘</kbd><kbd>D</kbd></span>
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
                  <span class="composer-conversation__shortcuts"><kbd>⌘</kbd><kbd>H</kbd></span>
                </button>
                <button type="button" @click="beginReply(message)">
                  <span aria-hidden="true">↩</span>
                  <span>Reply</span>
                  <span class="composer-conversation__shortcuts"><kbd>⌘</kbd><kbd>J</kbd></span>
                </button>
                <button type="button" @click="setReminder(message)">
                  <span aria-hidden="true">◷</span>
                  <span>Set Reminder</span>
                  <span class="composer-conversation__shortcuts"><kbd>⌘</kbd><kbd>A</kbd></span>
                </button>
              </div>
            </div>

            <span
              v-if="message.mine && !message.scheduled"
              class="composer-conversation__sent-status"
              aria-label="Sent"
            >
              ✓✓
            </span>
          </div>
        </article>
      </template>
    </div>

    <div v-if="replyTo" class="composer-conversation__replying">
      <div>
        <strong>Replying to {{ replyTo.author }}</strong>
        <p>{{ replyTo.content }}</p>
      </div>
      <button type="button" aria-label="Cancel reply" @click="replyTo = null">×</button>
    </div>
    <MessageComposer @send="addMessage" @schedule="addScheduledMessage" @gif="addGif" />

    <SetReminderModal
      v-if="reminderMessage"
      :message="reminderMessage"
      @close="reminderTarget = null"
      @saved="reminderSaved"
    />

    <div
      v-if="forwardTarget"
      class="composer-conversation__forward-overlay"
      @click.self="forwardTarget = null"
    >
      <form class="composer-conversation__forward-dialog" @submit.prevent="forwardMessage">
        <h2>Forward message</h2>
        <p>{{ forwardTarget.content || 'Attachment or GIF' }}</p>
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

.composer-conversation__message-heading time,
.composer-conversation__edited {
  color: #696d81;
  font-size: 12px;
}

.composer-conversation__message-bubble {
  position: relative;
  min-height: 36px;
  padding: 8px 10px;
  background: #edeef6;
  color: #25263a;
  overflow-wrap: anywhere;
}

.composer-conversation__message-bubble p {
  margin: 0;
  white-space: pre-wrap;
}

.composer-conversation__message-bubble a {
  color: #514bc7;
  text-decoration: underline;
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

.composer-conversation__action-toolbar button svg {
  width: 20px;
  height: 20px;
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

.composer-conversation__reaction-picker
  :deep(.v3-body-inner .v3-group .v3-emojis button img) {
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
  margin: 6px 0 0;
  padding-left: 20px;
  color: #696d81;
  font-size: 13px;
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

@media (hover: none) {
  .composer-conversation__action-toolbar {
    opacity: 1;
  }
}
</style>
