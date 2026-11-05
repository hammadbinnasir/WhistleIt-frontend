<script setup>
defineProps({
  state: { type: String, default: null }, // online | away | offline | null (group)
  size: { type: Number, default: 22 },
})

const colors = { online: 'text-emerald-400', away: 'text-amber-400', offline: 'text-slate-400' }
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :width="size"
    :height="size"
    :class="colors[state] ?? 'text-slate-400'"
    class="shrink-0"
  >
    <!-- Person + presence badge -->
    <template v-if="state">
      <circle cx="10" cy="7.5" r="3.5" />
      <path d="M3.5 20.5c0-3.6 2.9-6 6.5-6 1.1 0 2.1.2 3 .7" />
      <path v-if="state === 'online'" d="M14.5 18.5l2.2 2.2 4.3-4.6" />
      <path v-else-if="state === 'offline'" d="M15.5 16.5l4.5 4.5M20 16.5l-4.5 4.5" />
      <template v-else>
        <circle cx="17.5" cy="18.5" r="3.3" />
        <path d="M17.5 16.8v1.8l1.2.8" />
      </template>
    </template>

    <!-- Group icon (jab user group DM banaye) -->
    <template v-else>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c0-3.2 2.7-5 6-5s6 1.8 6 5" />
      <path d="M16 14.2c2.6 0 5 1.4 5 4.2" />
    </template>
  </svg>
</template>
