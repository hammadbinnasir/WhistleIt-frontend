<script setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const teamsStore = useTeamsStore()
const ui = useUiStore()

const { teams, searchResults, searchLoading } = storeToRefs(teamsStore)

const searchInput = ref('')
const joiningTeamId = ref(null)
const statusMessage = ref('')
const errorMessage = ref('')

let searchDebounce = null

watch(searchInput, (query) => {
  clearTimeout(searchDebounce)
  if (!query.trim()) {
    teamsStore.clearSearch()
    return
  }
  searchDebounce = setTimeout(() => {
    teamsStore.searchAvailableTeams(query.trim())
  }, 250)
})

function isAlreadyMember(teamId) {
  return teams.value.some((t) => t.id === teamId)
}

async function handleJoin(team) {
  joiningTeamId.value = team.id
  errorMessage.value = ''
  statusMessage.value = ''
  try {
    await teamsStore.joinTeam(team.id)
    statusMessage.value = `Joined ${team.name} successfully!`
    setTimeout(() => {
      ui.toggleTeamJoinModal()
      statusMessage.value = ''
    }, 800)
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to join team.'
  } finally {
    joiningTeamId.value = null
  }
}

function handleClose() {
  ui.toggleTeamJoinModal()
  teamsStore.clearSearch()
  searchInput.value = ''
  errorMessage.value = ''
  statusMessage.value = ''
}
</script>

<template>
  <div
    v-if="ui.teamJoinModalOpen"
    class="modal-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="join-team-title"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="join-team-title" class="modal-title">Join a Workspace</h3>
        <button type="button" class="close-btn" aria-label="Close dialog" @click="handleClose">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-desc">
          Search for existing workspaces in your organization to join conversations.
        </p>

        <div v-if="statusMessage" class="success-banner" role="status">
          {{ statusMessage }}
        </div>
        <div v-if="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <div class="search-box">
          <svg
            class="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchInput"
            type="text"
            class="search-input"
            placeholder="Search teams by name..."
            autofocus
          />
        </div>

        <div class="results-container">
          <div v-if="searchLoading" class="loading-state">
            <div class="spinner" />
            <span>Searching workspaces...</span>
          </div>

          <div v-else-if="searchInput.trim() && searchResults.length === 0" class="empty-state">
            No workspaces matching "{{ searchInput }}".
          </div>

          <div v-else-if="!searchInput.trim()" class="hint-state">
            Type a team name to search available workspaces.
          </div>

          <ul v-else class="team-results-list">
            <li v-for="team in searchResults" :key="team.id" class="team-result-row">
              <div class="team-info">
                <div class="team-avatar" :style="{ background: team.color || '#7C3AED' }">
                  {{ team.initials || team.name.slice(0, 2).toUpperCase() }}
                </div>
                <div class="team-meta">
                  <span class="team-name">{{ team.name }}</span>
                  <span class="team-count">{{ team.memberCount || 1 }} members</span>
                </div>
              </div>

              <div class="team-action">
                <span v-if="isAlreadyMember(team.id)" class="joined-badge"> Joined </span>
                <button
                  v-else
                  type="button"
                  class="join-btn"
                  :disabled="joiningTeamId === team.id"
                  @click="handleJoin(team)"
                >
                  <span v-if="joiningTeamId === team.id">Joining...</span>
                  <span v-else>Join</span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 8, 18, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 480px;
  background: #1e1b2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  color: #f1f5f9;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.success-banner {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #86efac;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.search-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 12px 10px 38px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;
}
.search-input:focus {
  border-color: #7c3aed;
  background: rgba(255, 255, 255, 0.08);
}

.results-container {
  min-height: 180px;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.15);
}

.loading-state,
.empty-state,
.hint-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.team-results-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.team-result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.team-result-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.team-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.team-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
}

.team-meta {
  display: flex;
  flex-direction: column;
}

.team-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.team-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.join-btn {
  background: #7c3aed;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}
.join-btn:hover:not(:disabled) {
  background: #6d28d9;
}
.join-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.joined-badge {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  padding: 4px 8px;
}
</style>
