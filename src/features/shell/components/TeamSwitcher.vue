<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const teamsStore = useTeamsStore()
const ui = useUiStore()

const { teams, activeTeamId } = storeToRefs(teamsStore)
const searchFilter = ref('')

const filteredTeams = computed(() => {
  if (!searchFilter.value.trim()) return teams.value
  const query = searchFilter.value.toLowerCase().trim()
  return teams.value.filter((t) => t.name.toLowerCase().includes(query))
})

function handleSelect(teamId) {
  teamsStore.switchTeam(teamId)
  emit('close')
}

function openCreate() {
  emit('close')
  ui.toggleTeamCreateModal()
}

function openJoin() {
  emit('close')
  ui.toggleTeamJoinModal()
}

function openManageMembers() {
  emit('close')
  ui.toggleMemberManageModal()
}
</script>

<template>
  <div v-if="isOpen" class="switcher-overlay" @click.self="$emit('close')">
    <div class="switcher-popover" role="menu">
      <div class="search-container">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchFilter"
          type="text"
          class="search-input"
          placeholder="Search Workspace"
          autofocus
        />
      </div>

      <div class="workspace-list">
        <div v-if="filteredTeams.length === 0" class="empty-hint">
          No workspaces found
        </div>
        <button
          v-for="team in filteredTeams"
          :key="team.id"
          type="button"
          class="workspace-item"
          :class="{ 'workspace-item--active': activeTeamId === team.id }"
          @click="handleSelect(team.id)"
        >
          <div
            class="team-badge"
            :style="{ background: team.color || '#7C3AED' }"
          >
            {{ team.initials || team.name.slice(0, 2).toUpperCase() }}
          </div>
          <span class="team-name">{{ team.name }}</span>
          <svg
            v-if="activeTeamId === team.id"
            class="check-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      <div class="action-footer">
        <button type="button" class="action-btn" @click="openCreate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Workspace
        </button>
        <button type="button" class="action-btn" @click="openJoin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search & Join Team
        </button>
        <button type="button" class="action-btn" @click="openManageMembers">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Manage Members (Add / Remove)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.switcher-popover {
  position: absolute;
  top: 56px;
  left: 76px;
  width: 240px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  animation: popover-in 0.15s ease-out;
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-container {
  display: flex;
  align-items: center;
  position: relative;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
}

.search-icon {
  position: absolute;
  left: 18px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 6px 8px 6px 28px;
  font-size: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  outline: none;
  color: #1e293b;
  background: #f8fafc;
}
.search-input:focus {
  border-color: #7c3aed;
  background: #fff;
}

.workspace-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty-hint {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

.workspace-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
  width: 100%;
}
.workspace-item:hover {
  background: #f1f5f9;
}
.workspace-item--active {
  background: #f3e8ff;
}

.team-badge {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}

.team-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.workspace-item--active .team-name {
  font-weight: 600;
  color: #7c3aed;
}

.check-icon {
  color: #7c3aed;
  flex-shrink: 0;
}

.action-footer {
  border-top: 1px solid #f1f5f9;
  padding: 4px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}
.action-btn:hover {
  background: #f1f5f9;
  color: #7c3aed;
}
</style>
