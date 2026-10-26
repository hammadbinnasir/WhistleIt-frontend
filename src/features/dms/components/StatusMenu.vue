<script setup>
import { computed, ref } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore, STATES } from '@/stores/presence'
import UserAvatar from './UserAvatar.vue'

const dms = useDmStore()
const presence = usePresenceStore()

const open = ref(false)
const emoji = ref('')
const text = ref('')

const me = computed(() => dms.usersById[dms.meId])
const quick = [
  { emoji: '💻', text: 'Coding' },
  { emoji: '🍔', text: 'Lunch' },
  { emoji: '📅', text: 'In a meeting' },
  { emoji: '🌴', text: 'On leave' },
]

function toggle() {
  open.value = !open.value
  if (open.value) {
    const c = presence.customOf(dms.meId)
    emoji.value = c.emoji
    text.value = c.text
  }
}
function pickQuick(q) { emoji.value = q.emoji; text.value = q.text }
function save() { presence.setMyStatus(emoji.value, text.value); open.value = false }
function clear() { presence.clearMyStatus(); emoji.value = ''; text.value = ''; open.value = false }
</script>

<template>
  <div class="border-t border-white/10 pt-3">
    <button class="flex w-full items-center gap-3 text-left" @click="toggle">
      <UserAvatar :name="me?.name ?? 'Me'" :size="32" :user-id="dms.meId" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-white">{{ me?.name }}</span>
        <span class="block truncate text-xs text-slate-400">{{ presence.labelOf(dms.meId) }}</span>
      </span>
      <span class="text-xs text-slate-400">{{ open ? '▾' : '▴' }}</span>
    </button>

    <div v-if="open" class="mt-3 space-y-3 rounded-md bg-slate-800 p-3 text-sm">
      <!-- Online / Away / Offline -->
      <div class="flex gap-1">
        <button
          v-for="(label, key) in STATES"
          :key="key"
          class="flex-1 rounded px-2 py-1 text-xs"
          :class="presence.stateOf(dms.meId) === key ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'"
          @click="presence.setMyState(key)"
        >
          {{ label }}
        </button>
      </div>

      <!-- Custom status -->
      <div class="flex flex-wrap gap-1">
        <button
          v-for="q in quick"
          :key="q.text"
          class="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-600"
          @click="pickQuick(q)"
        >
          {{ q.emoji }} {{ q.text }}
        </button>
      </div>

      <div class="flex gap-2">
        <input v-model="emoji" maxlength="2" placeholder="😀" class="w-10 rounded bg-slate-700 px-2 py-1 text-center text-white outline-none" />
        <input v-model="text" placeholder="Status likhein…" class="min-w-0 flex-1 rounded bg-slate-700 px-2 py-1 text-white placeholder-slate-400 outline-none" />
      </div>

      <div class="flex justify-between">
        <button class="text-xs text-slate-300 underline" @click="clear">Clear status</button>
        <button class="rounded bg-indigo-500 px-3 py-1 text-xs font-semibold text-white" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>