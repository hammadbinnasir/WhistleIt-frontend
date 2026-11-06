<script setup>
// Right-side "Reminders" drawer. Shows reminders for the selected conversation.
import { computed, ref } from 'vue'
import { useRemindersStore } from './reminders'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  conversationId: { type: [String, Number], default: '' },
  conversationType: { type: String, default: 'channel' },
})
const store = useRemindersStore()
const ui = useUiStore()
const editingId = ref(null)
const editText = ref('')
const deletedExpanded = ref(true)
const hasConversation = computed(() => props.conversationId !== '' && props.conversationId != null)
const matchesConversation = (reminder) =>
  !hasConversation.value ||
  (String(reminder.conversationId ?? 'general') === String(props.conversationId) &&
    (reminder.conversationType === 'dm' ? 'dm' : 'channel') ===
      (props.conversationType === 'dm' ? 'dm' : 'channel'))
const visibleReminders = computed(() => store.sorted.filter(matchesConversation))
const visibleDeletedReminders = computed(() => store.deletedItems.filter(matchesConversation))
const hasDeleted = computed(() => visibleDeletedReminders.value.length > 0)

const fmt = (iso) => {
  const d = new Date(iso)
  const date = d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return d.toDateString() === new Date().toDateString() ? `${date} . Today` : date
}
const startEdit = (r) => {
  editingId.value = r.id
  editText.value = r.text
}
const saveEdit = (r) => {
  store.update(r.id, { text: editText.value })
  editingId.value = null
}
</script>

<template>
  <aside class="flex h-full w-full flex-col bg-white">
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
      <h2 class="text-xl font-normal text-slate-800">Reminders</h2>
      <button
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-indigo-50 text-slate-600 transition-colors hover:text-slate-900"
        title="Close Reminders"
        aria-label="Close Reminders"
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

    <div
      v-if="!visibleReminders.length && !hasDeleted"
      class="flex flex-1 flex-col items-center justify-center px-8"
    >
      <svg
        viewBox="0 0 220 220"
        class="mb-10 h-48 w-48 text-slate-200"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="7"
        aria-hidden="true"
      >
        <path d="M86 24h48M110 24v18" />
        <path d="M64 50 49 36M156 50l15-14" />
        <circle cx="110" cy="123" r="67" />
        <path d="M110 79v45l37 22" />
      </svg>
      <ul class="list-disc space-y-2 self-start pl-7 text-base leading-7 text-slate-500">
        <li>There are no reminder messages yet.</li>
        <li>Here you can find all reminder messages.</li>
      </ul>
    </div>
    <div v-else class="flex-1 space-y-3 overflow-y-auto p-4">
      <div
        v-for="r in visibleReminders"
        :key="r.id"
        class="relative border-l-4 bg-slate-50 p-3"
        :class="r.fired ? 'border-amber-400' : 'border-red-500'"
      >
        <button
          class="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
          aria-label="Edit reminder"
          @click="startEdit(r)"
        >
          ✎
        </button>
        <p class="text-sm font-bold text-slate-900">
          In {{ r.conversationType === 'dm' ? 'conversation with' : 'channel' }}
          <span class="font-normal text-blue-500">@{{ r.conversationName }}</span>
        </p>
        <p v-if="r.title" class="mt-2 text-sm font-semibold text-slate-900">{{ r.title }}</p>
        <p class="mt-1 text-sm font-bold text-slate-900">Message:</p>
        <template v-if="editingId === r.id">
          <textarea
            v-model="editText"
            rows="2"
            class="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
          ></textarea>
          <div class="mt-1 flex gap-2 text-xs">
            <button class="text-indigo-600" @click="saveEdit(r)">Save</button>
            <button class="text-slate-500" @click="editingId = null">Cancel</button>
          </div>
        </template>
        <p v-else class="mt-1 max-h-14 overflow-y-auto break-words text-sm text-slate-800">
          {{ r.text }}
        </p>
        <p class="mt-3 text-xs text-slate-500">
          {{ fmt(r.remindAt) }}<span v-if="r.fired" class="ml-2 text-amber-600">Due</span>
        </p>
        <button class="mt-2 text-xs text-red-600" @click="store.remove(r.id)">
          Delete Reminder
        </button>
      </div>

      <section v-if="hasDeleted" class="px-0 pt-1">
        <button
          type="button"
          class="flex h-12 w-full items-center justify-between border-b border-slate-100 text-left text-base font-medium text-slate-800"
          @click="deletedExpanded = !deletedExpanded"
        >
          <span>Deleted Reminders</span>
          <svg
            class="h-4 w-4 shrink-0 transition-transform duration-150"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ 'rotate-180': !deletedExpanded }"
            aria-hidden="true"
          >
            <path d="m5 15 7-7 7 7" />
          </svg>
        </button>
        <div v-if="deletedExpanded" class="space-y-3">
          <div
            v-for="r in visibleDeletedReminders"
            :key="r.id"
            class="border-l-4 border-red-500 bg-slate-50 px-4 py-4"
          >
            <p class="text-sm font-bold text-slate-900">
              In {{ r.conversationType === 'dm' ? 'conversation with' : 'channel' }}
              <span class="font-normal text-blue-500">@{{ r.conversationName }}</span>
            </p>
            <p class="mt-2 text-sm font-bold text-slate-900">Message:</p>
            <p class="mt-1 break-words text-sm text-slate-800">{{ r.text }}</p>
            <p class="mt-3 text-xs text-slate-500">{{ fmt(r.deletedAt || r.remindAt) }}</p>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>
