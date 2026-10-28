<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import { useUiStore } from '@/stores/ui'
import { CURRENT_USER_NAME, useMessagesStore } from '@/features/messages/messages'
import {
  createLinkPreview,
  dateLabel,
  messageSegments,
  sameDay,
} from '@/features/messages/message-utils'

// Search & Reminders
import ChatHeaderActions from '@/features/search/ChatHeaderActions.vue'
import ChannelSettingsModal from '@/features/search/ChannelSettingsModal.vue'
import RemindersPanel from '@/features/search/RemindersPanel.vue'
import SearchPage from '@/features/search/SearchPage.vue'
import SetReminderModal from '@/features/search/SetReminderModal.vue'

const router = useRouter()
const ui = useUiStore()
const messages = useMessagesStore()
const { selectedChannelId, sidebarOpen } = storeToRefs(ui)
const { activeId: activeDmId } = storeToRefs(dms)
const { activeTeam } = storeToRefs(teamsStore)

const isTeamSwitcherOpen = ref(false)
const reminderModalOpen = ref(false)
const activeConversation = computed(
  () => dms.conversations.find((conversation) => conversation.id === activeDmId.value) || null,
)

const channels = [
  { id: 'general', name: 'general' },
  { id: 'random', name: 'random' },
  { id: 'frontend', name: 'frontend-team' },
]
const currentChannelId = computed(() => selectedChannelId.value || 'general')
const channelName = computed(
  () => channels.find(({ id }) => id === currentChannelId.value)?.name ?? currentChannelId.value,
)
const channelMessages = computed(() => messages.visibleMessagesFor(currentChannelId.value))
const allChannelMessages = computed(() => messages.messagesFor(currentChannelId.value))
const pinnedMessages = computed(() => allChannelMessages.value.filter(({ pinned }) => pinned))
const hasOlderMessages = computed(() => messages.hasOlderMessages(currentChannelId.value))
const draft = ref('')
const replyToId = ref(null)
const editingId = ref(null)
const editDraft = ref('')
const notice = ref('')
const messageList = ref(null)
const openMenuId = ref(null)
const openReactionId = ref(null)
const forwardMessageTarget = ref(null)
const forwardChannelId = ref(currentChannelId.value)
const forwardSourceChannel = ref(currentChannelId.value)
const reminderMessageTarget = ref(null)
const reminderDate = ref('')
const reminderTime = ref('')
const reminderTitle = ref('')
const reminderError = ref('')
const todayDate = dateInputValue(new Date())

const renderedMessages = computed(() => {
  let previous = null
  return channelMessages.value.map((message) => {
    const showDate = !previous || !sameDay(previous.createdAt, message.createdAt)
    const grouped =
      previous?.author === message.author &&
      sameDay(previous.createdAt, message.createdAt) &&
      new Date(message.createdAt) - new Date(previous.createdAt) < 5 * 60_000
    previous = message
    return {
      ...message,
      author:
        message.authorId === 'current-user' || message.author === 'Jamie'
          ? CURRENT_USER_NAME
          : message.author,
      showDate,
      dateHeading: dateLabel(message.createdAt),
      grouped,
      segments: messageSegments(message.content),
      preview: createLinkPreview(message.content),
      reply: message.replyTo
        ? allChannelMessages.value.find(({ id }) => id === message.replyTo)
        : null,
    }
  })
})
const replyTarget = computed(() =>
  allChannelMessages.value.find(({ id }) => id === replyToId.value),
)

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function timeLabel(date) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(date),
  )
}

function dateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeInputValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function runAction(action) {
  try {
    action()
    notice.value = ''
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : 'The message action could not be completed.'
  }
}

function loadOlder() {
  runAction(() => messages.loadOlder(currentChannelId.value))
}

function send() {
  if (!draft.value.trim()) return
  runAction(() => messages.sendMessage(currentChannelId.value, draft.value, replyToId.value))
  draft.value = ''
  replyToId.value = null
  nextTick(() => {
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  })
}

function startEdit(message) {
  openMenuId.value = null
  editingId.value = message.id
  editDraft.value = message.content
}

function saveEdit(messageId) {
  if (!editDraft.value.trim()) {
    notice.value = 'A message cannot be empty.'
    return
  }
  runAction(() => messages.editMessage(currentChannelId.value, messageId, editDraft.value))
  editingId.value = null
}

function deleteMessage(message) {
  openMenuId.value = null
  if (!window.confirm('Delete this message? This cannot be undone.')) return
  runAction(() => messages.deleteMessage(currentChannelId.value, message.id))
}

