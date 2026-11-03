<script setup>
import { computed, ref } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore, STATES } from '@/features/dms/stores/presence'
import UserAvatar from './UserAvatar.vue'

const dms = useDmStore()
const presence = usePresenceStore()

const open = ref(false)

const me = computed(() => dms.usersById[dms.meId])

function toggle() {
  open.value = !open.value
}
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
          :class="
            presence.stateOf(dms.meId) === key
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-700 text-slate-300'
          "
          @click="presence.setMyState(key)"
        >
          {{ label }}
        </button>
      </div>

    </div>
  </div>
</template>
