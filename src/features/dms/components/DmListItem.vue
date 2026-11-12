<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { useUserStore } from '@/features/account/composables/useUserStore'
import { customStatusTooltip } from '@/features/account/composables/statusExpiry'
import PresenceIcon from './PresenceIcon.vue'

const props = defineProps({
  conversation: { type: Object, required: true },
  active: Boolean,
  statusOnly: Boolean,
})
defineEmits(['select', 'close'])

const dms = useDmStore()
const presence = usePresenceStore()
const userStore = useUserStore()
const customEmoji = ref(null)
const customTooltipElement = ref(null)
const customTooltipVisible = ref(false)
const customTooltipPosition = ref({ left: 8, top: 8 })

const title = computed(() =>
  props.statusOnly ? props.conversation.name : dms.titleOf(props.conversation),
)
const partnerId = computed(() =>
  props.statusOnly
    ? dms.meId
    : props.conversation.type === 'dm'
      ? dms.partnerId(props.conversation)
      : null,
)
const state = computed(() => (partnerId.value ? presence.stateOf(partnerId.value) : null))
const isOwnStatus = computed(() => partnerId.value === dms.meId)
const custom = computed(() => {
  if (props.statusOnly) {
    const status = props.conversation.customStatus
    return status?.emoji || status?.text ? status : null
  }
  if (!partnerId.value) return null

  const liveStatus = presence.presenceById[partnerId.value]?.status
  const accountStatus = isOwnStatus.value
    ? {
        emoji: userStore.state.customStatusEmoji,
        text: userStore.state.customStatus,
        expiresAt: userStore.state.customStatusExpiresAt,
      }
    : null
  const peer = dms.usersById[partnerId.value]
  const status =
    accountStatus?.text || accountStatus?.emoji
      ? accountStatus
      : peer?.customStatusLoaded
        ? peer.customStatus
        : (liveStatus ?? peer?.customStatus)

  return status?.emoji || status?.text ? status : null
})
const customTooltip = computed(() =>
  customStatusTooltip(
    custom.value?.text,
    custom.value?.expiresAt ?? custom.value?.expires_at,
  ),
)
const unread = computed(() => Math.max(0, Number(props.conversation.unreadCount) || 0))
// (naya) PATCH .../recent ki halat: 'saving' | 'pending' | 'error' | ''
const recentStatus = computed(() => dms.recentStatusOf?.(props.conversation.id) ?? '')
const recentTitle = computed(
  () =>
    ({
      saving: 'Syncing…',
      pending: 'Saved on this device. Will sync when the connection is back.',
      // (naya) wajah bhi: mouse le jaane par pata chale kya hua
      error: `Could not sync${dms.recentErrorOf?.(props.conversation.id) ? `: ${dms.recentErrorOf(props.conversation.id)}` : ''}. Open the conversation again to retry.`,
    })[recentStatus.value] ?? '',
)
const unreadLabel = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))

function positionCustomTooltip() {
  const bounds = customEmoji.value?.getBoundingClientRect()
  if (!bounds) return

  const maxWidth = Math.max(0, window.innerWidth - 16)
  const tooltipBounds = customTooltipElement.value?.getBoundingClientRect()
  const tooltipWidth = Math.min(tooltipBounds?.width || 320, maxWidth)
  const tooltipHeight = tooltipBounds?.height || 40
  customTooltipPosition.value = {
    left: Math.max(
      8,
      Math.min(bounds.right - tooltipWidth + 30, window.innerWidth - tooltipWidth - 8),
    ),
    top:
      bounds.bottom + tooltipHeight + 4 <= window.innerHeight
        ? bounds.bottom + 4
        : Math.max(8, bounds.top - tooltipHeight - 4),
  }
}

function showCustomTooltip() {
  customTooltipVisible.value = true
  void nextTick(positionCustomTooltip)
  window.addEventListener('resize', positionCustomTooltip)
  window.addEventListener('scroll', positionCustomTooltip, true)
}

function hideCustomTooltip() {
  customTooltipVisible.value = false
  window.removeEventListener('resize', positionCustomTooltip)
  window.removeEventListener('scroll', positionCustomTooltip, true)
}

onBeforeUnmount(hideCustomTooltip)
</script>

<template>
  <!-- group: hover par X dikhane ke liye. X alag button hai kyunki button ke andar button nahi ho sakta -->
  <div class="group relative">
    <component
      :is="statusOnly ? 'div' : 'button'"
      class="flex w-full items-center gap-3 border-l-4 py-2 pl-4 pr-12 text-left text-[15px]"
      :class="
        active
          ? 'border-indigo-400 bg-indigo-500/25 text-white'
          : 'border-transparent text-indigo-200 hover:bg-white/5'
      "
      data-test="dm-row"
      @click="!statusOnly && $emit('select', conversation.id)"
    >
      <PresenceIcon :state="state" />

      <span
        class="min-w-0 flex-1 truncate"
        :class="conversation.unreadCount ? 'font-bold text-white' : ''"
      >
        {{ title }}
      </span>
      <span
        v-if="custom?.emoji"
        ref="customEmoji"
        class="shrink-0 cursor-default text-sm"
        :aria-label="`Custom status: ${customTooltip || custom.text}`"
        :aria-describedby="`custom-status-${conversation.id}`"
        role="img"
        tabindex="0"
        @mouseenter="showCustomTooltip"
        @mouseleave="hideCustomTooltip"
        @focus="showCustomTooltip"
        @blur="hideCustomTooltip"
      >
        {{ custom.emoji }}
      </span>

      <!-- (naya) recent sync: chalti request / offline queue / fail (dobara kholne par retry) -->
      <span
        v-if="recentStatus"
        class="flex h-4 w-4 shrink-0 items-center justify-center group-hover:invisible"
        :title="recentTitle"
        :aria-label="recentTitle"
        role="status"
        :data-test="`recent-${recentStatus}`"
      >
        <span
          v-if="recentStatus === 'saving'"
          class="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent"
        />
        <span v-else-if="recentStatus === 'pending'" class="text-xs leading-none text-indigo-300">◷</span>
        <span v-else class="text-xs font-bold leading-none text-red-400">!</span>
      </span>

      <!-- Unread badge: laal gol circle (chat kholte hi 0 ho kar chhup jata hai) -->
      <span v-if="!active && unread" class="flex shrink-0 items-center">
        <span
          class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white tabular-nums group-hover:invisible"
          :aria-label="`${unread} unread ${unread === 1 ? 'message' : 'messages'}`"
          data-test="unread-badge"
        >
          {{ unreadLabel }}
        </span>
      </span>
    </component>

    <Teleport to="body">
      <span
        v-if="customTooltip && customTooltipVisible"
        :id="`custom-status-${conversation.id}`"
        ref="customTooltipElement"
        class="pointer-events-none fixed z-[9999] max-w-[calc(100vw-16px)] whitespace-normal rounded bg-[#6b6b73] px-3 py-1.5 text-xs font-medium text-white shadow-md"
        :style="{
          left: `${customTooltipPosition.left}px`,
          top: `${customTooltipPosition.top}px`,
        }"
        role="tooltip"
      >
        {{ customTooltip }}
      </span>
    </Teleport>

    <!-- Close (X): selected row par hamesha, baaqi par hover par -->
    <button
      v-if="!statusOnly"
      type="button"
      class="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-white hover:bg-white/15"
      :class="active ? 'flex' : 'hidden group-hover:flex'"
      title="Close conversation"
      aria-label="Close conversation"
      @click.stop="dms.closeConversation(conversation.id)"
    >
      <svg
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>