async function copyMessage(message) {
  openMenuId.value = null
  try {
    await navigator.clipboard.writeText(message.content)
    notice.value = 'Message copied to clipboard.'
  } catch {
    notice.value = 'Clipboard access is unavailable in this browser.'
  }
}

function togglePin(message) {
  runAction(() => messages.togglePin(currentChannelId.value, message.id))
}

function toggleReaction(message, emoji) {
  runAction(() => messages.toggleReaction(currentChannelId.value, message.id, emoji))
}

function beginReply(message) {
  openMenuId.value = null
  replyToId.value = message.id
  nextTick(() => document.querySelector('#message-composer')?.focus())
}

function toggleActionMenu(messageId) {
  openReactionId.value = null
  openMenuId.value = openMenuId.value === messageId ? null : messageId
}

function toggleReactionPicker(messageId) {
  openMenuId.value = null
  openReactionId.value = openReactionId.value === messageId ? null : messageId
}

function selectReaction(message, emoji) {
  if (!emoji) return
  toggleReaction(message, emoji)
  openReactionId.value = null
}

function forwardMessage(message) {
  openMenuId.value = null
  forwardMessageTarget.value = message
  forwardSourceChannel.value = currentChannelId.value
  forwardChannelId.value = currentChannelId.value
}

function confirmForward() {
  if (!forwardMessageTarget.value || !forwardChannelId.value) return
  const source = forwardMessageTarget.value
  const sourceChannelName =
    channels.find(({ id }) => id === forwardSourceChannel.value)?.name ?? forwardSourceChannel.value
  runAction(() =>
    messages.sendMessage(
      forwardChannelId.value,
      `Forwarded from ${source.author} in #${sourceChannelName}:\n${source.content}`,
    ),
  )
  forwardMessageTarget.value = null
}

function setReminder(message) {
  openMenuId.value = null
  const defaultDate = new Date(Date.now() + 60 * 60 * 1000)
  const existingDate = message.reminderAt ? new Date(message.reminderAt) : defaultDate
  reminderMessageTarget.value = message
  reminderDate.value = dateInputValue(existingDate)
  reminderTime.value = timeInputValue(existingDate)
  reminderTitle.value = message.reminderTitle ?? ''
  reminderError.value = ''
}

function saveReminder() {
  if (!reminderMessageTarget.value) return
  if (!reminderDate.value || !reminderTime.value || !reminderTitle.value.trim()) {
    reminderError.value = 'Choose a date and time, and enter a reminder title.'
    return
  }
  const reminderAt = new Date(`${reminderDate.value}T${reminderTime.value}`)
  if (Number.isNaN(reminderAt.getTime()) || reminderAt <= new Date()) {
    reminderError.value = 'Choose a valid date and time in the future.'
    return
  }
  runAction(() => {
    messages.setReminder(
      currentChannelId.value,
      reminderMessageTarget.value.id,
      reminderAt.toISOString(),
      reminderTitle.value,
    )
  })
  reminderMessageTarget.value = null
}

function closeReminder() {
  reminderMessageTarget.value = null
  reminderError.value = ''
}

function closeActionMenu(event) {
  if (!event.target.closest('.message-actions')) {
    openMenuId.value = null
    openReactionId.value = null
  }
}

function closeActionMenuOnEscape(event) {
  if (event.key === 'Escape') {
    openMenuId.value = null
    openReactionId.value = null
    forwardMessageTarget.value = null
    closeReminder()
    return
  }

  if (!openMenuId.value || (!event.metaKey && !event.ctrlKey)) return

  const message = allChannelMessages.value.find(({ id }) => id === openMenuId.value)
  if (!message) return

  const shortcuts = {
    g: () => copyMessage(message),
    e: () => startEdit(message),
    d: () => deleteMessage(message),
    h: () => forwardMessage(message),
    j: () => beginReply(message),
    a: () => setReminder(message),
  }
  const action = shortcuts[event.key.toLowerCase()]
  if (action) {
    event.preventDefault()
    action()
  }
}

onMounted(() => {
  document.addEventListener('click', closeActionMenu)
  document.addEventListener('keydown', closeActionMenuOnEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeActionMenu)
  document.removeEventListener('keydown', closeActionMenuOnEscape)
})

watch(currentChannelId, () => {
  replyToId.value = null
  editingId.value = null
  openMenuId.value = null
  openReactionId.value = null
  forwardMessageTarget.value = null
  closeReminder()
  nextTick(() => {
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  })
})
</script>

