<script setup>
import { computed } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import PresenceIcon from './PresenceIcon.vue'

const props = defineProps({
  conversation: { type: Object, required: true },
  active: Boolean,
})
defineEmits(['select', 'close'])

const dms = useDmStore()
const presence = usePresenceStore()

const title = computed(() => dms.titleOf(props.conversation))
const partnerId = computed(() => (props.conversation.type === 'dm' ? dms.partnerId(props.conversation) : null))
const state = computed(() => (partnerId.value ? presence.stateOf(partnerId.value) : null))
const custom = computed(() => (partnerId.value ? presence.customOf(partnerId.value) : null))
const tooltip = computed(() =>
  partnerId.value ? presence.labelOf(partnerId.value) : `${props.conversation.members.length} members`
)
</script>

<template>
  <!-- group: hover par X dikhane ke liye. X alag button hai kyunki button ke andar button nahi ho sakta -->
  <div class="group relative">
    <button
      class="flex w-full items-center gap-3 border-l-4 py-2 pl-4 pr-12 text-left text-[15px]"
      :class="active ? 'border-indigo-400 bg-indigo-500/25 text-white' : 'border-transparent text-indigo-200 hover:bg-white/5'"
      :title="tooltip"
      @click="$emit('select', conversation.id)"
    >
      <PresenceIcon :state="state" />

      <span class="min-w-0 flex-1 truncate" :class="conversation.unreadCount ? 'font-bold text-white' : ''">
        {{ title }}
      </span>

      <!-- Emoji + unread badge: hover par ya selected hone par chhup jate hain -->
      <span v-if="!active" class="flex items-center gap-2 group-hover:hidden">
        <span v-if="custom?.emoji" class="text-sm">{{ custom.emoji }}</span>
        <span v-if="conversation.unreadCount" class="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
          {{ conversation.unreadCount }}
        </span>
      </span>
    </button>

    <!-- Close (X): selected row par hamesha, baaqi par hover par -->
    <button
      type="button"
      class="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-white hover:bg-white/15"
      :class="active ? 'flex' : 'hidden group-hover:flex'"
      title="Close conversation"
      aria-label="Close conversation"
      @click.stop="dms.closeConversation(conversation.id)"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>