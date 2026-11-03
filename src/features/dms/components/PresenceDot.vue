<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: { type: String, default: 'offline' },
  size: { type: Number, default: 10 },
  ring: { type: String, default: 'border-slate-900' }, // background ke rang ka border
})

const color = computed(
  () =>
    ({ online: 'bg-green-500', away: 'bg-amber-400', offline: 'bg-white' })[props.state] ??
    'bg-slate-500',
)
const isOffline = computed(() => props.state === 'offline')
</script>

<template>
  <span
    class="flex items-center justify-center rounded-full"
    :class="[color, isOffline ? 'border border-slate-400' : ['border-2', ring]]"
    :style="{ width: size + 'px', height: size + 'px' }"
    :title="state"
  >
    <svg
      v-if="state === 'online'"
      aria-hidden="true"
      class="h-[65%] w-[65%]"
      viewBox="0 0 16 16"
      fill="none"
      stroke="white"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m3 8 3.2 3.2L13 4.8" />
    </svg>
  </span>
</template>
