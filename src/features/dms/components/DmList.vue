<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { useUiStore } from '@/stores/ui'
import DmListItem from './DmListItem.vue'
import NewDmPanel from './NewDmPanel.vue'

const dms = useDmStore()
const presence = usePresenceStore()
const ui = useUiStore()
const open = ref(true)
const panelOpen = ref(false)

function openConversation(conversationId) {
  if (!dms.openConversation(conversationId)) return
  ui.selectChannel(null)
  ui.closePanel()
}

watch(
  () =>
    dms.sorted
      .map((conversation) =>
        conversation.type === 'dm' ? dms.partnerId(conversation) : null,
      )
      .filter(Boolean),
  (userIds) => {
    void dms.loadCustomStatuses(userIds)
  },
  { immediate: true },
)

onMounted(() => {
  void dms.init()
  void presence.init()
  dms.startPolling() // dusre user ke naye / edit / delete messages khud aate rahein
})

onBeforeUnmount(() => {
  dms.stopPolling()
})
</script>

<template>
  <section>
    <header class="flex items-center justify-between px-4 py-2 text-white">
      <button class="flex items-center gap-2 font-semibold" @click="open = !open">
        <svg
          class="h-4 w-4 transition-transform"
          :class="open ? '' : 'rotate-180'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 15 12 9 18 15" />
        </svg>
        Direct Messages
      </button>

      <button
        class="text-3xl leading-none hover:text-indigo-300"
        title="New message"
        @click="panelOpen = true"
      >
        +
      </button>
    </header>

    <NewDmPanel v-if="panelOpen" @close="panelOpen = false" />

    <template v-if="open">
      <p v-if="dms.loading && !dms.sorted.length" class="px-4 py-1.5 text-sm text-slate-400">
        Loading…
      </p>

      <p v-else-if="dms.error" class="px-4 py-1.5 text-sm text-slate-400">
        <template v-if="dms.offline">Offline: showing saved messages.</template>
        <template v-else>{{ dms.error }}</template>
        <button class="underline" @click="dms.init()">Retry</button>
      </p>

      <p v-if="dms.customStatusError" class="px-4 py-1.5 text-xs text-slate-400">
        Custom statuses could not be loaded.
        <button
          class="underline"
          @click="
            dms.loadCustomStatuses(
              dms.sorted.map((c) => (c.type === 'dm' ? dms.partnerId(c) : null)).filter(Boolean),
            )
          "
        >
          Retry
        </button>
      </p>

      <DmListItem
        v-for="c in dms.sorted"
        :key="c.id"
        :conversation="c"
        :active="c.id === dms.activeId"
        @select="openConversation"
        @close="dms.closeConversation"
      />
    </template>
  </section>
</template>