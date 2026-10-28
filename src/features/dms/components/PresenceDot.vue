<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: { type: String, default: 'offline' },
  size: { type: Number, default: 10 },
  ring: { type: String, default: 'border-slate-900' }, // background ke rang ka border
})

const color = computed(
  () => ({ online: 'bg-green-500', away: 'bg-amber-400' })[props.state] ?? 'bg-slate-500',
)
</script>

<template>
  <span
    class="block rounded-full border-2"
    :class="[color, ring]"
    :style="{ width: size + 'px', height: size + 'px' }"
    :title="state"
  />
</template>
