<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { useRepliesStore } from '@/features/replies/stores/replies'

defineOptions({ name: 'ThreadPanel' })

// DM thread:      <ThreadPanel channel-id="c1" :message="msg" />
// Channel thread: <ThreadPanel team-id="t1" channel-id="general" :message="msg" />
const props = defineProps({
  message: { type: Object, required: true }, // parent message ({ id, from, text, createdAt })
  channelId: { type: String, required: true },
  teamId: { type: String, default: null }, // dene par team channel ki replies API
})
const emit = defineEmits(['close'])

const dms = useDmStore()
const replies = useRepliesStore()

const draft = ref('')
const listEl = ref(null)

const target = computed(() => ({
  teamId: props.teamId,
  channelId: props.channelId,
  messageId: String(props.message.id),
}))
const list = computed(() => replies.repliesOf(target.value))
const loading = computed(() => replies.isLoading(target.value))
const error = computed(() => replies.errorOf(target.value))
const offline = computed(() => replies.isOffline(target.value))
// Parent abhi server par nahi gaya (local- id) to reply API call nahi ho sakti
const parentPending = computed(() => String(props.message.id).startsWith('local-'))

function nameOf(userId) {
  if (userId && userId === dms.meId) return dms.usersById[userId]?.name || 'You'
  return dms.usersById[userId]?.name || 'Unknown user'
}
function timeOf(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

// Thread khulte hi (ya parent badalne par) replies load karo: pehle cache, phir API
watch(
  target,
  (value) => {
    if (!parentPending.value) void replies.loadReplies(value).then(scrollToBottom)
  },
  { immediate: true },
)

function send() {
  if (parentPending.value) return
  const sent = replies.sendReply(target.value, draft.value)
  if (sent) {
    draft.value = ''
    void scrollToBottom()
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <aside class="flex h-full w-full flex-col border-l bg-white text-slate-800" aria-label="Thread">
    <header class="flex items-center justify-between border-b px-4 py-3">
      <div>
        <h2 class="font-semibold">Thread</h2>
        <p class="text-xs text-slate-500" data-test="reply-count">
          {{ list.length }} {{ list.length === 1 ? 'reply' : 'replies' }}
        </p>
      </div>
      <button
        class="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
        aria-label="Close thread"
        @click="emit('close')"
      >
        ✕
      </button>
    </header>

    <div ref="listEl" class="flex-1 overflow-y-auto px-4 py-3">
      <!-- Parent message -->
      <div class="mb-3 border-b pb-3" data-test="parent">
        <p class="text-sm font-semibold">
          {{ nameOf(message.from) }}
          <span class="ml-1 text-xs font-normal text-slate-400">{{ timeOf(message.createdAt) }}</span>
        </p>
        <p class="whitespace-pre-wrap text-[15px]">{{ message.text }}</p>
      </div>

      <p v-if="parentPending" class="text-sm text-slate-500">
        Message abhi send ho raha hai. Send hone ke baad reply kar sakte hain.
      </p>
      <p v-else-if="loading && !list.length" class="text-sm text-slate-500">Loading replies…</p>
      <p v-if="error" class="mb-2 text-sm text-slate-500" data-test="replies-error">
        <template v-if="offline">Offline: showing saved replies.</template>
        <template v-else>{{ error }}</template>
        <button class="ml-1 underline" @click="replies.loadReplies(target, { force: true })">
          Retry
        </button>
      </p>

      <ul class="space-y-3">
        <li v-for="reply in list" :key="reply.id" data-test="reply">
          <p class="text-sm font-semibold">
            {{ nameOf(reply.from) }}
            <span class="ml-1 text-xs font-normal text-slate-400">{{ timeOf(reply.createdAt) }}</span>
          </p>
          <p
            class="whitespace-pre-wrap text-[15px]"
            :class="reply.status === 'sending' ? 'text-slate-400' : ''"
          >
            {{ reply.text }}
          </p>
          <p v-if="reply.status === 'sending'" class="text-xs text-slate-400">Sending…</p>
          <p v-else-if="reply.status === 'failed'" class="text-xs text-red-600">
            Not sent{{ reply.error && reply.error !== 'Not sent' ? `: ${reply.error}` : '' }}
            <button class="ml-1 underline" @click="replies.retryReply(target, reply.id)">
              Retry
            </button>
            <button class="ml-1 underline" @click="replies.discardReply(target, reply.id)">
              Delete
            </button>
          </p>
        </li>
      </ul>
    </div>

    <footer class="border-t p-3">
      <textarea
        v-model="draft"
        rows="2"
        placeholder="Reply…"
        aria-label="Reply"
        :disabled="parentPending"
        class="w-full resize-none rounded border-2 border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
        @keydown="onKeydown"
      />
      <div class="mt-2 flex justify-end">
        <button
          class="rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-indigo-300"
          :disabled="!draft.trim() || parentPending"
          @click="send"
        >
          Send
        </button>
      </div>
    </footer>
  </aside>
</template>