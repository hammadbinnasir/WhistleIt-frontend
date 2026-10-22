<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'
import { useUiStore } from '@/stores/ui'
import { searchUsers } from '@/features/shell/api/membersApi'

const teamsStore = useTeamsStore()
const membersStore = useMembersStore()
const ui = useUiStore()

const { activeTeam, activeTeamId } = storeToRefs(teamsStore)
const { members, loading: membersLoading } = storeToRefs(membersStore)

const searchMemberQuery = ref('')
const newMemberInput = ref('')
const isAdding = ref(false)
const removingMemberId = ref(null)
const actionError = ref('')
const successNotice = ref('')

const searchSuggestions = ref([])
const isSearchingSuggestions = ref(false)

// Fetch members whenever modal opens
watch(
  () => ui.memberManageModalOpen,
  (isOpen) => {
    if (isOpen && activeTeamId.value) {
      membersStore.fetchMembers(activeTeamId.value)
    }
  },
  { immediate: true },
)

const filteredMembers = computed(() => {
  if (!searchMemberQuery.value.trim()) return members.value
  const q = searchMemberQuery.value.toLowerCase().trim()
  return members.value.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)),
  )
})

let debounceTimer = null
async function onAddInputChange() {
  clearTimeout(debounceTimer)
  const q = newMemberInput.value.trim()
  if (!q) {
    searchSuggestions.value = []
    return
  }

  debounceTimer = setTimeout(async () => {
    isSearchingSuggestions.value = true
    try {
      const results = await searchUsers(q)
      // filter out existing members
      searchSuggestions.value = results.filter(
        (u) => !members.value.some((m) => m.id === u.id),
      )
    } catch {
      searchSuggestions.value = []
    } finally {
      isSearchingSuggestions.value = false
    }
  }, 200)
}

function selectSuggestion(user) {
  newMemberInput.value = user.name
  searchSuggestions.value = []
  handleAddUser(user.id)
}

async function handleAddUser(userId = null) {
  if (!newMemberInput.value.trim() && !userId) return
  if (!activeTeamId.value) return

  isAdding.value = true
  actionError.value = ''
  successNotice.value = ''

  try {
    const added = await membersStore.addMember(activeTeamId.value, userId || newMemberInput.value.trim())
    successNotice.value = `Added ${added.name} to ${activeTeam.value?.name || 'workspace'}.`
    newMemberInput.value = ''
    searchSuggestions.value = []
  } catch (err) {
    actionError.value = err?.message || 'Could not add member.'
  } finally {
    isAdding.value = false
  }
}

async function handleRemove(member) {
  if (!confirm(`Are you sure you want to remove ${member.name} from this workspace?`)) {
    return
  }

  removingMemberId.value = member.id
  actionError.value = ''
  successNotice.value = ''

  try {
    await membersStore.removeMember(activeTeamId.value, member.id)
    successNotice.value = `Removed ${member.name}.`
  } catch (err) {
    actionError.value = err?.message || 'Failed to remove member.'
  } finally {
    removingMemberId.value = null
  }
}

