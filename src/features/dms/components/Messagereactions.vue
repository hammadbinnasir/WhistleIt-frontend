<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'MessageReactions' })

// Reactions: "👍 1" pills (apna reaction ho to neela) + ☺+ button se emoji picker.
// Toolbar ka emoji button bhi openPicker() se isi picker ko kholta hai.
const props = defineProps({
  reactions: { type: Array, default: () => [] },
  meId: { type: String, default: '' },
  usersById: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['toggle'])

const EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '🔥',
  '👏', '✅', '👀', '💯', '😊', '😍', '🤔', '🙌',
  '👌', '😅', '🚀', '💪', '⭐', '☕', '❌', '➕']

const open = ref(false)
const root = ref(null)
const list = computed(() => props.reactions.filter((r) => r?.users?.length))

const isMine = (reaction) => reaction.users.includes(props.meId)
function namesOf(reaction) {
  const names = reaction.users.map((id) =>
    id === props.meId ? 'You' : props.usersById[id]?.name || 'Someone',
  )
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  return `${who} reacted with ${reaction.emoji}`
}

function pick(emoji) {
  emit('toggle', emoji)
  open.value = false
}
function openPicker() {
  open.value = true
}
function onDocumentDown(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false
}
function onKey(event) {
  if (event.key === 'Escape') open.value = false
}
watch(open, (value) => {
  if (value) {
    document.addEventListener('mousedown', onDocumentDown)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('mousedown', onDocumentDown)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => (open.value = false))

defineExpose({ openPicker })
</script>

<template>
  <div ref="root" class="relative flex flex-wrap items-center gap-1.5" :class="{ hidden: !list.length && !open }">
    <!-- Hamesha render (khali ho to hidden), taake toolbar se pehla reaction bhi picker khol sake -->
    <button
      v-for="reaction in list"
      :key="reaction.emoji"
      type="button"
      class="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-sm transition"
      :class="
        isMine(reaction)
          ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
          : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300'
      "
      :title="namesOf(reaction)"
      :aria-pressed="isMine(reaction)"
      data-test="reaction"
      @click="emit('toggle', reaction.emoji)"
    >
      <span>{{ reaction.emoji }}</span>
      <span class="font-medium tabular-nums">{{ reaction.users.length }}</span>
    </button>

    <button
      v-if="list.length"
      type="button"
      class="inline-flex h-7 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 px-2 text-slate-500 hover:border-slate-300 hover:text-slate-700"
      aria-label="Add reaction"
      title="Add reaction"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
        <circle cx="9" cy="10" r=".6" fill="currentColor" />
        <circle cx="15" cy="10" r=".6" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>

    <div
      v-if="open"
      role="dialog"
      aria-label="Choose a reaction"
      class="absolute bottom-full left-0 z-40 mb-1 grid w-72 grid-cols-8 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
      data-test="emoji-picker"
    >
      <button
        v-for="emoji in EMOJIS"
        :key="emoji"
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-slate-100"
        :aria-label="`React with ${emoji}`"
        @click="pick(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>