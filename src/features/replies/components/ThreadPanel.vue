<script setup>
defineOptions({ name: 'DmThreadPanel' })

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { useRepliesStore } from '@/features/replies/stores/replies'
import UserAvatar from '@/features/dms/components/UserAvatar.vue'
import TimeAgo from '@/features/dms/components/TimeAgo.vue'

// Right side "Reply Thread" panel
// DM thread:      <ThreadPanel channel-id="c1" :message="msg" @close="..." />
// Channel thread: <ThreadPanel team-id="t1" channel-id="general" :message="msg" @close="..." />
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
// (naya) DM: replies API ki list + DM list ke parent_id replies (doosre user ki taraf yahi aate hain)
const list = computed(() => {
  const own = replies.repliesOf(target.value)
  if (props.teamId || !dms.mergeThreadReplies) return own
  return dms.mergeThreadReplies(props.channelId, String(props.message.id), own ?? [])
})
const count = computed(() => list.value.length)
const loading = computed(() => replies.isLoading(target.value))
const error = computed(() => replies.errorOf(target.value))
const offline = computed(() => replies.isOffline(target.value))
// Parent abhi server par nahi gaya (local- id) to reply API call nahi ho sakti
const parentPending = computed(
  () =>
    String(props.message.id).startsWith('local-') ||
    props.message.backendSynced === false ||
    props.message.status === 'sending',
)

// (naya) Composer HTML bhejta hai (<p>hi</p>): thread mein saaf text dikhao
const HTML_TAG = /<\/?(p|br|div|span|strong|b|em|i|u|s|strike|del|ul|ol|li|code|pre|blockquote|a|h[1-6])\b[^>]*>/i
function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
function plain(value) {
  if (typeof value !== 'string' || !value) return value ?? ''
  let text = value
  if (!HTML_TAG.test(text) && /&lt;\/?[a-z]/i.test(text)) text = decodeEntities(text)
  if (!HTML_TAG.test(text)) return value
  return decodeEntities(
    text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function nameOf(userId, fallback = '') {
  const name = dms.usersById[userId]?.name
  if (name) return name
  if (fallback) return fallback
  return userId && userId === dms.meId ? 'You' : 'Unknown user'
}

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

// Thread khulte hi (ya parent badalne par) replies load karo: pehle cache, phir API.
// Khula rehne tak polling se dusre user ke naye replies bina reload ke aate hain.
watch(
  [target, parentPending],
  ([value, isPending], [previousTarget] = []) => {
    const targetChanged =
      !previousTarget ||
      value.teamId !== previousTarget.teamId ||
      value.channelId !== previousTarget.channelId ||
      value.messageId !== previousTarget.messageId
    if (previousTarget && targetChanged) replies.unwatchThread(previousTarget)
    if (isPending) return
    replies.watchThread(value)
    void replies.loadReplies(value).then(scrollToBottom)
  },
  { immediate: true },
)
watch(count, (next, prev) => {
  if (next > prev) void scrollToBottom()
})

onBeforeUnmount(() => replies.unwatchThread(target.value))

function send() {
  if (parentPending.value) return
  const sent = replies.sendReply(target.value, draft.value)
  if (sent) draft.value = ''
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
  <aside class="flex h-full w-full flex-col bg-white text-slate-800" aria-label="Reply Thread">
    <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 class="text-2xl font-normal text-slate-700">Reply Thread</h2>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        aria-label="Close thread"
        title="Close thread"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      </button>
    </header>

    <div ref="listEl" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <!-- Parent message -->
      <div class="flex gap-3" data-test="parent">
        <UserAvatar
          :name="nameOf(message.from, message.author)"
          :user-id="message.from"
          :size="40"
          ring="border-white"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-3">
            <span class="text-lg font-semibold text-slate-800">
              {{ nameOf(message.from, message.author) }}
            </span>
            <TimeAgo :value="message.createdAt" />
          </div>
          <p
            v-if="message.deleted"
            class="whitespace-pre-wrap break-words text-[15px] italic leading-relaxed text-slate-500"
            data-test="deleted-message"
          >
            (message deleted)
          </p>
          <template v-else>
            <p
              v-if="message.forwardedFrom"
              class="text-xs italic text-slate-500"
              data-test="forwarded-label"
            >
              (forwarded)
            </p>
            <p class="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
              {{ plain(message.text ?? message.content ?? message.body) }}
            </p>
          </template>
        </div>
      </div>

      <!-- "5 Replies" ——————— -->
      <div class="my-4 flex items-center gap-3 text-sm text-slate-600">
        <span data-test="reply-count">{{ count }} {{ count === 1 ? 'Reply' : 'Replies' }}</span>
        <span class="h-px flex-1 bg-slate-200" />
      </div>

      <p v-if="parentPending" class="text-sm text-slate-500">
        Message abhi send ho raha hai. Send hone ke baad reply kar sakte hain.
      </p>
      <p v-else-if="loading && !list.length" class="text-sm text-slate-500">Loading replies…</p>
      <p v-if="error" class="mb-3 text-sm text-slate-500" data-test="replies-error">
        <template v-if="offline">Offline: showing saved replies.</template>
        <template v-else>{{ error }}</template>
        <button class="ml-1 text-indigo-600 underline" @click="replies.loadReplies(target, { force: true })">
          Retry
        </button>
      </p>

      <ul class="space-y-4">
        <li v-for="reply in list" :key="reply.id" class="flex gap-3" data-test="reply">
          <UserAvatar
            :name="nameOf(reply.from, reply.author)"
            :user-id="reply.from"
            :size="40"
            ring="border-white"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-3">
              <span class="text-lg font-semibold text-slate-800">
                {{ nameOf(reply.from, reply.author) }}
              </span>
              <TimeAgo :value="reply.createdAt" />
            </div>
            <p
              v-if="reply.deleted"
              class="whitespace-pre-wrap break-words text-[15px] italic leading-relaxed text-slate-500"
              data-test="deleted-message"
            >
              (message deleted)
            </p>
            <template v-else>
              <p
                v-if="reply.forwardedFrom"
                class="text-xs italic text-slate-500"
                data-test="forwarded-label"
              >
                (forwarded)
              </p>
              <p
                class="whitespace-pre-wrap break-words text-[15px] leading-relaxed"
                :class="reply.status === 'sending' ? 'text-slate-400' : 'text-slate-700'"
              >
                {{ plain(reply.text ?? reply.content ?? reply.body) }}
              </p>
            </template>
            <p v-if="reply.status === 'sending'" class="text-xs text-slate-400">Sending…</p>
            <p v-else-if="reply.status === 'failed'" class="text-xs text-red-600">
              Not sent{{ reply.error && reply.error !== 'Not sent' ? `: ${reply.error}` : '' }}
              <button class="ml-1 underline" @click="replies.retryReply(target, reply.id)">Retry</button>
              <button class="ml-1 underline" @click="replies.discardReply(target, reply.id)">Delete</button>
            </p>
          </div>
        </li>
      </ul>
    </div>

    <footer class="p-4">
      <div class="flex items-end gap-2 rounded-md border border-slate-300 px-3 py-2 focus-within:border-indigo-500">
        <textarea
          v-model="draft"
          rows="2"
          placeholder="Add a comment..."
          aria-label="Reply"
          :disabled="parentPending"
          class="min-w-0 flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-slate-400"
          @keydown="onKeydown"
        />
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          aria-label="Send reply"
          title="Send reply"
          :disabled="!draft.trim() || parentPending"
          @click="send"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z" />
          </svg>
        </button>
      </div>
    </footer>
  </aside>
</template>