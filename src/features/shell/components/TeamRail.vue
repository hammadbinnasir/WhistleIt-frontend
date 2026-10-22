<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const teamsStore = useTeamsStore()
const ui = useUiStore()
const { filteredTeams, activeTeamId, loading } = storeToRefs(teamsStore)

onMounted(() => {
  teamsStore.fetchTeams()
})

function handleTeamClick(teamId) {
  teamsStore.switchTeam(teamId)
}

function getInitials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<template>
  <aside
    class="team-rail"
    role="navigation"
    aria-label="Team switcher"
  >
    <!-- Team avatars -->
    <div class="team-rail__list">
      <!-- Loading skeletons -->
      <template v-if="loading">
        <div v-for="i in 3" :key="i" class="team-rail__skeleton" />
      </template>

      <!-- Team buttons -->
      <template v-else>
        <button
          v-for="team in filteredTeams"
          :key="team.id"
          class="team-rail__avatar"
          :class="{ 'team-rail__avatar--active': activeTeamId === team.id }"
          :style="{ '--team-color': team.color }"
          :title="team.name"
          :aria-label="`Switch to ${team.name}`"
          :aria-current="activeTeamId === team.id ? 'true' : undefined"
          @click="handleTeamClick(team.id)"
        >
          <span class="team-rail__initials">{{ team.initials || getInitials(team.name) }}</span>
          <span class="team-rail__indicator" />
        </button>
      </template>
    </div>

    <!-- Bottom actions -->
    <div class="team-rail__actions">
      <!-- Create / Join team -->
      <button
        class="team-rail__action-btn"
        title="Create or Join Team"
        aria-label="Create or Join Team"
        @click="ui.toggleTeamCreateModal()"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Help -->
      <button
        class="team-rail__action-btn"
        title="Help & Shortcuts"
        aria-label="Help and Keyboard Shortcuts"
        @click="ui.toggleHelpModal()"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7.5 7.5C7.5 6.12 8.62 5 10 5C11.38 5 12.5 6.12 12.5 7.5C12.5 8.88 11.38 10 10 10V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="10" cy="14" r="0.75" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.team-rail {
  width: 72px;
  min-width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #1a1025;
  padding: 12px 0;
  gap: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.team-rail::-webkit-scrollbar {
  display: none;
}

/* ── Team list (grows to fill) ─────────────────────────── */
.team-rail__list {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0 12px;
  width: 100%;
}

/* ── Loading skeleton ──────────────────────────────────── */
.team-rail__skeleton {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(
    110deg,
    rgba(255, 255, 255, 0.04) 30%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 70%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Team avatar button ────────────────────────────────── */
.team-rail__avatar {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--team-color, #7C3AED);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-radius 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  flex-shrink: 0;
}
.team-rail__avatar:hover {
  border-radius: 10px;
  transform: scale(1.08);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
}
.team-rail__avatar--active {
  border-radius: 10px;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.6);
}

/* Active indicator – left pill */
.team-rail__indicator {
  position: absolute;
  left: -14px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 0;
  background: #fff;
  border-radius: 0 4px 4px 0;
  transition: height 0.2s ease;
}
.team-rail__avatar:hover .team-rail__indicator {
  height: 20px;
}
.team-rail__avatar--active .team-rail__indicator {
  height: 36px;
}

.team-rail__initials {
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  pointer-events: none;
  user-select: none;
}

/* ── Bottom actions ────────────────────────────────────── */
.team-rail__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 12px;
  padding-bottom: 72px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  width: 100%;
}

.team-rail__action-btn {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  transition: background 0.2s ease, color 0.2s ease, border-radius 0.2s ease;
}
.team-rail__action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 10px;
}
</style>
