<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { useRepliesStore } from '@/features/dms/stores/Replies'
import { fullDateTimeLabel, relativeTimeLabel } from '@/features/messages/message-utils'

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
const parentPending = computed(() => {
  const id = String(props.message.id ?? '')
  return id.startsWith('local-') || props.message.serverBacked === false || props.message.backendSynced === false
})

function nameOf(userId, fallback) {
  if (userId && userId === dms.meId) return dms.usersById[userId]?.name || 'You'
  const knownName = userId ? dms.usersById[userId]?.name : ''
  if (knownName) return knownName
  if (typeof fallback === 'string' && fallback.trim()) return fallback
  if (fallback && typeof fallback === 'object') {
    return (
      fallback.name ??
      fallback.full_name ??
      fallback.fullName ??
      fallback.display_name ??
      fallback.username ??
      'Unknown user'
    )
  }
  return 'Unknown user'
}

function personOf(userId, fallback) {
  const cached = userId ? dms.usersById[userId] : null
  const source = fallback && typeof fallback === 'object' ? fallback : {}
  const name = nameOf(userId, fallback)
  return {
    name,
    avatarUrl:
      source.avatarUrl ??
      source.avatar_url ??
      source.profile_image_url ??
      source.photo_url ??
      cached?.avatarUrl ??
      cached?.avatar_url ??
      '',
  }
}

function initialsOf(name) {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  )
}

