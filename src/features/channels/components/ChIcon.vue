<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
  filled: { type: Boolean, default: false },
})

const PATHS = {
  globe:
    'M12 22a10 10 0 100-20 10 10 0 000 20z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  lock: 'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z M7 11V7a5 5 0 0110 0v4',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  plus: 'M12 5v14M5 12h14',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  close: 'M18 6L6 18M6 6l12 12',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  users:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  more: 'M12 12h.01M5 12h.01M19 12h.01',
  'bell-off':
    'M13.73 21a2 2 0 01-3.46 0 M18.63 13A17.89 17.89 0 0118 8 M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14 M18 8a6 6 0 00-9.33-5 M1 1l22 22',
}
</script>

<template>
  <svg
    class="ch-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    :stroke-width="name === 'more' ? 3 : 2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>

<style scoped>
.ch-icon {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}
</style>
