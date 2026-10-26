<script setup>
// Right side of the channel/DM header.
// Channel: Reminders + Search + Settings.  DM: Reminders + Search only.
import { useUiStore } from '@/stores/ui'

defineProps({ isDm: { type: Boolean, default: false } })
const ui = useUiStore()
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      class="icon-btn"
      title="Reminders"
      aria-label="Reminders"
      @click="ui.openPanel('reminders')"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M5 3 2 6M19 3l3 3" />
      </svg>
    </button>
    <button class="icon-btn" title="Search" aria-label="Search" @click="ui.openPanel('search')">
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
    <button
      v-if="!isDm"
      class="icon-btn"
      title="Channel settings"
      aria-label="Channel settings"
      @click="ui.openChannelSettings()"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
@reference "../../assets/main.css";

.icon-btn {
  @apply flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600;
}
</style>