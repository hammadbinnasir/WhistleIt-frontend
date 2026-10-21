<script setup>
import { computed } from 'vue'

const props = defineProps({
  members: { type: Array, default: () => [] }, // [{ id, name, avatarUrl, status }]
  total: { type: Number, default: 0 },
  max: { type: Number, default: 10 },
})
const emit = defineEmits(['click'])

const PALETTE = ['#7b2fd0', '#5a45d8', '#3f6bd9', '#8e3fb8', '#6a3fd0', '#2f7fb8']

const shown = computed(() => props.members.slice(0, props.max))
const extra = computed(() => Math.max(0, (props.total || props.members.length) - shown.value.length))

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

function colorFor(member) {
  let hash = 0
  for (const char of `${member.id}${member.name}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
</script>

<template>
  <button
    class="ch-stack"
    type="button"
    :aria-label="`View ${total || members.length} members`"
    @click="emit('click')"
  >
    <span
      v-for="member in shown"
      :key="member.id"
      class="ch-stack__avatar"
      :style="member.avatarUrl ? null : { background: colorFor(member) }"
      :title="member.name"
    >
      <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.name" />
      <template v-else>{{ initials(member.name) }}</template>
      <span class="ch-stack__dot" :class="`ch-stack__dot--${member.status}`" />
    </span>
    <span v-if="extra > 0" class="ch-stack__avatar ch-stack__avatar--extra">+{{ extra }}</span>
  </button>
</template>

<style scoped>
.ch-stack {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.ch-stack__avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-left: -8px;
  border: 2px solid var(--ch-surface);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  box-sizing: border-box;
}
.ch-stack__avatar:first-child {
  margin-left: 0;
}
.ch-stack__avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.ch-stack__avatar--extra {
  width: auto;
  min-width: 36px;
  padding: 0 8px;
  border-radius: 18px;
  color: var(--ch-text);
  background: #ececf2;
}
.ch-stack__dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 11px;
  height: 11px;
  border: 2px solid var(--ch-surface);
  border-radius: 50%;
  box-sizing: border-box;
  background: #9a98a8;
}
.ch-stack__dot--online {
  background: #2ecc71;
}
.ch-stack__dot--away {
  background: #f5a623;
}
</style>
