<script setup>
import ChIcon from './ChIcon.vue'

defineProps({
  channel: { type: Object, required: true },
  active: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'menu'])
</script>

<template>
  <li
    class="ch-item"
    :class="{
      'ch-item--active': active,
      'ch-item--unread': channel.isUnread || channel.unreadCount > 0,
      'ch-item--muted': channel.isMuted,
    }"
  >
    <button
      class="ch-item__link"
      type="button"
      :aria-current="active ? 'true' : undefined"
      :title="channel.name"
      @click="emit('select')"
      @contextmenu.prevent="emit('menu', $event)"
    >
      <ChIcon :name="channel.isPrivate ? 'lock' : 'globe'" :size="18" />
      <span class="ch-item__name">{{ channel.name }}</span>
      <ChIcon v-if="channel.isMuted" name="bell-off" :size="14" />
      <span v-else-if="channel.unreadCount > 0" class="ch-item__badge">
        {{ channel.unreadCount > 99 ? '99+' : channel.unreadCount }}
      </span>
    </button>
    <button
      class="ch-item__more"
      type="button"
      :aria-label="`Options for ${channel.name}`"
      aria-haspopup="menu"
      @click.stop="emit('menu', $event)"
    >
      <ChIcon name="more" :size="16" />
    </button>
  </li>
</template>

<style scoped>
.ch-item {
  position: relative;
  list-style: none;
  border-radius: 6px;
}
.ch-item:hover,
.ch-item:focus-within {
  background: var(--ch-sidebar-hover);
}
.ch-item--active,
.ch-item--active:hover {
  background: var(--ch-sidebar-active);
}
.ch-item__link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ch-sidebar-text);
  font: inherit;
  font-size: 16px;
  text-align: left;
  cursor: pointer;
  outline: none;
}
.ch-item__link:focus-visible {
  box-shadow: 0 0 0 2px var(--ch-sidebar-text-strong);
}
.ch-item--active .ch-item__link,
.ch-item--unread .ch-item__link {
  color: var(--ch-sidebar-text-strong);
}
.ch-item--unread .ch-item__name {
  font-weight: 700;
}
.ch-item--muted .ch-item__link {
  opacity: 0.65;
}
.ch-item__name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-item__badge {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  color: #fff;
  background: var(--ch-accent);
}
.ch-item__more {
  position: absolute;
  top: 50%;
  right: 6px;
  display: none;
  place-items: center;
  width: 26px;
  height: 26px;
  transform: translateY(-50%);
  border: 0;
  border-radius: 4px;
  background: #4a3f78;
  color: var(--ch-sidebar-text-strong);
  cursor: pointer;
}
.ch-item:hover .ch-item__more,
.ch-item__more:focus-visible {
  display: grid;
}
</style>
