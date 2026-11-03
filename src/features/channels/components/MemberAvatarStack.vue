<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  members: { type: Array, default: () => [] }, // [{ id, name, avatarUrl, status, email }]
  total: { type: Number, default: 0 },
  max: { type: Number, default: 10 },
})
const emit = defineEmits(['click'])

const PALETTE = ['#7b2fd0', '#5a45d8', '#3f6bd9', '#8e3fb8', '#6a3fd0', '#2f7fb8']
const hoveredMember = ref(null)

const shown = computed(() => props.members.slice(0, props.max))
const extra = computed(() =>
  Math.max(0, (props.total || props.members.length) - shown.value.length),
)

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
  hoveredMember.value = member || null
}
</script>

<template>
  <div
    class="ch-stack"
    :aria-label="`View ${total || members.length} members`"
    @click="emit('click')"
  >
    <span
      v-for="member in shown"
      :key="member.id"
      class="ch-stack__avatar"
      :style="member.avatarUrl ? null : { background: colorFor(member) }"
      :title="member.name"
      @mouseenter="setHovered(member)"
      @mouseleave="setHovered(null)"
    >
      <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.name" />
      <template v-else>{{ initials(member.name) }}</template>
      <span class="ch-stack__dot" :class="`ch-stack__dot--${member.status}`" />
    </span>
    <span v-if="extra > 0" class="ch-stack__avatar ch-stack__avatar--extra">+{{ extra }}</span>

    <div v-if="hoveredMember" class="ch-stack__preview" aria-live="polite">
      <div class="ch-stack__preview-header">
        <div class="ch-stack__preview-avatar">
          {{ initials(hoveredMember.name) }}
        </div>
        <span
          class="ch-stack__preview-status"
          :class="`ch-stack__preview-status--${hoveredMember.status || 'offline'}`"
        >
          {{ hoveredMember.status === 'online' ? 'Online' : 'Offline' }}
        </span>
      </div>

      <div class="ch-stack__preview-body">
        <h4>{{ hoveredMember.name }}</h4>
        <p>{{ hoveredMember.email || 'team-member' }}</p>
      </div>

      <div class="ch-stack__preview-actions">
        <span class="ch-stack__preview-action ch-stack__preview-action--primary">Message</span>
        <span class="ch-stack__preview-action ch-stack__preview-action--secondary">Profile</span>
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
.ch-stack__preview {
  position: absolute;
  left: 50%;
  top: calc(100% + 12px);
  transform: translateX(-50%);
  width: 260px;
  background: rgba(255, 255, 255, 0.98);
  color: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 16px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
  padding: 14px 14px 12px;
  z-index: 30;
  pointer-events: none;
}
.ch-stack__preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ch-stack__preview-avatar {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  font-size: 22px;
  font-weight: 700;
  margin: 0 auto;
}
.ch-stack__preview-status {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
}
.ch-stack__preview-status--online {
  color: #15803d;
  background: rgba(34, 197, 94, 0.12);
}
.ch-stack__preview-status--offline {
  color: #475569;
  background: rgba(148, 163, 184, 0.14);
}
.ch-stack__preview-body {
  text-align: center;
  margin-bottom: 12px;
}
.ch-stack__preview-body h4 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
}
.ch-stack__preview-body p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #334155;
}
.ch-stack__preview-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.ch-stack__preview-action {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: transparent;
  padding: 9px 10px;
  font-weight: 600;
}
.ch-stack__preview-action--primary {
  background: #fff;
  color: #0f172a;
}
.ch-stack__preview-action--secondary {
  background: #f8fafc;
  color: #0f172a;
}
</style>
