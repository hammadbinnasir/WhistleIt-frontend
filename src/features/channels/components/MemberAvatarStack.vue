<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  members: { type: Array, default: () => [] }, // [{ id, name, avatarUrl, status, email }]
  total: { type: Number, default: 0 },
  max: { type: Number, default: 10 },
})
const emit = defineEmits(['click', 'profile'])

const PALETTE = ['#7b2fd0', '#5a45d8', '#3f6bd9', '#8e3fb8', '#6a3fd0', '#2f7fb8']
const hoveredMember = ref(null)
let hoverCloseTimer = null

const shown = computed(() => props.members.slice(0, props.max))
const extra = computed(() =>
  Math.max(0, (props.total || props.members.length) - shown.value.length),
)
const statusLabels = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
  dnd: 'Do not disturb',
  unknown: 'Status unavailable',
}

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

function setHovered(member) {
  clearTimeout(hoverCloseTimer)
  hoveredMember.value = member || null
}

function scheduleHoverClose() {
  clearTimeout(hoverCloseTimer)
  hoverCloseTimer = setTimeout(() => {
    hoveredMember.value = null
    hoverCloseTimer = null
  }, 150)
}

function openProfile(member) {
  clearTimeout(hoverCloseTimer)
  emit('profile', member)
  hoveredMember.value = null
}
</script>

<template>
  <div
    class="ch-stack"
    :aria-label="`View ${total || members.length} members`"
    @click="emit('click')"
    @mouseenter="setHovered(hoveredMember)"
    @mouseleave="scheduleHoverClose"
  >
    <span
      v-for="member in shown"
      :key="member.id"
      class="ch-stack__avatar"
      :style="member.avatarUrl ? null : { background: colorFor(member) }"
      :title="member.name"
      @mouseenter="setHovered(member)"
    >
      <span v-if="member.avatarUrl" class="ch-stack__avatar-image">
        <img :src="member.avatarUrl" :alt="member.name" />
      </span>
      <template v-else>{{ initials(member.name) }}</template>
      <span class="ch-stack__dot" :class="`ch-stack__dot--${member.status}`" />
    </span>
    <span v-if="extra > 0" class="ch-stack__avatar ch-stack__avatar--extra">+{{ extra }}</span>

    <div
      v-if="hoveredMember"
      class="ch-stack__preview"
      aria-live="polite"
      @mouseenter="setHovered(hoveredMember)"
    >
      <div class="ch-stack__preview-header">
        <img
          v-if="hoveredMember.avatarUrl"
          class="ch-stack__preview-avatar"
          :src="hoveredMember.avatarUrl"
          :alt="hoveredMember.name"
        />
        <div v-else class="ch-stack__preview-avatar">
          {{ initials(hoveredMember.name) }}
        </div>
        <span
          class="ch-stack__preview-status"
          :class="`ch-stack__preview-status--${hoveredMember.status || 'unknown'}`"
        >
          {{ statusLabels[hoveredMember.status] || statusLabels.unknown }}
        </span>
      </div>

      <div class="ch-stack__preview-body">
        <h4>{{ hoveredMember.name }}</h4>
        <p>{{ hoveredMember.email }}</p>
      </div>

      <div class="ch-stack__preview-actions">
        <span class="ch-stack__preview-action ch-stack__preview-action--primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
          </svg>
          Message
        </span>
        <button
          type="button"
          class="ch-stack__preview-action ch-stack__preview-action--secondary"
          @click.stop="openProfile(hoveredMember)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21a7 7 0 0 1 14 0" />
          </svg>
          Profile
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ch-stack {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  overflow: visible;
}
.ch-stack__avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  min-width: 36px;
  height: 36px;
  flex: 0 0 36px;
  margin-left: -8px;
  border: 2px solid var(--ch-surface);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  box-sizing: border-box;
}
.ch-stack__avatar:first-child {
  margin-left: 0;
}
.ch-stack__avatar-image {
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  border-radius: 50%;
}
.ch-stack__avatar-image img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 35%;
  transform: scale(1.15);
}
.ch-stack__avatar--extra {
  width: auto;
  min-width: 36px;
  flex: 0 0 auto;
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
.ch-stack__dot--dnd {
  background: #ef4444;
}
.ch-stack__preview {
  position: absolute;
  left: 50%;
  top: calc(100% + 12px);
  transform: translateX(-50%);
  width: 280px;
  background: #fff;
  color: #0f172a;
  border: 1px solid #d5d5d5;
  border-radius: 10px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
  padding: 10px 0 14px;
  z-index: 30;
  pointer-events: auto;
}
.ch-stack__preview-header {
  margin: 30px 0 16px;
}
.ch-stack__preview-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 168px;
  height: 168px;
  max-width: calc(100% - 32px);
  margin: 0 auto;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  font-size: 32px;
  font-weight: 700;
  object-fit: cover;
}
.ch-stack__preview-status {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 13px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid #aaa;
  background: #fff;
  color: #777;
}
.ch-stack__preview-status--online {
  color: #15803d;
  background: rgba(34, 197, 94, 0.12);
}
.ch-stack__preview-status--offline {
  color: #475569;
  background: rgba(148, 163, 184, 0.14);
}
.ch-stack__preview-status--away {
  color: #a16207;
  background: rgba(245, 158, 11, 0.14);
}
.ch-stack__preview-status--dnd {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.12);
}
.ch-stack__preview-status--unknown {
  color: #475569;
  background: rgba(148, 163, 184, 0.14);
}
.ch-stack__preview-body {
  text-align: center;
  margin: 0 12px 16px;
}
.ch-stack__preview-body h4 {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 600;
}
.ch-stack__preview-body p {
  margin: 6px 0 0;
  color: #5962ff;
  font-size: 16px;
  overflow-wrap: anywhere;
}
.ch-stack__preview-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  border-top: 1px solid #e5e5e5;
  padding: 14px 18px 0;
}
.ch-stack__preview-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  border-radius: 5px;
  border: 1px solid #5962ff;
  background: #fff;
  color: #5962ff;
  padding: 7px 8px;
  font-weight: 600;
  cursor: pointer;
}
.ch-stack__preview-action svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  stroke-width: 1.8;
}
.ch-stack__preview-action--primary {
  color: #5962ff;
}
.ch-stack__preview-action--secondary {
  background: #fff;
  color: #5962ff;
}
.ch-stack__preview-action--secondary:hover {
  background: #f7f7ff;
}
.ch-stack__preview-action--secondary:focus-visible {
  outline: 2px solid #5962ff;
  outline-offset: 2px;
}
</style>
