<script setup>
/**
 * MemberList — renders the list of team members with online/offline status.
 * Used inside WorkspaceSidebar.
 */
defineProps({
  members: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

function getInitials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(name) {
  // Deterministic color from name hash
  const colors = [
    '#7C3AED', '#2DD4BF', '#F97316', '#EC4899',
    '#3B82F6', '#EAB308', '#10B981', '#F43F5E',
    '#8B5CF6', '#06B6D4',
  ]
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
</script>

<template>
  <div class="member-list" role="list" aria-label="Team members">
    <!-- Loading skeletons -->
    <template v-if="loading">
      <div v-for="i in 6" :key="i" class="member-skeleton">
        <div class="member-skeleton__avatar" />
        <div class="member-skeleton__text">
          <div class="member-skeleton__name" />
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else-if="members.length === 0" class="member-empty">
      <p>No members yet</p>
    </div>

    <!-- Members -->
    <template v-else>
      <button
        v-for="member in members"
        :key="member.id"
        class="member-item"
        role="listitem"
        :title="member.name"
      >
        <!-- Avatar -->
        <div
          class="member-item__avatar"
          :style="{ background: getAvatarColor(member.name) }"
        >
          <span>{{ getInitials(member.name) }}</span>
          <span
            class="member-item__status"
            :class="member.status === 'online' ? 'member-item__status--online' : 'member-item__status--offline'"
          />
        </div>

        <!-- Name + role -->
        <div class="member-item__info">
          <span class="member-item__name">{{ member.name }}</span>
          <span v-if="member.role === 'admin'" class="member-item__role">Admin</span>
        </div>
      </button>
    </template>
  </div>
</template>

<style scoped>
.member-list {
  padding: 0 8px 8px;
}

/* ── Member item ───────────────────────────────────────── */
.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 8px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}
.member-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* Avatar */
.member-item__avatar {
  position: relative;
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

/* Status dot */
.member-item__status {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #1e1b2e;
}
.member-item__status--online {
  background: #22c55e;
}
.member-item__status--offline {
  background: #64748b;
}

/* Info */
.member-item__info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.member-item__name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.member-item:hover .member-item__name {
  color: #f1f5f9;
}

.member-item__role {
  font-size: 9px;
  color: rgba(124, 58, 237, 0.8);
  background: rgba(124, 58, 237, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

/* ── Empty state ───────────────────────────────────────── */
.member-empty {
  padding: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}

/* ── Loading skeleton ──────────────────────────────────── */
.member-skeleton {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
}
.member-skeleton__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  animation: member-shimmer 1.5s ease-in-out infinite;
}
.member-skeleton__text {
  flex: 1;
}
.member-skeleton__name {
  width: 70%;
  height: 12px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  animation: member-shimmer 1.5s ease-in-out infinite 0.1s;
}
@keyframes member-shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
