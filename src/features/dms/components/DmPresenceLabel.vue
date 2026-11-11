<script setup>
import { computed } from 'vue'
import { usePresenceStore, STATES } from '@/features/dms/stores/presence'

// Chat header mein naam ke neeche: "● Online" / "● Away" / "● Offline" (live)
// <DmPresenceLabel :user-id="partnerId" />
const props = defineProps({
  userId: { type: String, default: null },
})

const presence = usePresenceStore()
const state = computed(() => (props.userId ? presence.stateOf(props.userId) : 'offline'))
const label = computed(() => STATES[state.value])
const custom = computed(() => (props.userId ? presence.customOf(props.userId) : null))
</script>

<template>
  <span
    v-if="userId"
    class="inline-flex items-center gap-1.5 text-sm text-slate-600"
    :title="presence.labelOf(userId)"
    data-test="presence-label"
  >
    <span
      class="h-2.5 w-2.5 rounded-full"
      :class="state === 'online' ? 'bg-emerald-500' : state === 'away' ? 'bg-amber-400' : 'bg-slate-400'"
      aria-hidden="true"
    />
    {{ label }}
    <span v-if="custom?.emoji || custom?.text" class="text-slate-500">· {{ custom.emoji }} {{ custom.text }}</span>
  </span>
</template>