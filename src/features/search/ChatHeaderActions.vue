<script setup>
import { useUiStore } from '@/stores/ui'

defineProps({
  isDm: { type: Boolean, default: false },
})

const ui = useUiStore()

function togglePanel(panel) {
  ui.activePanel = ui.activePanel === panel ? null : panel
}
</script>

<template>
  <div class="chat-actions" aria-label="Conversation tools">
    <button
      class="chat-actions__button"
      :class="{ 'chat-actions__button--active': ui.activePanel === 'reminders' }"
      type="button"
      aria-label="Reminders"
      title="Reminders"
      @click="togglePanel('reminders')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
        <path d="M8 2 6 4M16 2l2 2" />
      </svg>
    </button>
    <button
      class="chat-actions__button"
      :class="{ 'chat-actions__button--active': ui.activePanel === 'search' }"
      type="button"
      aria-label="Search messages"
      title="Search"
      @click="togglePanel('search')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.8" cy="10.8" r="7.2" />
        <path d="m16 16 5 5" />
      </svg>
    </button>
    <button
      v-if="!isDm"
      class="chat-actions__button"
      :class="{ 'chat-actions__button--active': ui.channelSettingsOpen }"
      type="button"
      aria-label="Channel settings"
      title="Channel settings"
      @click="ui.channelSettingsOpen = true"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chat-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.chat-actions__button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  background: #fff;
  color: #44445a;
  cursor: pointer;
}
.chat-actions__button:hover,
.chat-actions__button--active {
  border-color: #5b5cff;
  color: #5b5cff;
  background: #f5f5ff;
}
.chat-actions__button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
