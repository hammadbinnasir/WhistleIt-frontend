<script setup>
import { computed, nextTick, onBeforeUnmount } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useDmStore } from '@/stores/dms'
import pinnedMessagesEmptyIcon from '@/assets/pinned-messages-empty.svg'

const props = defineProps({
  conversationId: { type: [String, Number], default: '' },
  conversationType: { type: String, default: 'channel' },
})
const ui = useUiStore()
const dms = useDmStore()
const currentPinnedMessages = computed(() =>
  ui.pinnedMessages.filter((item) => {
    const conversation = item.conversation || {}
    const kind =
      conversation.kind === 'dm' || conversation.type === 'dm'
        ? 'dm'
        : 'channel'
    return (
      kind === props.conversationType &&
      String(conversation.id ?? '') === String(props.conversationId ?? '')
    )
  }),
)
const hasPinnedMessages = computed(() => currentPinnedMessages.value.length > 0)
let highlightTimer

function initials(name) {
  return String(name || 'You')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

async function jumpToMessage(message) {
  const conversation = message.conversation
  ui.closePanel()
  if (conversation?.type === 'dm') dms.openConversation(conversation.id)
  else if (conversation?.id) ui.selectChannel(conversation.id)
  await nextTick()
  const target = document.querySelector(`[data-message-id="${CSS.escape(String(message.id))}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (!target) return
  document.querySelectorAll('.pinned-jump-highlight').forEach((element) => {
    element.classList.remove('pinned-jump-highlight')
  })
  clearTimeout(highlightTimer)
  target.classList.add('pinned-jump-highlight')
  highlightTimer = setTimeout(() => {
    target.classList.remove('pinned-jump-highlight')
  }, 3000)
}

onBeforeUnmount(() => clearTimeout(highlightTimer))
</script>

<template>
  <aside class="flex h-full w-full flex-col bg-white">
    <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 class="text-xl text-slate-700">Pinned Messages</h2>
      <button
        class="cursor-pointer text-3xl font-black text-slate-800 hover:text-indigo-600"
        aria-label="Close pinned messages"
        @click="ui.closePanel()"
      >
        <i class="fa-solid fa-arrow-right-long text-lg text-slate-800" aria-hidden="true"></i>
      </button>
    </header>

    <div
      v-if="!hasPinnedMessages"
      class="flex flex-1 flex-col items-center px-6 pt-16 text-slate-500"
    >
      <img
        class="mb-6 h-24 w-24 text-[#8079a3]"
        :src="pinnedMessagesEmptyIcon"
        aria-hidden="true"
      />
      <div class="self-start text-base leading-8">
        <p class="flex gap-3"><span>•</span><span>There are no pinned messages yet.</span></p>
        <p class="flex gap-3">
          <span>•</span>
          <span
            >All members of this channel can pin important<br />or useful messages for easy
            reference.</span
          >
        </p>
      </div>
    </div>

    <ul v-else class="min-h-0 flex-1 divide-y overflow-y-auto">
      <li v-for="message in currentPinnedMessages" :key="message.id" class="px-5 py-4">
        <div class="mb-3 text-center">
          <span class="rounded bg-slate-100 px-3 py-1 text-xs text-slate-500">
            {{ formatDate(message.createdAt) }}
          </span>
        </div>
        <div class="flex gap-3">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white"
            aria-hidden="true"
          >
            {{ initials(message.author || message.sender) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-baseline gap-3">
                <span class="truncate font-semibold text-slate-900">
                  {{ message.author || message.sender || 'You' }}
                </span>
                <time class="shrink-0 text-xs text-slate-500">
                  {{ formatTime(message.createdAt || message.time) }}
                </time>
                <span class="rounded bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  PINNED
                </span>
              </div>
              <button
                type="button"
                class="jump-button"
                @click="jumpToMessage(message)"
              >
                JUMP
              </button>
            </div>
            <p class="mt-1 break-words text-slate-700">{{ message.content || message.text }}</p>
          </div>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
:global(.jump-button) {
  min-width: 36px;
  height: 20px;
  border: 1px solid #818cf8;
  border-radius: 2px;
  padding: 0 8px;
  background: transparent;
  color: #4f46e5;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
}

:global(.pinned-jump-highlight) {
  border-radius: 8px;
  background-color: #fef1bd;
}

:global(.pinned-jump-highlight .composer-conversation__message-bubble) {
  background-color: #fef1bd;
}
</style>
