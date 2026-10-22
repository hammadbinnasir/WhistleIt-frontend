<script setup>
import { ref, computed } from 'vue'
import { useMembersStore } from '@/stores/members'
import { useDmStore } from '@/stores/dms'

const emit = defineEmits(['close'])
const membersStore = useMembersStore()
const dmsStore = useDmStore()

const search = ref('')

const filteredMembers = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return membersStore.members
  return membersStore.members.filter(
    (m) => m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
  )
})

function startChat(memberId) {
  dmsStore.openConversation(memberId)
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
    <div
      class="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
    >
      <header class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <h3 class="text-base font-semibold text-white">Direct Message</h3>
        <button
          type="button"
          class="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          @click="emit('close')"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div class="p-4 border-b border-slate-800">
        <div class="relative">
          <input
            v-model="search"
            type="text"
            placeholder="Search by name or email..."
            class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            autofocus
          />
          <svg
            class="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      <div class="overflow-y-auto p-2 flex-1 divide-y divide-slate-800/40">
        <button
          v-for="member in filteredMembers"
          :key="member.id"
          type="button"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-slate-800/80 transition-colors cursor-pointer"
          @click="startChat(member.id)"
        >
          <div class="flex items-center gap-3">
            <div class="relative">
              <div
                class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white"
              >
                {{ member.name.slice(0, 2).toUpperCase() }}
              </div>
              <span
                class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-900"
                :class="member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'"
              />
            </div>
            <div>
              <p class="text-sm font-medium text-white">{{ member.name }}</p>
              <p class="text-xs text-slate-400">{{ member.email }}</p>
            </div>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full capitalize"
            :class="
              member.status === 'online'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-700/50 text-slate-400'
            "
          >
            {{ member.status }}
          </span>
        </button>

        <p v-if="!filteredMembers.length" class="text-center text-slate-400 py-6 text-sm">
          No members found.
        </p>
      </div>
    </div>
  </div>
</template>
