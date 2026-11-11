<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useChannelsStore } from '@/features/channels'
import { useMessagesStore } from '@/features/messages/messages'

const props = defineProps({
  channelId: { type: [String, Number], default: '' },
})
const POLL_HISTORY_STORAGE_KEY = 'whistleit:channel-poll-history'
const ui = useUiStore()
const channels = useChannelsStore()
const messages = useMessagesStore()
const loading = ref(false)
const error = ref('')
const cachedPolls = ref([])
let requestVersion = 0

const channelId = computed(() => String(props.channelId || ''))
const channelName = computed(() => channels.getById(channelId.value)?.name || 'this channel')
const livePolls = computed(() => {
  const channelMessagePolls = messages
    .messagesFor(channelId.value)
    .filter((message) => {
      const content = String(message.content ?? message.text ?? '')
      return (
        !message.deleted &&
        !message.scheduled &&
        Boolean(message.poll || message.poll_id || message.pollId || /^Poll:\s*.+/m.test(content))
      )
    })
    .map((message) => {
      const poll = message.poll || {}
      const content = String(message.content ?? message.text ?? '')
      const legacyTitle = content.match(/^Poll:\s*(.+)$/m)?.[1]?.trim()
      return {
        id: String(poll.id ?? message.poll_id ?? message.pollId ?? message.id),
        title:
          poll.title ??
          poll.question ??
          message.poll_title ??
          message.pollTitle ??
          legacyTitle ??
          content,
        status:
          poll.status ??
          (poll.closed || poll.is_closed || message.poll_closed || message.is_poll_closed
            ? 'Closed'
            : 'Open'),
        audience:
          poll.audience ?? poll.audience_responses ?? message.audience_responses ?? 'public',
        createdAt: message.createdAt ?? poll.createdAt ?? poll.created_at ?? '',
        conversation: { id: channelId.value, name: channelName.value },
      }
    })
    .reverse()
  const channelUiPolls = ui.polls.filter(
    (poll) =>
      String(poll.conversation?.id ?? '') === channelId.value && poll.conversation?.kind !== 'dm',
  )
  const byId = new Map(channelMessagePolls.map((poll) => [poll.id, poll]))
  for (const poll of channelUiPolls) byId.set(String(poll.id), poll)
  return [...byId.values()]
})
const polls = computed(() => {
  const byId = new Map(cachedPolls.value.map((poll) => [poll.id, poll]))
  for (const poll of livePolls.value) byId.set(poll.id, poll)
  return [...byId.values()].sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
  )
})

function readCachedPolls(id) {
  if (!id || typeof localStorage === 'undefined') return []
  try {
    const saved = JSON.parse(localStorage.getItem(POLL_HISTORY_STORAGE_KEY) || '{}')
    const channelPolls = saved?.[id]
    return Array.isArray(channelPolls)
      ? channelPolls.filter((poll) => poll && typeof poll === 'object' && poll.id != null)
      : []
  } catch (loadError) {
    console.error('Unable to load cached channel poll history:', loadError)
    return []
  }
}

function persistPolls(id, channelPolls) {
  if (!id || !channelPolls.length || typeof localStorage === 'undefined') return
  try {
    const saved = JSON.parse(localStorage.getItem(POLL_HISTORY_STORAGE_KEY) || '{}')
    const history = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    const byId = new Map(
      (Array.isArray(history[id]) ? history[id] : []).map((poll) => [String(poll.id), poll]),
    )
    for (const poll of channelPolls) byId.set(poll.id, poll)
    history[id] = [...byId.values()]
    localStorage.setItem(POLL_HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch (saveError) {
    console.error('Unable to save channel poll history:', saveError)
  }
}

async function loadChannelPolls() {
  const id = channelId.value
  const version = ++requestVersion
  error.value = ''
  cachedPolls.value = readCachedPolls(id)
  if (!id) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const firstPage = await messages.fetchChannelMessages(id)
    if (!firstPage.success) throw new Error(firstPage.error || 'Unable to load channel polls.')

    let page = Number(messages.currentPageByChannel[id]) || 1
    while (messages.hasMorePagesByChannel[id]) {
      const result = await messages.fetchChannelMessages(id, { page: page + 1, olderPage: true })
      if (!result.success) throw new Error(result.error || 'Unable to load channel polls.')
      const nextPage = Number(messages.currentPageByChannel[id]) || page
      if (nextPage <= page) throw new Error('Unable to load the next page of channel polls.')
      page = nextPage
    }
  } catch (loadError) {
    if (version === requestVersion) {
      error.value = loadError?.message || 'Unable to load channel polls.'
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(
  livePolls,
  (channelPolls) => {
    if (!channelPolls.length) return
    persistPolls(channelId.value, channelPolls)
    cachedPolls.value = readCachedPolls(channelId.value)
  },
  { deep: true, immediate: true },
)

function formatDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

async function jumpToPoll(poll) {
  ui.closePanel()
  await nextTick()
  const targets = [...document.querySelectorAll('[data-poll-id], [data-poll-title]')]
  const target =
    targets.find((element) => element.dataset.pollId === poll.id) ||
    targets.find((element) => element.dataset.pollTitle === poll.title)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.classList.add('poll-jump-highlight')
  setTimeout(() => target?.classList.remove('poll-jump-highlight'), 1800)
}

watch(channelId, loadChannelPolls, { immediate: true })
onBeforeUnmount(() => {
  requestVersion += 1
})
</script>

<template>
  <aside class="flex h-full w-full flex-col bg-white">
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
      <h2 class="text-xl font-normal text-slate-800">Polls in {{ channelName }}</h2>
      <button
        type="button"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-indigo-50 text-slate-600 transition-colors hover:text-slate-900"
        title="Close Poll History"
        aria-label="Close poll history"
        @click="ui.closePanel()"
      >
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M5 5l14 14M19 5 5 19" />
        </svg>
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <p v-if="loading" class="mt-16 text-center text-sm text-slate-500" role="status">
        Loading channel polls...
      </p>
      <p v-else-if="error" class="mt-16 text-center text-sm text-red-600" role="alert">
        {{ error }}
      </p>
      <p v-else-if="!polls.length" class="mt-16 text-center text-sm text-slate-500">
        No polls created in this channel yet.
      </p>

      <article
        v-for="poll in polls"
        :key="poll.id"
        class="relative border-b border-slate-200 px-5 py-5"
      >
        <p class="mb-5 text-center text-sm text-slate-600">{{ formatDate(poll.createdAt) }}</p>
        <div class="border-l-4 border-indigo-500 pl-5 pr-16">
          <h3 class="text-xl font-bold text-slate-900">{{ poll.title }}</h3>
          <p class="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <span class="text-green-600">✓</span>
            <span>{{ poll.status }}</span>
            <span>|</span>
            <span>{{ poll.audience === 'anonymous' ? 'Anonymous' : 'Public' }}</span>
          </p>
        </div>
        <button
          type="button"
          class="absolute right-5 top-14 cursor-pointer rounded border border-indigo-400 px-3 py-1 text-sm font-semibold text-indigo-600"
          @click="jumpToPoll(poll)"
        >
          JUMP
        </button>
      </article>
    </div>
  </aside>
</template>

<style scoped>
:global(.poll-jump-highlight) {
  outline: 3px solid rgba(99, 102, 241, 0.35);
  outline-offset: 6px;
}
</style>
