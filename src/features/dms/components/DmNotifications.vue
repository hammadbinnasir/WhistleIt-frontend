<script setup>
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'

// Naya message aane par card: "Muniba Naseer / @Muniba Naseer: j"
// Click: wo chat khulti hai. ✕: band. 6 sec baad khud band.
const dms = useDmStore()
const ui = useUiStore()

function open(item) {
  dms.dismissNotification(item.id)
  if (!dms.openConversation(item.conversationId)) return
  ui.selectChannel?.(null)
  ui.closePanel?.()
}
</script>

<template>
  <Teleport to="body">
    <!-- Sirf jab naya message aaya ho (hasNewMessage = true) -->
    <div
      v-if="dms.hasNewMessage"
      class="pointer-events-none fixed right-4 top-4 z-[2500] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      <div
        v-for="item in dms.notifications"
        :key="item.id"
        class="pointer-events-auto flex items-center gap-4 rounded-lg border-l-4 border-indigo-500 bg-indigo-50 py-3 pl-4 pr-3 shadow-md"
        role="status"
        data-test="dm-notification"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-4 text-left"
          :aria-label="`Open chat with ${item.title}`"
          @click="open(item)"
        >
          <svg class="h-9 w-9 shrink-0 text-slate-700" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3.5V14H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
            <path d="M18 8h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1v3.5L16 18h-6a1 1 0 0 1-1-1v-1h7a2 2 0 0 0 2-2V8Z" />
          </svg>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-slate-900">{{ item.title }}</span>
            <span class="block truncate text-slate-800">
              <span class="text-blue-600">@{{ item.sender }}:</span> {{ item.text }}
            </span>
          </span>
        </button>
        <button
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-indigo-100 hover:text-slate-800"
          aria-label="Dismiss notification"
          @click="dms.dismissNotification(item.id)"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  </Teleport>
</template>