function avatarColor(name) {
  const colors = ['#7138c8', '#536dd1', '#a04ac2', '#2e8b78', '#d56f25']
  let hash = 0
  for (const char of String(name || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

// Thread khulte hi (ya parent badalne par) replies load karo: pehle cache, phir API
watch(
  [target, parentPending],
  ([value, pending]) => {
    if (!pending) void replies.loadReplies(value).then(scrollToBottom)
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
  <aside class="thread-panel" aria-label="Reply thread">
    <header class="thread-panel__header">
      <h2>Reply Thread</h2>
      <button
        class="thread-panel__close"
        aria-label="Close thread"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </button>
    </header>

    <div ref="listEl" class="thread-panel__scroll">
      <article class="thread-panel__parent" data-test="parent">
        <div class="thread-panel__avatar" :style="{ backgroundColor: avatarColor(personOf(message.from, message.author ?? message.sender).name) }">
          <img
            v-if="personOf(message.from, message.author ?? message.sender).avatarUrl"
            :src="personOf(message.from, message.author ?? message.sender).avatarUrl"
            :alt="personOf(message.from, message.author ?? message.sender).name"
          />
          <template v-else>{{ initialsOf(personOf(message.from, message.author ?? message.sender).name) }}</template>
        </div>
        <div class="thread-panel__content">
          <div class="thread-panel__meta">
            <strong>{{ personOf(message.from, message.author ?? message.sender).name }}</strong>
            <time
              v-if="message.createdAt"
              :datetime="message.createdAt"
              :title="fullDateTimeLabel(message.createdAt)"
            >
              {{ relativeTimeLabel(message.createdAt) }}
            </time>
          </div>
          <p class="thread-panel__text">{{ message.text ?? message.content ?? message.body }}</p>
        </div>
      </article>

      <div class="thread-panel__reply-divider">
        <span data-test="reply-count">
          {{ list.length }} {{ list.length === 1 ? 'Reply' : 'Replies' }}
        </span>
      </div>

      <p v-if="!parentPending && loading && !list.length" class="thread-panel__notice">
        Loading replies…
      </p>
      <p v-if="error" class="thread-panel__error" data-test="replies-error">
        <template v-if="offline">Offline: showing saved replies.</template>
        <template v-else>{{ error }}</template>
        <button @click="replies.loadReplies(target, { force: true })">
          Retry
        </button>
      </p>

      <ul class="thread-panel__replies">
        <li v-for="reply in list" :key="reply.id" class="thread-panel__reply" data-test="reply">
          <div class="thread-panel__avatar" :style="{ backgroundColor: avatarColor(personOf(reply.from, reply.author ?? reply.sender).name) }">
            <img
              v-if="personOf(reply.from, reply.author ?? reply.sender).avatarUrl"
              :src="personOf(reply.from, reply.author ?? reply.sender).avatarUrl"
              :alt="personOf(reply.from, reply.author ?? reply.sender).name"
            />
            <template v-else>{{ initialsOf(personOf(reply.from, reply.author ?? reply.sender).name) }}</template>
          </div>
          <div class="thread-panel__content">
            <div class="thread-panel__meta">
              <strong>{{ personOf(reply.from, reply.author ?? reply.sender).name }}</strong>
              <time
                v-if="reply.createdAt"
                :datetime="reply.createdAt"
                :title="fullDateTimeLabel(reply.createdAt)"
              >
                {{ relativeTimeLabel(reply.createdAt) }}
              </time>
            </div>
            <p class="thread-panel__text" :class="{ 'thread-panel__text--sending': reply.status === 'sending' }">
              {{ reply.text ?? reply.content ?? reply.body }}
            </p>
            <p v-if="reply.status === 'sending'" class="thread-panel__status">Sending…</p>
            <p v-else-if="reply.status === 'failed'" class="thread-panel__status thread-panel__status--error">
            Not sent{{ reply.error && reply.error !== 'Not sent' ? `: ${reply.error}` : '' }}
              <button @click="replies.retryReply(target, reply.id)">
              Retry
              </button>
              <button @click="replies.discardReply(target, reply.id)">Delete</button>
            </p>
          </div>
        </li>
      </ul>
    </div>

    <footer class="thread-panel__footer">
      <textarea
        v-model="draft"
        rows="2"
        placeholder="Add a comment..."
        aria-label="Reply"
        :disabled="parentPending"
        @keydown="onKeydown"
      />
      <button
        class="thread-panel__send"
        aria-label="Send reply"
        :disabled="!draft.trim() || parentPending"
        @click="send"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 11 18-8-7 18-3-7-8-3Zm8 3 5-6" />
        </svg>
        <span>Send</span>
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.thread-panel {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
  color: #242638;
  font-family: inherit;
}

.thread-panel__header {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e1e3eb;
  padding: 0 16px;
}

.thread-panel__header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.thread-panel__close {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #555b70;
  cursor: pointer;
}

.thread-panel__close:hover {
  background: #f0f1f6;
}

.thread-panel__close svg,
.thread-panel__send svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.thread-panel__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 0 20px;
}

.thread-panel__parent,
.thread-panel__reply {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 10px;
  padding: 0 12px;
}

.thread-panel__avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.thread-panel__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thread-panel__content {
  min-width: 0;
}

.thread-panel__meta {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 6px;
}

.thread-panel__meta strong {
  overflow: hidden;
  color: #202235;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-panel__meta time {
  flex: none;
  color: #777b8d;
  font-size: 12px;
}

.thread-panel__text {
  min-height: 34px;
  margin: 0;
  border-radius: 4px;
  background: #eceef6;
  padding: 8px 10px;
  color: #303449;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.thread-panel__text--sending {
  color: #85889a;
}

.thread-panel__reply-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 12px;
  color: #222538;
  font-size: 12px;
}

.thread-panel__reply-divider::after {
  height: 1px;
  flex: 1;
  background: #dedfe5;
  content: '';
}

.thread-panel__replies {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.thread-panel__notice,
.thread-panel__error {
  margin: 12px;
  color: #686d82;
  font-size: 13px;
  line-height: 1.45;
}

.thread-panel__error {
  color: #b42335;
}

.thread-panel__error button,
.thread-panel__status button {
  margin-left: 8px;
  border: 0;
  background: none;
  color: #4c52c8;
  cursor: pointer;
  text-decoration: underline;
}

.thread-panel__status {
  margin: 5px 0 0;
  color: #777b8d;
  font-size: 12px;
}

.thread-panel__status--error {
  color: #b42335;
}

.thread-panel__status button {
  padding: 0;
  font-size: inherit;
}

.thread-panel__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  border-top: 1px solid #e1e3eb;
  padding: 10px 12px;
}

.thread-panel__footer textarea {
  min-height: 54px;
  max-height: 150px;
  resize: vertical;
  border: 1px solid #cdd0dd;
  border-radius: 4px;
  padding: 10px;
  color: #292c40;
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  outline: none;
}

.thread-panel__footer textarea:focus {
  border-color: #6764d7;
  box-shadow: 0 0 0 2px #6764d722;
}

.thread-panel__footer textarea::placeholder {
  color: #84889a;
}

.thread-panel__send {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 5px;
  background: #605ed0;
  padding: 0 10px;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.thread-panel__send:disabled {
  background: #aaa9d9;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .thread-panel__meta {
    flex-wrap: wrap;
    gap: 2px 8px;
  }

  .thread-panel__footer {
    grid-template-columns: minmax(0, 1fr);
  }

  .thread-panel__send {
    justify-self: end;
  }
}
</style>