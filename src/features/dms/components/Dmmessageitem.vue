<script setup>
import { computed, nextTick, ref } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { useRepliesStore } from '@/features/replies/stores/replies'
import UserAvatar from './UserAvatar.vue'
import TimeAgo from './Timeago.vue'
import MessageReactions from './Messagereactions.vue'
import ReplySummary from '@/features/replies/components/ReplySummary.vue'

defineOptions({ name: 'DirectMessageItem' })

// Ek DM message: avatar (online dot), naam, "3 days ago" (hover = poori date),
// text, reactions, "5 replies  Last reply: …", aur hover toolbar (react, reply, copy, more)
const props = defineProps({
  message: { type: Object, required: true },
  conversationId: { type: String, required: true },
  active: Boolean, // is message ka thread khula hai
})
const emit = defineEmits(['open-thread'])

const dms = useDmStore()
const replies = useRepliesStore()

const reactionsRef = ref(null)
const editing = ref(false)
const editText = ref('')
const menuOpen = ref(false)
const copied = ref(false)

const isLocal = computed(() => String(props.message.id).startsWith('local-'))
const mine = computed(() => props.message.from === dms.meId)
const isDeleted = computed(() => Boolean(props.message.deleted))
const author = computed(() => {
  const name = dms.usersById[props.message.from]?.name
  return name || (mine.value ? 'You' : 'Unknown user')
})
const target = computed(() => ({ channelId: props.conversationId, messageId: String(props.message.id) }))
const replyCount = computed(() => replies.countOf(target.value, props.message.replyCount ?? 0))
const lastReplyAt = computed(() => replies.lastReplyAtOf(target.value, props.message.lastReplyAt))

function react(emoji) {
  dms.toggleReaction(props.conversationId, props.message.id, emoji)
}
async function openPicker() {
  // pehla reaction: picker MessageReactions ke andar khulta hai
  reactionsRef.value?.openPicker()
  await nextTick()
}
function openThread() {
  if (!isLocal.value) emit('open-thread', props.message)
}
async function copyText() {
  try {
    await navigator.clipboard.writeText(props.message.text ?? '')
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* clipboard blocked */
  }
}
function startEdit() {
  menuOpen.value = false
  editText.value = props.message.text
  editing.value = true
}
function saveEdit() {
  dms.editMessage(props.conversationId, props.message.id, editText.value)
  editing.value = false
}
function remove() {
  menuOpen.value = false
  dms.deleteMessage(props.conversationId, props.message.id)
}
</script>

<template>
  <div
    class="group relative flex gap-3 px-6 py-3 transition-colors hover:bg-slate-50"
    :class="active ? 'bg-indigo-50/70' : ''"
    data-test="message"
    @mouseleave="menuOpen = false"
  >
    <UserAvatar :name="author" :user-id="message.from" :size="44" ring="border-white" class="mt-0.5" />

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-baseline gap-x-3">
        <span class="text-lg font-semibold text-slate-800">{{ author }}</span>
        <TimeAgo :value="message.createdAt" />
        <span v-if="message.editedAt && !isDeleted" class="text-xs text-slate-400">(edited)</span>
      </div>
      <div v-if="editing && !isDeleted" class="mt-1 flex gap-2">
        <input
          v-model="editText"
          class="min-w-0 flex-1 rounded border-2 border-indigo-300 px-2 py-1 outline-none focus:border-indigo-500"
          aria-label="Edit message"
          @keydown.enter="saveEdit"
          @keydown.esc="editing = false"
        />
        <button class="rounded bg-indigo-500 px-3 text-sm font-semibold text-white" @click="saveEdit">Save</button>
        <button class="px-2 text-sm text-slate-600" @click="editing = false">Cancel</button>
      </div>
      <p
        v-else-if="isDeleted"
        class="mt-1 text-[15px] italic leading-relaxed text-slate-500"
        data-test="message-deleted"
      >
        (message deleted)
      </p>
      <p
        v-else
        class="whitespace-pre-wrap break-words text-[15px] leading-relaxed"
        :class="message.status === 'sending' ? 'text-slate-400' : 'text-slate-700'"
        data-test="message-text"
      >
        {{ message.text }}
      </p>

      <p v-if="!isDeleted && message.status === 'sending'" class="text-xs text-slate-400">Sending…</p>
      <p v-else-if="!isDeleted && message.status === 'failed'" class="text-xs text-red-600">
        Not sent{{ message.error && message.error !== 'Not sent' ? `: ${message.error}` : '' }}
        <button class="ml-1 underline" @click="dms.retryMessage(conversationId, message.id)">Retry</button>
      </p>

      <MessageReactions
        v-if="!isDeleted"
        ref="reactionsRef"
        class="mt-2"
        :reactions="message.reactions ?? []"
        :me-id="dms.meId"
        :users-by-id="dms.usersById"
        @toggle="react"
      />

      <ReplySummary
        v-if="!isDeleted"
        class="mt-1 -ml-2"
        :count="replyCount"
        :last-reply-at="lastReplyAt"
        @open="openThread"
      />
    </div>

    <!-- Hover toolbar -->
    <div
      v-if="!editing && !isDeleted"
      class="absolute -top-3 right-6 z-20 hidden items-center gap-0.5 rounded-md border border-slate-200 bg-white p-1 shadow-sm group-hover:flex group-focus-within:flex"
    >
      <button class="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100" title="Add reaction" aria-label="Add reaction" @click="openPicker">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
          <circle cx="9" cy="10" r=".6" fill="currentColor" /><circle cx="15" cy="10" r=".6" fill="currentColor" />
        </svg>
      </button>
      <button v-if="!isLocal" class="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100" title="Reply in thread" aria-label="Reply in thread" @click="openThread">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M4 5h16v11H9l-5 4V5z" />
        </svg>
      </button>
      <button class="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100" :title="copied ? 'Copied' : 'Copy text'" :aria-label="copied ? 'Copied' : 'Copy text'" @click="copyText">
        <svg v-if="!copied" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
        </svg>
        <svg v-else viewBox="0 0 24 24" class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12l5 5 9-10" /></svg>
      </button>
      <div v-if="mine" class="relative">
        <button class="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100" title="More" aria-label="More actions" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
        <div v-if="menuOpen" class="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          <button v-if="!isLocal" class="block w-full px-3 py-1.5 text-left hover:bg-slate-100" @click="startEdit">Edit message</button>
          <button class="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50" @click="remove">Delete message</button>
        </div>
      </div>
    </div>
  </div>
</template>