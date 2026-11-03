<script setup>
import { computed } from 'vue'
import { usePresenceStore } from '@/features/dms/stores/presence'
import PresenceDot from './PresenceDot.vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 32 },
  userId: { type: String, default: null }, // dene par online dot dikhega
  ring: { type: String, default: 'border-slate-900' },
})

const presence = usePresenceStore()

const initials = computed(() =>
  props.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join(''),
)
const color = computed(() => {
  let hash = 0
  for (const ch of props.name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`
})
</script>

<template>
  <div class="relative shrink-0" :style="{ width: size + 'px', height: size + 'px' }">
    <div
      class="flex h-full w-full items-center justify-center rounded-md font-semibold text-white"
      :style="{ background: color, fontSize: size * 0.4 + 'px' }"
    >
      {{ initials }}
    </div>
    <PresenceDot
      v-if="userId"
      class="absolute -bottom-0.5 -right-0.5"
      :state="presence.stateOf(userId)"
      :ring="ring"
      :size="Math.max(8, Math.round(size * 0.38))"
    />
  </div>
</template>