<template>
  <div class="flex h-screen min-h-[500px] bg-slate-100 text-slate-800">
    <aside
      v-if="sidebarOpen"
      class="flex w-64 shrink-0 flex-col bg-slate-900 p-4 text-slate-100 max-sm:w-52"
    >
      <div class="mb-8 flex items-center gap-3">
        <div class="grid size-10 place-items-center rounded-xl bg-violet-500 text-lg font-bold">
          W
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight">WhistleIt</h1>
          <p class="text-xs text-slate-400">Team workspace</p>
        </div>
      </div>
      <p class="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Channels
      </p>
      <ul class="space-y-1">
        <li v-for="channel in channels" :key="channel.id">
          <button
            class="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            :class="{
              'bg-violet-600/20 font-semibold text-white': currentChannelId === channel.id,
            }"
            @click="ui.selectChannel(channel.id)"
          >
            <span class="mr-2 text-slate-500">#</span>{{ channel.name }}
          </button>
        </li>
      </ul>
      <div class="mt-auto rounded-xl border border-slate-700 bg-slate-800/70 p-3">
        <div class="flex items-center gap-2">
          <span
            class="grid size-8 place-items-center rounded-full bg-emerald-600 text-xs font-semibold"
            >{{ initials(messages.currentUserName) }}</span
          >
          <div>
            <p class="text-sm font-medium">{{ messages.currentUserName }}</p>
            <p class="text-xs text-emerald-400">Active</p>
          </div>
        </div>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-[73px] shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6"
      >
        <button
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          aria-label="Toggle channel sidebar"
          @click="ui.toggleSidebar()"
        >
          ☰
        </button>
        <div class="min-w-0">
          <h2 class="truncate font-semibold text-slate-900">
            <span class="mr-1 text-slate-400">#</span>{{ channelName }}
          </h2>
          <p class="text-xs text-slate-500">A place for team conversations</p>
        </div>
        <div class="ml-auto hidden items-center gap-2 text-xs text-slate-500 sm:flex">
          <span class="size-2 rounded-full bg-emerald-500"></span> Messages saved on this device
        </div>
      </header>

      <section ref="messageList" class="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
        <div class="mx-auto max-w-4xl">
          <div
            v-if="pinnedMessages.length"
            class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3"
          >
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
              📌 Pinned in #{{ channelName }}
            </p>
            <div
              v-for="message in pinnedMessages"
              :key="message.id"
              class="truncate text-sm text-slate-700"
            >
              <span class="font-semibold">{{ message.author }}:</span> {{ message.content }}
            </div>
          </div>

          <div class="mb-5 flex justify-center">
            <button
              v-if="hasOlderMessages"
              class="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
              @click="loadOlder"
            >
              Load older messages
            </button>
            <p v-else class="text-xs text-slate-400">You’re all caught up</p>
          </div>

          <div v-for="message in renderedMessages" :key="message.id">
            <div v-if="message.showDate" class="relative my-6 flex items-center justify-center">
              <div class="absolute inset-x-0 border-t border-slate-200"></div>
              <span
                class="relative rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"
              >
                {{ message.dateHeading }}
              </span>
            </div>

            <article
              class="group relative flex gap-3 rounded-xl border-l-2 px-3 py-2 transition hover:bg-white/80"
              :class="[
                { 'pt-0': message.grouped },
                message.pinned ? 'border-amber-400 bg-amber-50/60' : 'border-transparent',
              ]"
            >
              <div class="w-10 shrink-0">
                <div
                  v-if="!message.grouped"
                  class="grid size-9 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700"
                >
                  {{ initials(message.author) }}
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <div v-if="!message.grouped" class="mb-1 flex items-baseline gap-2">
                  <span class="text-sm font-semibold text-slate-900">{{ message.author }}</span>
                  <time class="text-xs text-slate-400" :datetime="message.createdAt">
                    {{ timeLabel(message.createdAt) }}
                  </time>
                  <span v-if="message.editedAt" class="text-xs text-slate-400">(edited)</span>
                  <span
                    v-if="message.pinned"
                    class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                  >
                    <span aria-hidden="true">📌</span> Pinned
                  </span>
                </div>
                <div
                  v-else
                  class="mb-1 pl-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100"
                >
                  {{ timeLabel(message.createdAt) }}
                </div>

                <div
                  v-if="message.reply"
                  class="mb-2 border-l-2 border-violet-300 pl-2 text-xs text-slate-500"
                >
                  <span class="font-medium">{{ message.reply.author }}</span>
                  <span class="ml-1">{{ message.reply.content }}</span>
                </div>
                <div
                  v-else-if="message.replyTo"
                  class="mb-2 border-l-2 border-slate-300 pl-2 text-xs text-slate-400"
                >
                  Original message was deleted
                </div>

                <div v-if="editingId === message.id" class="space-y-2">
                  <textarea
                    v-model="editDraft"
                    class="w-full resize-y rounded-lg border border-violet-300 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-violet-200"
                    rows="3"
                    aria-label="Edit message"
                  ></textarea>
                  <div class="flex gap-2">
                    <button
                      class="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                      @click="saveEdit(message.id)"
                    >
                      Save
                    </button>
                    <button
                      class="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                      @click="editingId = null"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <template v-else>
                  <p class="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                    <template v-for="(segment, index) in message.segments" :key="index">
                      <a
                        v-if="segment.type === 'link'"
                        :href="segment.href"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900"
                        >{{ segment.value }}</a
                      >
                      <span v-else>{{ segment.value }}</span>
                    </template>
                  </p>

                  <a
                    v-if="message.preview"
                    :href="message.preview.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-3 flex max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-violet-300"
                  >
                    <span class="w-1.5 shrink-0 bg-violet-500"></span>
                    <span class="min-w-0 p-3">
                      <span
                        class="block text-[11px] font-semibold uppercase tracking-wide text-violet-700"
                        >{{ message.preview.hostname }}</span
                      >
                      <span class="mt-1 block truncate text-sm font-semibold text-slate-800">{{
                        message.preview.title
                      }}</span>
                      <span class="mt-1 block text-xs text-slate-500">{{
                        message.preview.description
                      }}</span>
                      <span class="mt-2 block truncate text-xs text-slate-400">{{
                        message.preview.url
                      }}</span>
                    </span>
                  </a>
                </template>

                <div
                  v-if="Object.keys(message.reactions ?? {}).length"
                  class="mt-2 flex flex-wrap gap-1.5"
                >
                  <button
                    v-for="(people, emoji) in message.reactions"
                    :key="emoji"
                    class="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-800 hover:bg-violet-100"
                    :aria-label="`${emoji} reaction, ${people.length} people`"
                    @click="toggleReaction(message, emoji)"
                  >
                    {{ emoji }} {{ people.length }}
                  </button>
                </div>

                <div
                  v-if="message.reminderAt"
                  class="mt-2 flex max-w-xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"
                >
                  <span aria-hidden="true">⏰</span>
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{
                      message.reminderTitle || 'Reminder'
                    }}</span>
                    <time
                      class="mt-0.5 block text-xs text-amber-800"
                      :datetime="message.reminderAt"
                    >
                      {{
                        new Intl.DateTimeFormat(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(message.reminderAt))
                      }}
                    </time>
                  </span>
                </div>

                <div
                  class="message-actions absolute -top-3 right-2 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  @click.stop
                >
                  <button
                    class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                    :aria-expanded="openReactionId === message.id"
                    aria-label="Choose a reaction"
                    @click="toggleReactionPicker(message.id)"
                  >
                    <svg
                      class="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                    aria-label="Copy message"
                    @click="copyMessage(message)"
                  >
                    <svg
                      class="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <rect x="8" y="8" width="12" height="12" rx="2" />
                      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                    </svg>
                  </button>
                  <button
                    class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                    :class="{ 'text-violet-700': message.pinned }"
                    :aria-label="message.pinned ? 'Unpin message' : 'Pin message'"
                    @click="togglePin(message)"
                  >
                    <svg
                      class="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <path d="m16 3 5 5-4 1-4 4-1 8-2-2-2-2 8-1 4-4z" />
                      <path d="m3 21 7-7" />
                    </svg>
                  </button>
                  <button
                    class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                    :aria-expanded="openMenuId === message.id"
                    aria-haspopup="menu"
                    aria-label="More message actions"
                    @click="toggleActionMenu(message.id)"
                  >
                    <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>

                  <div
                    v-if="openReactionId === message.id"
                    class="absolute right-0 top-full z-30 mt-2 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
                    role="dialog"
                    aria-label="Emoji picker"
                  >
                    <EmojiPicker
                      :native="true"
                      :display-recent="true"
                      :hide-search="false"
                      theme="light"
                      @select="selectReaction(message, $event.i)"
                    />
                  </div>
                  <div
                    v-if="openMenuId === message.id"
                    class="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-100 bg-white p-2 text-slate-800 shadow-xl"
                    role="menu"
                    aria-label="Message actions"
                  >
                    <button
                      class="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100"
                      role="menuitem"
                      @click="copyMessage(message)"
                    >
                      <svg
                        class="size-5 shrink-0 text-slate-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        aria-hidden="true"
                      >
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                      </svg>
                      <span class="flex-1">Copy</span>
                      <kbd class="rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-600"
                        >⌘ G</kbd
                      >
                    </button>
                    <button
                      class="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100"
                      role="menuitem"
                      @click="startEdit(message)"
                    >
                      <svg
                        class="size-5 shrink-0 text-slate-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        aria-hidden="true"
                      >
                        <path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" />
                      </svg>
                      <span class="flex-1">Edit</span>
                      <kbd class="rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-600"
                        >⌘ E</kbd
                      >
                    </button>
                    <button
                      class="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-rose-50 hover:text-rose-700"
                      role="menuitem"
                      @click="deleteMessage(message)"
                    >
                      <svg
                        class="size-5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        aria-hidden="true"
                      >
                        <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
                      </svg>
                      <span class="flex-1">Delete</span>
                      <kbd class="rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-600"
                        >⌘ D</kbd
                      >
                    </button>
                    <button
                      class="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100"
                      role="menuitem"
                      @click="forwardMessage(message)"
                    >
                      <svg
                        class="size-5 shrink-0 text-slate-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        aria-hidden="true"
                      >
                        <path d="M15 5 20 10l-5 5M20 10H9a5 5 0 0 0-5 5v4" />
                      </svg>
                      <span class="flex-1">Forward</span>
                      <kbd class="rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-600"
                        >⌘ H</kbd
                      >
                    </button>
                    <button
                      class="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100"
                      role="menuitem"
                      @click="beginReply(message)"
                    >
                      <svg
                        class="size-5 shrink-0 text-slate-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        aria-hidden="true"
                      >
                        <path d="m9 17-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2" />
                      </svg>
                      <span class="flex-1">Reply</span>
                      <kbd class="rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-600"
                        >⌘ J</kbd
                      >
                    </button>
                    <button
                      class="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100"
                      role="menuitem"
                      @click="setReminder(message)"
                    >
                      <svg
                        class="size-5 shrink-0 text-slate-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="13" r="8" />
                        <path d="M12 9v4l3 2M5 3 2 6m17-3 3 3" />
                      </svg>
                      <span class="flex-1">Set Reminder</span>
                      <kbd class="rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-600"
                        >⌘ A</kbd
                      >
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <div class="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div class="mx-auto max-w-4xl">
          <p v-if="notice" role="status" class="mb-2 text-xs text-slate-600">{{ notice }}</p>
          <div
            v-if="replyTarget"
            class="mb-2 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800"
          >
            <span
              >Replying to <strong>{{ replyTarget.author }}</strong
              >: {{ replyTarget.content }}</span
            >
            <button class="ml-3 font-semibold" aria-label="Cancel reply" @click="replyToId = null">
              ✕
            </button>
          </div>
          <form
            class="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100"
            @submit.prevent="send"
          >
            <textarea
              id="message-composer"
              v-model="draft"
              rows="1"
              maxlength="4000"
              :placeholder="`Message #${channelName}`"
              aria-label="Write a message"
              class="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
              @keydown.enter.exact.prevent="send"
            ></textarea>
            <button
              type="submit"
              class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              :disabled="!draft.trim()"
            >
              Send
            </button>
          </form>
          <p class="mt-2 text-center text-[11px] text-slate-400">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>

      <div
        v-if="reminderMessageTarget"
        class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
        @click.self="closeReminder"
      >
        <section
          class="relative flex max-h-[min(76vh,520px)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-dialog-title"
        >
          <button
            class="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-slate-100 text-lg text-slate-700 hover:bg-slate-200"
            aria-label="Close reminder dialog"
            @click="closeReminder"
          >
            ×
          </button>
          <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="saveReminder">
            <div class="overflow-y-auto px-4 pb-4 pt-7 sm:px-6">
              <h2
                id="reminder-dialog-title"
                class="text-center text-xl font-semibold text-slate-900"
              >
                Reminder Message
              </h2>

              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <label class="block text-sm text-slate-600" for="reminder-date">
                  Select date
                  <input
                    id="reminder-date"
                    v-model="reminderDate"
                    type="date"
                    :min="todayDate"
                    required
                    class="mt-1 block w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-lg text-slate-900 outline-none focus:border-violet-500 focus:ring-0"
                  />
                </label>
                <label class="block text-sm text-violet-600" for="reminder-time">
                  Select time
                  <input
                    id="reminder-time"
                    v-model="reminderTime"
                    type="time"
                    required
                    class="mt-1 block w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-lg text-slate-900 outline-none focus:border-violet-500 focus:ring-0"
                  />
                </label>
              </div>

              <label class="sr-only" for="reminder-title">Reminder title</label>
              <textarea
                id="reminder-title"
                v-model="reminderTitle"
                maxlength="500"
                required
                placeholder="Title"
                class="mt-5 min-h-28 w-full resize-y rounded-lg border border-slate-300 p-3 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 sm:min-h-32"
              ></textarea>
              <p v-if="reminderError" role="alert" class="mt-2 text-sm text-rose-600">
                {{ reminderError }}
              </p>
            </div>

            <footer
              class="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-6"
            >
              <button
                type="button"
                class="rounded-lg px-5 py-3 text-sm font-semibold tracking-wide text-slate-700 hover:bg-slate-100"
                @click="closeReminder"
              >
                CANCEL
              </button>
              <button
                type="submit"
                class="min-w-32 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold tracking-wide text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                SAVE
              </button>
            </footer>
          </form>
        </section>
      </div>

      <div
        v-if="forwardMessageTarget"
        class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
        @click.self="forwardMessageTarget = null"
      >
        <section
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forward-dialog-title"
        >
          <h2 id="forward-dialog-title" class="text-lg font-semibold text-slate-900">
            Forward message
          </h2>
          <p class="mt-1 text-sm text-slate-500">Choose a channel to forward this message to.</p>
          <blockquote
            class="mt-4 rounded-lg border-l-2 border-violet-400 bg-slate-50 p-3 text-sm text-slate-700"
          >
            <span class="font-semibold">{{ forwardMessageTarget.author }}</span>
            <span class="mt-1 block whitespace-pre-wrap break-words">{{
              forwardMessageTarget.content
            }}</span>
          </blockquote>
          <label for="forward-channel" class="mt-4 block text-sm font-medium text-slate-700">
            Channel
          </label>
          <select
            id="forward-channel"
            v-model="forwardChannelId"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          >
            <option v-for="channel in channels" :key="channel.id" :value="channel.id">
              # {{ channel.name }}
            </option>
          </select>
          <div class="mt-5 flex justify-end gap-2">
            <button
              class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              @click="forwardMessageTarget = null"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              @click="confirmForward"
            >
              Forward message
            </button>
          </div>
        </section>
      </div>
    </main>

    <!-- Channel Settings Modal -->
    <ChannelSettingsModal
      v-if="ui.channelSettingsOpen && selectedChannel"
      :channel="selectedChannel"
      @toggle-mute="selectedChannel.muted = !selectedChannel.muted"
      @toggle-favourite="selectedChannel.favourite = !selectedChannel.favourite"
      @left="ui.selectChannel(null)"
      @close="ui.channelSettingsOpen = false"
    />

    <!-- Set Reminder Modal -->
    <SetReminderModal
      v-if="reminderModalOpen && reminderMessage"
      :message="reminderMessage"
      @close="reminderModalOpen = false"
    />

    <!-- Toast Notifications -->
    <div class="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="flex items-center gap-3 rounded-lg p-4 shadow-lg"
        :class="
          toast.type === 'success'
            ? 'border-t-4 border-emerald-400 bg-white text-slate-700'
            : 'bg-slate-900 text-white'
        "
      >
        <svg
          v-if="toast.type === 'success'"
          class="h-5 w-5 shrink-0 text-emerald-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ toast.title }}</p>
          <p class="mt-1 text-sm" :class="toast.type === 'success' ? 'text-slate-500' : 'text-slate-200'">
            {{ toast.body }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 text-slate-400 hover:text-slate-700"
          aria-label="Dismiss notification"
          @click="ui.dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Account UserModule (Pinned to bottom-left of TeamRail) -->
    <UserModule
      :user="user"
      :avatar-size="32"
      @log-out="logout"
      @settings-saved="onAccountSettingsSaved"
    />

    <!-- Shell Modals -->
    <CreateTeamModal />
    <JoinTeamModal />
    <HelpModal />
    <MemberManageModal />
  </div>
</template>