<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'
import { useChannelsStore } from '../store/channels.store'
import { useChannelsUiStore } from '../store/channels.ui.store'
import { useChannelActions } from '../composables/useChannelActions'
import { useActiveChannel } from '../composables/useActiveChannel'
import { SIDEBAR_MAX_VISIBLE } from '../constants'
import ChIcon from './ChIcon.vue'
import ChannelListItem from './ChannelListItem.vue'
import ChannelContextMenu from './ChannelContextMenu.vue'
import ChannelDialogs from './ChannelDialogs.vue'
import '../styles/tokens.css'

const store = useChannelsStore()
const dms = useDmStore()
const appUi = useUiStore()
const ui = useChannelsUiStore()
const { activeId, select, clear } = useActiveChannel()
const { menuItemsFor, run } = useChannelActions()

const expanded = ref(true)
const menu = ref({ open: false, x: 0, y: 0, channelId: null })

// First N channels; the active one is always kept visible even if it's beyond the limit.
const shownChannels = computed(() => {
  const all = store.visibleChannels
  const shown = all.slice(0, SIDEBAR_MAX_VISIBLE)
  const active = all.find((c) => c.id === activeId.value)
  if (active && !shown.includes(active)) shown[shown.length - 1] = active
  return shown
})

const menuItems = computed(() => menuItemsFor(store.getById(menu.value.channelId)))

// Keep the selection valid: pick the default (or first) channel when nothing is selected,
// and recover if the selected channel no longer exists (left, archived, deleted).
function ensureSelection() {
  if (!store.loaded) return

  if (dms.activeId) {
    if (activeId.value !== null) clear()
    return
  }

  if (activeId.value && store.getById(activeId.value)) return
  const fallback = store.visibleChannels.find((c) => c.isDefault) || store.visibleChannels[0]
  if (fallback) select(fallback.id)
  else if (activeId.value) clear()
}

function selectChannel(id) {
  dms.deactivateConversation()
  select(id)
  appUi.closePanel()
}

onMounted(() => store.fetchChannels())
watch(() => [store.loaded, store.channels.length, dms.activeId, activeId.value], ensureSelection, {
  immediate: true,
})

function openMenu(event, channel) {
  let x = event.clientX
  let y = event.clientY
  if (event.type !== 'contextmenu') {
    const rect = event.currentTarget.getBoundingClientRect()
    x = rect.left
    y = rect.bottom + 4
  }
  menu.value = { open: true, x, y, channelId: channel.id }
}

function closeMenu() {
  menu.value = { ...menu.value, open: false }
}

function onMenuSelect(key) {
  const channel = store.getById(menu.value.channelId)
  closeMenu()
  run(key, channel)
}
</script>

<template>
  <nav class="ch-sidebar" aria-label="Channels">
    <div class="ch-sidebar__head">
      <button
        class="ch-sidebar__toggle"
        type="button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <ChIcon :name="expanded ? 'chevron-up' : 'chevron-down'" :size="16" />
        <span>Channels</span>
      </button>
      <button
        class="ch-sidebar__add"
        type="button"
        aria-label="Create channel"
        title="Create channel"
        @click="ui.openCreate()"
      >
        <ChIcon name="plus" :size="24" />
      </button>
    </div>

    <div v-show="expanded">
      <ul v-if="store.loading && !store.loaded" class="ch-sidebar__list" aria-hidden="true">
        <li v-for="n in 5" :key="n" class="ch-sidebar__skeleton" />
      </ul>

      <div v-else-if="store.error" class="ch-sidebar__state" role="alert">
        <span>{{ store.error }}</span>
        <button
          type="button"
          class="ch-sidebar__link"
          @click="store.fetchChannels({ force: true })"
        >
          Retry
        </button>
      </div>

      <template v-else>
        <ul v-if="shownChannels.length" class="ch-sidebar__list">
          <ChannelListItem
            v-for="channel in shownChannels"
            :key="channel.id"
            :channel="channel"
            :active="channel.id === activeId"
            @select="selectChannel(channel.id)"
            @menu="openMenu($event, channel)"
          />
        </ul>
        <p v-else class="ch-sidebar__state">You haven't joined any channels yet.</p>

        <button type="button" class="ch-sidebar__more" @click="ui.openBrowse()">
          More channels
        </button>
      </template>
    </div>

    <ChannelContextMenu
      :open="menu.open"
      :x="menu.x"
      :y="menu.y"
      :items="menuItems"
      @select="onMenuSelect"
      @close="closeMenu"
    />
    <ChannelDialogs />
  </nav>
</template>

<style scoped>
.ch-sidebar {
  padding: 8px 8px 12px;
  color: var(--ch-sidebar-text);
}
.ch-sidebar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 8px 8px;
}
.ch-sidebar__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  color: var(--ch-sidebar-text-strong);
  cursor: pointer;
}
.ch-sidebar__add {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ch-sidebar-text-strong);
  cursor: pointer;
}
.ch-sidebar__add:hover {
  background: var(--ch-sidebar-hover);
}
.ch-sidebar__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ch-sidebar__skeleton {
  height: 36px;
  margin: 4px 0;
  border-radius: 6px;
  background: var(--ch-sidebar-hover);
  animation: ch-pulse 1.2s ease-in-out infinite;
}
@keyframes ch-pulse {
  50% {
    opacity: 0.4;
  }
}
.ch-sidebar__state {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 12px;
  font-size: 14px;
}
.ch-sidebar__link {
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-decoration: underline;
  color: var(--ch-sidebar-text-strong);
  cursor: pointer;
}
.ch-sidebar__more {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 8px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 15px;
  text-align: left;
  color: var(--ch-sidebar-text);
  cursor: pointer;
}
.ch-sidebar__more:hover {
  background: var(--ch-sidebar-hover);
  color: var(--ch-sidebar-text-strong);
}
</style>
