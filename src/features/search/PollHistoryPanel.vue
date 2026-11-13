<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useChannelsStore } from '@/features/channels'
import { listPolls } from '@/features/composer/api/polls.api'

const props = defineProps({
  channelId: { type: [String, Number], default: '' },
})
const ui = useUiStore()
const channels = useChannelsStore()
const loading = ref(false)
const error = ref('')
const polls = ref([])
let requestVersion = 0

const channelId = computed(() => String(props.channelId || ''))
const channelName = computed(() => channels.getById(channelId.value)?.name || 'this channel')
function pollStatus(poll) {
  const status = String(poll.status ?? poll.poll_status ?? '').toLowerCase()
  const closeAt = Date.parse(poll.scheduleClose ?? poll.schedule_close ?? poll.close_at ?? '')
  const startAt = Date.parse(poll.scheduleStart ?? poll.schedule_start ?? poll.start_at ?? '')
  const closed =
    poll.closed === true ||
    poll.is_closed === true ||
    poll.poll_closed === true ||
    poll.is_poll_closed === true ||
    ['closed', 'complete', 'completed'].includes(status) ||
    (Number.isFinite(closeAt) && closeAt <= Date.now())
  if (closed) return 'Closed'
  if (status === 'scheduled' || (Number.isFinite(startAt) && startAt > Date.now())) {
    return 'Scheduled'
  }
  return 'Open'
}

function pollChannelId(poll) {
  const channel =
    poll.channel ?? poll.conversation ?? poll.message?.channel ?? poll.message?.conversation
  const channelId =
    poll.channel_id ??
    poll.channelId ??
    (typeof channel === 'object'
      ? (channel.id ?? channel.channel_id ?? channel.channelId)
      : channel) ??
    poll.conversation_id ??
    poll.conversationId ??
    poll.message?.channel_id ??
    poll.message?.channelId
  return channelId == null ? '' : String(channelId)
}

function mapHistoryPoll(record) {
  const poll = record.poll ?? record
  const id = poll.id ?? poll.poll_id ?? record.id ?? record.poll_id
  if (id == null) throw new Error('A poll history item is missing its ID.')
  const pollChannel = pollChannelId(record) || pollChannelId(poll)
  if (!pollChannel) throw new Error(`Poll ${id} is missing its channel ID.`)

  return {
    id: String(id),
    title: poll.title ?? poll.question ?? poll.poll_title ?? poll.name ?? '',
    status: pollStatus(poll),
    audience: poll.audience ?? poll.audience_responses ?? 'public',
    createdAt: poll.createdAt ?? poll.created_at ?? record.createdAt ?? record.created_at ?? '',
    conversation: {
      id: pollChannel,
      name: channels.getById(pollChannel)?.name || pollChannel,
    },
  }
}

const sortedPolls = computed(() =>
  [...polls.value].sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
  ),
)

async function loadChannelPolls() {
  const id = channelId.value
  const version = ++requestVersion
  error.value = ''
  polls.value = []
  if (!id) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const records = await listPolls(id)
    const history = records.map(mapHistoryPoll).filter((poll) => poll.conversation.id === id)
    if (version === requestVersion) polls.value = history
  } catch (loadError) {
    if (version === requestVersion) {
      error.value = loadError?.message || 'Unable to load channel polls.'
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

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
      <p v-else-if="!sortedPolls.length" class="mt-16 text-center text-sm text-slate-500">
        No polls created in this channel yet.
      </p>

      <article
        v-for="poll in sortedPolls"
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
