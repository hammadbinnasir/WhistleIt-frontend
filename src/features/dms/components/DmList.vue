<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const starting = ref('') // jis user ke saath DM ban rahi hai

const ORDER = { online: 0, away: 1, offline: 2 }

// Pehle ki tarah baaki users bhi (jin se abhi DM nahi): online upar, phir naam se
const suggestions = computed(() =>
  [...dms.suggestedUsers]
    .sort(
      (a, b) =>
        (ORDER[presence.stateOf(a.id)] ?? 2) - (ORDER[presence.stateOf(b.id)] ?? 2) ||
        a.name.localeCompare(b.name),
    )
    .map((user) => ({
      id: `user:${user.id}`,
      userId: user.id,
      type: 'dm',
      members: [dms.meId, user.id],
      name: '',
      unreadCount: 0,
      messages: [],
    })),
)

function openConversation(conversationId) {
  if (!dms.openConversation(conversationId)) return
  ui.selectChannel(null)
  ui.closePanel()
}

// Suggested user par click: DM banao (ya maujooda kholo). Dohra click ignore.
async function startWith(item) {
  if (!item?.userId || starting.value) return
  starting.value = item.userId
  try {
    await dms.startDm(item.userId)
    ui.selectChannel(null)
    ui.closePanel()
  } catch (cause) {
    ui.toast?.('Could not start the conversation', cause?.message || 'Please try again.', 'error')
  } finally {
    starting.value = ''
  }
}

// Browser tab title mein bhi unread ginti: "(3) WhistleIt"
const baseTitle = typeof document !== 'undefined' ? document.title.replace(/^\(\d+\+?\)\s*/, '') : ''
watch(
  () => dms.totalUnread,
  (count) => {
    if (typeof document === 'undefined') return
    document.title = count ? `(${count > 99 ? '99+' : count}) ${baseTitle}` : baseTitle
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.title = baseTitle
})

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
  void dms.loadCompanyMembers() // baaki users (company + team members)
  dms.startPolling() // dusre user ke naye / edit / delete messages khud aate rahein
})

onBeforeUnmount(() => {
  dms.stopPolling()
  // App/sidebar band (jaise logout): server ko "offline", phir status timers band
  presence.goOffline()
  presence.stopPolling()
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

      <!-- Baaki users (click par DM shuru) -->
      <DmListItem
        v-for="item in suggestions"
        :key="item.id"
        :conversation="item"
        :active="false"
        :class="starting === item.userId ? 'opacity-60' : ''"
        data-test="dm-suggestion"
        @select="startWith(item)"
        @close="dms.closeConversation"
      />
    </template>
  </section>
</template>