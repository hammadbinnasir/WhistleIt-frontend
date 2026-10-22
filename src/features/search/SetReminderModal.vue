<script setup>
// Opened from a message's action menu ("Remind me"). Saves into the reminders store.
import { ref, computed } from 'vue'
import { useRemindersStore } from './reminders'

const props = defineProps({
  // { conversationId, conversationName, conversationType, messageId, text }
  message: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const store = useRemindersStore()

const presets = [
  { label: 'In 20 minutes', mins: 20 },
  { label: 'In 1 hour', mins: 60 },
  { label: 'In 3 hours', mins: 180 },
  { label: 'Tomorrow', mins: 24 * 60 },
]
const toLocalInput = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const when = ref(toLocalInput(new Date(Date.now() + 20 * 60000)))
const valid = computed(() => new Date(when.value).getTime() > Date.now())

const pick = (mins) => {
  when.value = toLocalInput(new Date(Date.now() + mins * 60000))
}
function save() {
  if (!valid.value) return
  store.add({ ...props.message, remindAt: new Date(when.value).toISOString() })
  emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="emit('close')"
  >
    <div class="w-[360px] rounded-lg bg-white p-5 shadow-xl">
      <h3 class="mb-3 text-lg font-semibold text-slate-800">Remind me about this message</h3>
      <p class="mb-3 line-clamp-2 rounded bg-slate-50 p-2 text-sm text-slate-600">
        {{ message.text }}
      </p>
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="p in presets"
          :key="p.label"
          class="rounded-full border border-indigo-200 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50"
          @click="pick(p.mins)"
        >
          {{ p.label }}
        </button>
      </div>
      <input
        v-model="when"
        type="datetime-local"
        class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <p v-if="!valid" class="mt-1 text-xs text-red-500">Pick a time in the future.</p>
      <div class="mt-4 flex justify-end gap-2">
        <button class="px-3 py-2 text-sm text-slate-500" @click="emit('close')">Cancel</button>
        <button
          class="rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="!valid"
          @click="save"
        >
          Set reminder
        </button>
      </div>
    </div>
  </div>
</template>