function handleClose() {
  ui.toggleMemberManageModal()
  searchMemberQuery.value = ''
  newMemberInput.value = ''
  actionError.value = ''
  successNotice.value = ''
  searchSuggestions.value = []
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
  <div
    v-if="ui.memberManageModalOpen"
    class="modal-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="member-manage-title"
  >
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3 id="member-manage-title" class="modal-title">
            Manage Workspace Members
          </h3>
          <span class="modal-subtitle">
            {{ activeTeam ? activeTeam.name : 'Workspace' }} ({{ members.length }} members)
          </span>
        </div>
        <button
          type="button"
          class="close-btn"
          aria-label="Close dialog"
          @click="handleClose"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div v-if="successNotice" class="success-banner" role="status">
          {{ successNotice }}
        </div>
        <div v-if="actionError" class="error-banner" role="alert">
          {{ actionError }}
        </div>

        <!-- Add Member section -->
        <div class="add-section">
          <label class="section-label">Add New Member</label>
          <div class="add-input-wrapper">
            <input
              v-model="newMemberInput"
              type="text"
              class="add-input"
              placeholder="Enter name or email..."
              @input="onAddInputChange"
              @keydown.enter.prevent="handleAddUser()"
            />
            <button
              type="button"
              class="add-btn"
              :disabled="!newMemberInput.trim() || isAdding"
              @click="handleAddUser()"
            >
              <span v-if="isAdding">Adding...</span>
              <span v-else>Add Member</span>
            </button>
          </div>

          <!-- Autocomplete Suggestions -->
          <div v-if="searchSuggestions.length > 0" class="suggestions-dropdown">
            <button
              v-for="user in searchSuggestions"
              :key="user.id"
              type="button"
              class="suggestion-row"
              @click="selectSuggestion(user)"
            >
              <div class="suggestion-avatar">
                {{ getInitials(user.name) }}
              </div>
              <div class="suggestion-meta">
                <span class="suggestion-name">{{ user.name }}</span>
                <span class="suggestion-email">{{ user.email }}</span>
              </div>
              <span class="invite-label">+ Add</span>
            </button>
          </div>
        </div>

        <!-- Member list header & search -->
        <div class="list-section">
          <div class="list-header">
            <label class="section-label">Current Members</label>
            <div class="filter-box">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                v-model="searchMemberQuery"
                type="text"
                class="filter-input"
                placeholder="Filter members..."
              />
            </div>
          </div>

          <div class="members-table-container">
            <div v-if="membersLoading" class="loading-state">
              Loading members...
            </div>
            <div v-else-if="filteredMembers.length === 0" class="empty-state">
              No members found
            </div>
            <ul v-else class="members-table">
              <li
                v-for="member in filteredMembers"
                :key="member.id"
                class="member-row"
              >
                <div class="member-user-info">
                  <div class="member-avatar">
                    {{ getInitials(member.name) }}
                    <span
                      class="status-indicator"
                      :class="member.status === 'online' ? 'status-indicator--online' : 'status-indicator--offline'"
                    />
                  </div>
                  <div class="member-details">
                    <span class="member-name">{{ member.name }}</span>
                    <span class="member-email">{{ member.email || 'team-member' }}</span>
                  </div>
                </div>

                <div class="member-actions">
                  <span class="role-badge" :class="`role-badge--${member.role}`">
                    {{ member.role }}
                  </span>

                  <!-- Remove button -->
                  <button
                    v-if="member.role !== 'admin'"
                    type="button"
                    class="remove-btn"
                    :disabled="removingMemberId === member.id"
                    title="Remove user"
                    @click="handleRemove(member)"
                  >
                    <span v-if="removingMemberId === member.id">...</span>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-done" @click="handleClose">
          Done
        </button>
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
  max-width: 540px;
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

.modal-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
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

.success-banner {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #86efac;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
}

.add-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.add-input-wrapper {
  display: flex;
  gap: 8px;
}

.add-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}
.add-input:focus {
  border-color: #7c3aed;
  background: rgba(255, 255, 255, 0.08);
}

.add-btn {
  background: #7c3aed;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
  white-space: nowrap;
}
.add-btn:hover:not(:disabled) {
  background: #6d28d9;
}
.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.suggestions-dropdown {
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  background: #252238;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  max-height: 180px;
  overflow-y: auto;
  z-index: 10;
  padding: 4px;
}

.suggestion-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.suggestion-row:hover {
  background: rgba(124, 58, 237, 0.2);
}

.suggestion-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.suggestion-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.suggestion-name {
  font-size: 13px;
  font-weight: 500;
}
.suggestion-email {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.invite-label {
  font-size: 11px;
  color: #a78bfa;
  font-weight: 600;
}

.list-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 4px 8px;
  color: rgba(255, 255, 255, 0.4);
}

.filter-input {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 11px;
  outline: none;
  width: 110px;
}

.members-table-container {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.15);
}

.members-table {
  list-style: none;
  padding: 4px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.member-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.member-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-avatar {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}

.status-indicator {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #1e1b2e;
}
.status-indicator--online {
  background: #22c55e;
}
.status-indicator--offline {
  background: #64748b;
}

.member-details {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 13px;
  font-weight: 500;
  color: #f1f5f9;
}

.member-email {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
}
.role-badge--admin {
  background: rgba(124, 58, 237, 0.2);
  color: #c4b5fd;
  border: 1px solid rgba(124, 58, 237, 0.4);
}
.role-badge--member {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
}

.remove-btn {
  background: transparent;
  border: none;
  color: rgba(239, 68, 68, 0.6);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}
.remove-btn:hover:not(:disabled) {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
.remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state,
.empty-state {
  padding: 30px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-done {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-done:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
