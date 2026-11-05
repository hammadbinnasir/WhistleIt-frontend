<script setup>
// Built-in icons for the Help topics. Used until a topic gets its own image (iconMedia).
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 18 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="name === 'star' ? 'currentColor' : 'none'"
    :stroke="name === 'star' ? 'none' : 'currentColor'"
    stroke-width="2"
    aria-hidden="true"
  >
    <polygon
      v-if="name === 'star'"
      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
    />
    <template v-else-if="name === 'chat'">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="14" y2="13" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </template>
  </svg>
</template>
