<script setup>
// Right side of the channel/DM header.
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import pinChatIcon from '@/assets/pin-chat.svg'

const props = defineProps({
  isDm: { type: Boolean, default: false },
  conversationId: { type: [String, Number], default: '' },
})
const ui = useUiStore()
const panelMenuOpen = ref(false)
const showPanelMenu = computed(() => ['reminders', 'pinned', 'poll-history'].includes(ui.activePanel))
const hasCurrentConversationPins = computed(() =>
  ui.pinnedMessages.some((item) => {
    const conversation = item.conversation || {}
    const kind = conversation.kind === 'dm' || conversation.type === 'dm' ? 'dm' : 'channel'
    return kind === (props.isDm ? 'dm' : 'channel') &&
      String(conversation.id ?? '') === String(props.conversationId ?? '')
  }),
)

</script>

<template>
  <div class="flex items-center gap-3">
    <button
      v-if="!showPanelMenu"
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
    <button
      v-if="hasCurrentConversationPins && !showPanelMenu"
      class="icon-btn"
      title="Pinned messages"
      aria-label="Pinned messages"
      @click="ui.openPanel('pinned')"
    >
      <img class="header-pin-icon" :src="pinChatIcon" alt="" aria-hidden="true" />
    </button>
    <button
      v-if="!showPanelMenu"
      class="icon-btn"
      title="Search"
      aria-label="Search"
      @click="ui.openPanel('search')"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
    <div
      v-if="showPanelMenu"
      class="flex items-center gap-3"
      @mouseenter="panelMenuOpen = true"
      @mouseleave="panelMenuOpen = false"
      @focusin="panelMenuOpen = true"
      @focusout="
        (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) panelMenuOpen = false
        }
      "
    >
      <div
        class="flex shrink-0 items-center gap-3 overflow-hidden transition-[max-width,opacity] duration-200 ease-out"
        :class="panelMenuOpen ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0'"
        :aria-hidden="!panelMenuOpen"
      >
        <button
          type="button"
          class="icon-btn shrink-0"
          title="Reminders"
          aria-label="Reminders"
          :tabindex="panelMenuOpen ? 0 : -1"
          @click="ui.activePanel = 'reminders'"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2M5 3 2 6M19 3l3 3" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn shrink-0"
          title="Search"
          aria-label="Search"
          :tabindex="panelMenuOpen ? 0 : -1"
          @click="ui.activePanel = 'search'"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
        <button
          v-if="hasCurrentConversationPins"
          type="button"
          class="icon-btn shrink-0"
          title="Pinned messages"
          aria-label="Pinned messages"
          :tabindex="panelMenuOpen ? 0 : -1"
          @click="ui.activePanel = 'pinned'"
        >
          <img class="header-pin-icon" :src="pinChatIcon" alt="" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        class="icon-btn panel-menu-trigger"
        :class="{ 'panel-menu-trigger--active': panelMenuOpen }"
        title="More conversation panels"
        aria-label="More conversation panels"
        :aria-expanded="panelMenuOpen"
        @click="panelMenuOpen = !panelMenuOpen"
      >
        <span class="panel-menu-trigger__inner">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </span>
      </button>
    </div>
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

.panel-menu-trigger {
  @apply border-transparent bg-transparent hover:bg-slate-200;
}

.panel-menu-trigger--active,
.panel-menu-trigger:hover,
.panel-menu-trigger:focus-visible {
  @apply bg-slate-200;
}

.panel-menu-trigger__inner {
  @apply flex h-8 w-8 items-center justify-center rounded-full border border-indigo-500 text-indigo-600;
}

.header-pin-icon {
  width: 22px;
  height: 22px;
}
</style>
