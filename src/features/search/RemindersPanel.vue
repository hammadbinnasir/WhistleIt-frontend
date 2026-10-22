<script setup>
// Right-side "Reminders" drawer. Shows every reminder set on a message.
import { ref } from 'vue'
import { useRemindersStore } from './reminders'
import { useUiStore } from '@/stores/ui'

const store = useRemindersStore()
const ui = useUiStore()
const editingId = ref(null)
const editText = ref('')

const fmt = (iso) => {
  const d = new Date(iso)
  const date = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `${date} . Today` : date
}
const startEdit = (r) => { editingId.value = r.id; editText.value = r.text }
const saveEdit = (r) => { store.update(r.id, { text: editText.value }); editingId.value = null }
</script>

<template>
  <aside class="flex h-full w-[360px] flex-col border-l border-slate-200 bg-white">
    <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 class="text-lg text-slate-700">Reminders</h2>
      <button class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-slate-600" aria-label="Close" @click="ui.closePanel()">✕</button>
    </header>

    <div class="flex-1 space-y-3 overflow-y-auto p-4">
      <p v-if="!store.sorted.length" class="mt-10 text-center text-sm text-slate-500">
        No reminders yet. Use "Remind me" on a message to add one.
      </p>

      <div v-for="r in store.sorted" :key="r.id" class="relative border-l-4 bg-slate-50 p-3" :class="r.fired ? 'border-amber-400' : 'border-blue-500'">
        <button class="absolute right-2 top-2 text-slate-400 hover:text-slate-600" aria-label="Edit reminder" @click="startEdit(r)">✎</button>
        <p class="text-sm font-bold text-slate-900">
          In {{ r.conversationType === 'dm' ? 'conversation with' : 'channel' }}
          <span class="font-normal text-blue-500">@{{ r.conversationName }}</span>
        </p>
        <p class="mt-1 text-sm font-bold text-slate-900">Message:</p>
        <template v-if="editingId === r.id">
          <textarea v-model="editText" rows="2" class="mt-1 w-full rounded border border-slate-300 p-2 text-sm"></textarea>
          <div class="mt-1 flex gap-2 text-xs">
            <button class="text-indigo-600" @click="saveEdit(r)">Save</button>
            <button class="text-slate-500" @click="editingId = null">Cancel</button>
          </div>
        </template>
        <p v-else class="mt-1 max-h-14 overflow-y-auto break-words text-sm text-slate-800">{{ r.text }}</p>
        <p class="mt-3 text-xs text-slate-500">{{ fmt(r.remindAt) }}<span v-if="r.fired" class="ml-2 text-amber-600">Due</span></p>
        <button class="mt-2 text-xs text-red-600" @click="store.remove(r.id)">Delete Reminder</button>
      </div>
    </div>
  </aside>
</template>
