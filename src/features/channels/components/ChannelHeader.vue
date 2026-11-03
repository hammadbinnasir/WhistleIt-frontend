<script setup>
import { computed, ref, watch } from 'vue'
import { useChannelsStore } from '../store/channels.store'
import { useChannelActions } from '../composables/useChannelActions'
import { HEADER_AVATAR_MAX } from '../constants'
import ChIcon from './ChIcon.vue'
import MemberAvatarStack from './MemberAvatarStack.vue'
import ChannelContextMenu from './ChannelContextMenu.vue'
import '../styles/tokens.css'

// Drop this into any chat screen:  <ChannelHeader :channel-id="route.params.channelId" />
const props = defineProps({
  channelId: { type: [String, Number], required: true },
  maxAvatars: { type: Number, default: HEADER_AVATAR_MAX },
})
// 'members-click' lets the owner of the members panel open it. Extra header icons go in the #actions slot.
const emit = defineEmits(['members-click'])

const store = useChannelsStore()
const { menuItemsFor, run } = useChannelActions()

const channel = computed(() => store.getById(props.channelId))
const memberState = computed(
  () => store.members[String(props.channelId)] || { items: [], total: 0 },
)
const menu = ref({ open: false, x: 0, y: 0 })
const menuItems = computed(() => menuItemsFor(channel.value))

watch(
  () => props.channelId,
  (id) => {
    if (id !== null && id !== undefined && id !== '')
      store.fetchMembers(id, { limit: props.maxAvatars })
  },
  { immediate: true },
)

function toggleFavorite() {
  run('favorite', channel.value)
}

function openMenu(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  menu.value = { open: true, x: rect.left, y: rect.bottom + 4 }
}

function onMenuSelect(key) {
  menu.value = { ...menu.value, open: false }
  run(key, channel.value)
}
</script>

<template>
  <header v-if="channel" class="ch-header">
    <div class="ch-header__row">
      <button
        class="ch-header__star"
        :class="{ 'ch-header__star--on': channel.isFavorite }"
        type="button"
        :aria-pressed="channel.isFavorite"
        :aria-label="channel.isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        :title="channel.isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click="toggleFavorite"
      >
        <ChIcon name="star" :size="24" :filled="channel.isFavorite" />
      </button>

      <h1 class="ch-header__name" :title="channel.name">
        <ChIcon v-if="channel.isPrivate" name="lock" :size="18" />
        <span>{{ channel.name }}</span>
      </h1>

      <span class="ch-header__divider" aria-hidden="true" />

      <MemberAvatarStack
        :members="memberState.items"
        :total="memberState.total || channel.memberCount"
        :max="maxAvatars"
        @click="emit('members-click')"
      />

      <div class="ch-header__actions">
        <slot name="actions" />
        <button
          class="ch-header__icon"
          type="button"
          aria-label="Channel options"
          aria-haspopup="menu"
          @click="openMenu"
        >
          <ChIcon name="more" :size="20" />
        </button>
      </div>
    </div>

    <p v-if="channel.description" class="ch-header__desc">
      <span class="ch-header__bullet" aria-hidden="true">•</span>{{ channel.description }}
    </p>

    <ChannelContextMenu
      :open="menu.open"
      :x="menu.x"
      :y="menu.y"
      :items="menuItems"
      @select="onMenuSelect"
      @close="menu = { ...menu, open: false }"
    />
  </header>
  <div v-else class="ch-header ch-header--skeleton" aria-hidden="true" />
</template>

<style scoped>
.ch-header {
  padding: 10px 20px 8px;
  background: var(--ch-surface);
  color: var(--ch-text);
  border-bottom: 1px solid var(--ch-border);
}
.ch-header--skeleton {
  height: 64px;
}
.ch-header__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.ch-header__star {
  display: grid;
  place-items: center;
  padding: 2px;
  border: 0;
  background: transparent;
  color: var(--ch-muted);
  cursor: pointer;
}
.ch-header__star:hover {
  color: var(--ch-star);
}
.ch-header__star--on {
  color: var(--ch-star);
}
.ch-header__name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}
.ch-header__name span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-header__divider {
  align-self: stretch;
  width: 1px;
  margin: 4px 6px;
  background: var(--ch-border);
}
.ch-header__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.ch-header__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ch-muted);
  cursor: pointer;
}
.ch-header__icon:hover {
  background: #f1f0f8;
}
.ch-header__desc {
  margin: 2px 0 0 36px;
  font-size: 14px;
  color: var(--ch-muted);
}
.ch-header__bullet {
  margin-right: 8px;
}
</style>
