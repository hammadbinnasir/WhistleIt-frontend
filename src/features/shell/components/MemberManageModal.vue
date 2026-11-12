<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'
import { useUiStore } from '@/stores/ui'
import { getAuthUserId } from '@/features/auth/session'
import { usePresenceStore } from '@/features/dms/stores/presence'
import ConfirmDialog from './ConfirmDialog.vue'

const teamsStore = useTeamsStore()
const membersStore = useMembersStore()
const ui = useUiStore()
const router = useRouter()
const presence = usePresenceStore()

const { activeTeam, activeTeamId, activeWorkspaceId, isAdmin } = storeToRefs(teamsStore)
const {
  members,
  notMembers,
  loading: membersLoading,
  notMembersLoading,
  writing: membersWriting,
  error: membersError,
  notMembersError,
  permissionDenied,
} = storeToRefs(membersStore)
const currentUserId = getAuthUserId()

const searchMemberQuery = ref('')
const pickerOpen = ref(false)
const pickerQuery = ref('')
const debouncedPickerQuery = ref('')
const selectedUserIds = ref(new Set())
const removingUserId = ref(null)
const confirmation = ref(null)
const confirmationLoading = ref(false)
const confirmationError = ref('')
const actionError = ref('')
const successNotice = ref('')
let debounceTimer = null

function isCurrentUser(member) {
  return (
    currentUserId != null &&
    member.userId != null &&
    String(member.userId) === String(currentUserId)
  )
}

function statusOfMember(member) {
  return presence.stateOf(String(member.userId))
}

// Fetch members whenever modal opens
watch(
  () => ui.memberManageModalOpen,
  (isOpen) => {
    if (isOpen && activeWorkspaceId.value && activeTeamId.value) {
      membersStore.fetchMembers(activeWorkspaceId.value, activeTeamId.value)
    }
  },
  { immediate: true },
)

watch(pickerQuery, (query) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedPickerQuery.value = query.trim().toLocaleLowerCase()
  }, 200)
})

const filteredMembers = computed(() => {
  const q = searchMemberQuery.value.trim().toLocaleLowerCase()
  if (!q) return members.value
  return members.value.filter((member) => (member.name ?? '').toLocaleLowerCase().includes(q))
})

const eligibleUsers = computed(() =>
  notMembers.value.filter(
    (user) =>
      user.userId != null &&
      String(user.userId) !== String(currentUserId) &&
      !members.value.some((member) => String(member.userId) === String(user.userId)),
  ),
)

const filteredPickerUsers = computed(() => {
  const query = debouncedPickerQuery.value
  if (!query) return eligibleUsers.value
  return eligibleUsers.value.filter((user) => (user.name ?? '').toLocaleLowerCase().includes(query))
})

async function openPicker() {
  pickerOpen.value = true
  pickerQuery.value = ''
  debouncedPickerQuery.value = ''
  selectedUserIds.value = new Set()
  actionError.value = ''
  if (activeWorkspaceId.value && activeTeamId.value) {
    await membersStore.fetchNotMembers(activeWorkspaceId.value, activeTeamId.value)
  }
}

function toggleUserSelection(userId) {
  const selected = new Set(selectedUserIds.value)
  if (selected.has(userId)) selected.delete(userId)
  else selected.add(userId)
  selectedUserIds.value = selected
}

async function handleAddSelected() {
  const userIds = [...selectedUserIds.value]
  if (!userIds.length || !activeWorkspaceId.value || !activeTeamId.value) return

  actionError.value = ''
  successNotice.value = ''

  try {
    const response =
      userIds.length === 1
        ? await membersStore.addMember(activeWorkspaceId.value, activeTeamId.value, userIds[0])
        : await membersStore.addMembers(activeWorkspaceId.value, activeTeamId.value, userIds)
    successNotice.value =
      response?.message || `Member${userIds.length === 1 ? '' : 's'} added successfully.`
    selectedUserIds.value = new Set()
    pickerOpen.value = false
  } catch (err) {
    actionError.value = membersStore.error || err?.message || 'Could not add member.'
  }
}

async function handleRemove(member) {
  if (
    permissionDenied.value ||
    !member.userId ||
    String(member.userId) === String(currentUserId) ||
    !activeWorkspaceId.value ||
    !activeTeamId.value
  ) {
    return
  }
  confirmationError.value = ''
  actionError.value = ''
  successNotice.value = ''
  confirmation.value = {
    kind: 'remove',
    member,
    workspaceId: activeWorkspaceId.value,
    teamId: activeTeamId.value,
    title: 'Remove member',
    message: `Remove ${member.name || 'this member'} from ${activeTeam.value?.name || 'this team'}?`,
    confirmLabel: 'Remove member',
  }
}

async function handleConfirmAction() {
  const action = confirmation.value
  if (!action || confirmationLoading.value) return
  confirmationLoading.value = true
  confirmationError.value = ''

  try {
    if (action.kind === 'remove') {
      removingUserId.value = action.member.userId
      const response = await membersStore.removeMember(
        action.workspaceId,
        action.teamId,
        action.member.userId,
      )
      confirmation.value = null
      if (membersStore.error) actionError.value = membersStore.error
      else successNotice.value = response?.message || `Removed ${action.member.name || 'member'}.`
      return
    }

    const response = await membersStore.leaveTeam(action.workspaceId, action.teamId, currentUserId)
    const nextTeamId = teamsStore.activeTeamId
    confirmation.value = null
    handleClose()
    ui.toast('Left team', response?.message || 'You left the team.', 'success')
    if (nextTeamId) {
      await router.push({
        name: 'workspace-team',
        params: { workspaceId: action.workspaceId, teamId: nextTeamId },
      })
    } else {
      await router.push({ path: `/app/${encodeURIComponent(action.workspaceId)}` })
    }
  } catch (error) {
    confirmationError.value =
      error?.message ||
      membersStore.error ||
      (action.kind === 'remove' ? 'Failed to remove member.' : 'Could not leave this team.')
  } finally {
    removingUserId.value = null
    confirmationLoading.value = false
  }
}

function handleLeaveTeam() {
  const team = activeTeam.value
  if (!team || !activeWorkspaceId.value || !activeTeamId.value || membersWriting.value) return
  confirmationError.value = ''
  actionError.value = ''
  successNotice.value = ''
  confirmation.value = {
    kind: 'leave',
    workspaceId: activeWorkspaceId.value,
    teamId: team.id,
    title: 'Leave team',
    message: `Leave ${team.name}? You will lose access to this team.`,
    confirmLabel: 'Leave team',
  }
}

function cancelConfirmation() {
  if (confirmationLoading.value) return
  confirmation.value = null
  confirmationError.value = ''
}

function handleClose() {
  ui.toggleMemberManageModal()
  searchMemberQuery.value = ''
  pickerOpen.value = false
  pickerQuery.value = ''
  selectedUserIds.value = new Set()
  actionError.value = ''
  successNotice.value = ''
  clearTimeout(debounceTimer)
}

function handleKeydown(event) {
  if (event.key === 'Escape' && ui.memberManageModalOpen && !confirmation.value) {
    event.preventDefault()
    handleClose()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  clearTimeout(debounceTimer)
})

function getInitials(name) {
  return String(name || 'Member')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<template>
  <div
    v-if="ui.memberManageModalOpen"
    class="modal-backdrop shell-modal-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="member-manage-title"
  >
    <div class="modal-card shell-surface shell-member-modal">
      <div class="modal-header">
        <div>
          <h3 id="member-manage-title" class="modal-title">Manage Workspace Members</h3>
          <span class="modal-subtitle">
            {{ activeTeam ? activeTeam.name : 'Workspace' }} ({{ members.length }} members)
          </span>
        </div>
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
        <div v-if="successNotice" class="success-banner" role="status">
          {{ successNotice }}
        </div>
        <div v-if="actionError" class="error-banner" role="alert">
          {{ actionError }}
        </div>
        <div v-if="membersError && membersError !== actionError" class="error-banner" role="alert">
          {{ membersError }}
          <button
            type="button"
            class="retry-members"
            @click="membersStore.fetchMembers(activeWorkspaceId, activeTeamId)"
          >
            Retry
          </button>
        </div>
        <p v-if="permissionDenied" class="not-available-banner" role="status">
          You do not have permission to manage this team’s members. The list is read-only.
        </p>

        <section class="add-section" aria-label="Add team members">
          <button
            v-if="isAdmin"
            type="button"
            class="add-btn"
            :disabled="membersWriting || (permissionDenied && !pickerOpen)"
            :aria-expanded="pickerOpen"
            @click="pickerOpen ? (pickerOpen = false) : openPicker()"
          >
            {{ pickerOpen ? 'Close member picker' : 'Add members' }}
          </button>

          <div v-if="pickerOpen && isAdmin" class="member-picker">
            <label class="section-label" for="member-picker-search">Search by user name</label>
            <input
              id="member-picker-search"
              v-model="pickerQuery"
              type="search"
              class="add-input"
              placeholder="Search by user name"
              :disabled="notMembersLoading || permissionDenied"
              @keydown.enter.prevent="handleAddSelected"
            />
            <div v-if="notMembersLoading" class="loading-state" role="status">Loading users...</div>
            <div v-else-if="notMembersError" class="error-banner" role="alert">
              {{ notMembersError }}
              <button
                type="button"
                class="retry-members"
                @click="membersStore.fetchNotMembers(activeWorkspaceId, activeTeamId)"
              >
                Retry
              </button>
            </div>
            <div v-else-if="notMembers.length === 0" class="empty-state" role="status">
              No users available to add.
            </div>
            <div v-else-if="filteredPickerUsers.length === 0" class="empty-state" role="status">
              No users found
            </div>
            <ul v-else class="picker-list" aria-label="Available users">
              <li v-for="user in filteredPickerUsers" :key="user.userId" class="picker-row">
                <label class="picker-user">
                  <input
                    type="checkbox"
                    :checked="selectedUserIds.has(user.userId)"
                    :disabled="membersWriting || permissionDenied"
                    @change="toggleUserSelection(user.userId)"
                  />
                  <span class="suggestion-avatar">{{ getInitials(user.name) }}</span>
                  <span class="suggestion-meta">
                    <span class="suggestion-name">{{ user.name }}</span>
                    <span v-if="user.email" class="suggestion-email">{{ user.email }}</span>
                  </span>
                </label>
              </li>
            </ul>
            <div class="picker-footer">
              <span>{{ selectedUserIds.size }} selected</span>
              <button
                type="button"
                class="add-btn"
                :disabled="selectedUserIds.size === 0 || membersWriting || permissionDenied"
                @click="handleAddSelected"
              >
                <span v-if="membersWriting">Adding...</span>
                <span v-else>Add selected</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Member list header & search -->
        <div class="list-section">
          <div class="list-header">
            <label class="section-label">Current Members</label>
            <div class="filter-box">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
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
            <div v-if="membersLoading" class="loading-state">Loading members...</div>
            <div v-else-if="filteredMembers.length === 0" class="empty-state">No members found</div>
            <ul v-else class="members-table">
              <li
                v-for="member in filteredMembers"
                :key="member.userId || member.membershipId"
                class="member-row"
              >
                <div class="member-user-info">
                  <div class="member-avatar">
                    <img
                      v-if="member.avatarUrl || member.avatar"
                      :src="member.avatarUrl || member.avatar"
                      alt=""
                    />
                    <template v-else>{{ getInitials(member.name || 'Member') }}</template>
                    <span
                      class="status-indicator"
                      :class="`status-indicator--${statusOfMember(member)}`"
                      :title="statusOfMember(member)"
                    />
                  </div>
                  <div class="member-details">
                    <span class="member-name">
                      {{ member.name || 'Member' }}<span v-if="isCurrentUser(member)"> (You)</span>
                    </span>
                  </div>
                </div>

                <div class="member-actions">
                  <button
                    v-if="isCurrentUser(member)"
                    type="button"
                    class="leave-btn"
                    :disabled="membersWriting"
                    @click="handleLeaveTeam"
                  >
                    Leave team
                  </button>
                  <span v-if="member.isCreator" class="role-badge role-badge--admin">
                    Creator
                  </span>
                  <span
                    v-else-if="member.role"
                    class="role-badge"
                    :class="`role-badge--${member.role}`"
                  >
                    {{ member.role }}
                  </span>

                  <!-- Remove button -->
                  <button
                    v-if="
                      isAdmin &&
                      member.userId &&
                      String(member.userId) !== String(currentUserId) &&
                      !permissionDenied
                    "
                    type="button"
                    class="remove-btn"
                    :disabled="membersWriting || removingUserId === member.userId"
                    title="Remove user"
                    @click="handleRemove(member)"
                  >
                    <span v-if="removingUserId === member.userId">...</span>
                    <svg
                      v-else
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-done" @click="handleClose">Done</button>
      </div>
    </div>
  </div>
  <ConfirmDialog
    v-if="confirmation"
    :is-open="Boolean(confirmation)"
    :title="confirmation.title"
    :message="confirmation.message"
    :confirm-label="confirmation.confirmLabel"
    :variant="confirmation.kind === 'remove' ? 'danger' : 'default'"
    :loading="confirmationLoading"
    :error-message="confirmationError"
    @confirm="handleConfirmAction"
    @cancel="cancelConfirmation"
  />
</template>

<style scoped>
.modal-backdrop {
  z-index: var(--shell-z-modal);
}

.modal-card {
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-card button:focus-visible,
.modal-card input:focus-visible {
  outline: 2px solid var(--color-indigo-400);
  outline-offset: 2px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-slate-200);
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--color-slate-900);
}

.modal-subtitle {
  font-size: 12px;
  color: var(--color-slate-600);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--color-slate-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.close-btn:hover {
  color: var(--color-slate-900);
  background: var(--color-slate-100);
}

.modal-body {
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-color: var(--color-slate-400) transparent;
  scrollbar-width: thin;
}

.not-available-banner {
  margin: 0;
  border: 1px solid var(--color-amber-200);
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-amber-50);
  color: var(--color-amber-900);
  font-size: 0.8125rem;
}

.success-banner {
  background: var(--color-green-50);
  border: 1px solid var(--color-green-200);
  color: var(--color-green-800);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.error-banner {
  background: var(--color-red-50);
  border: 1px solid var(--color-red-200);
  color: var(--color-red-800);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-slate-700);
}

.add-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.member-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--color-slate-200);
  border-radius: 8px;
  padding: 10px;
}

.picker-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 180px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
}

.picker-row {
  border-radius: 6px;
}

.picker-row:hover {
  background: var(--color-slate-50);
}

.picker-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  cursor: pointer;
}

.picker-user input {
  accent-color: var(--color-indigo-400);
}

.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.picker-footer > span {
  font-size: 12px;
  color: var(--color-slate-600);
}

.retry-members {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: var(--color-indigo-300);
  cursor: pointer;
  text-decoration: underline;
}

.add-input-wrapper {
  display: flex;
  gap: 8px;
}

.add-input {
  flex: 1;
  background: var(--color-white);
  border: 1px solid var(--color-slate-300);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--color-slate-900);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}
.add-input:focus {
  border-color: var(--color-indigo-600);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-indigo-600) 16%, transparent);
}

.add-btn {
  background: var(--color-indigo-600);
  color: var(--color-white);
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
  background: var(--color-indigo-700);
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
  background: var(--color-white);
  border: 1px solid var(--color-slate-200);
  border-radius: 8px;
  box-shadow: var(--shell-surface-shadow);
  max-height: 180px;
  overflow-y: auto;
  z-index: var(--shell-z-popover);
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
  color: var(--color-slate-800);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.suggestion-row:hover {
  background: var(--color-indigo-50);
}

.suggestion-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-indigo-600);
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
  color: var(--color-slate-600);
}

.invite-label {
  font-size: 11px;
  color: var(--color-indigo-700);
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
  background: var(--color-white);
  border: 1px solid var(--color-slate-300);
  border-radius: 6px;
  padding: 4px 8px;
  color: var(--color-slate-500);
}

.filter-input {
  background: transparent;
  border: none;
  color: var(--color-slate-900);
  font-size: 11px;
  outline: none;
  width: 110px;
}

.filter-input::placeholder {
  color: var(--color-slate-500);
  opacity: 1;
}

.members-table-container {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--color-slate-200);
  border-radius: 8px;
  background: var(--color-white);
  scrollbar-color: var(--color-slate-400) transparent;
  scrollbar-width: thin;
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.member-row:hover {
  background: var(--color-slate-50);
}

.member-hover-card {
  position: absolute;
  left: 50%;
  top: -18px;
  transform: translateX(-50%);
  width: 260px;
  background: var(--color-white);
  color: var(--color-slate-900);
  border: 1px solid var(--color-slate-200);
  border-radius: 16px;
  box-shadow: var(--shell-surface-shadow);
  padding: 14px 14px 12px;
  z-index: var(--shell-z-popover);
  pointer-events: none;
}

.member-hover-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.member-hover-card__avatar {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-indigo-600), var(--color-indigo-500));
  color: var(--color-white);
  font-size: 22px;
  font-weight: 700;
  margin: 0 auto;
}

.member-hover-card__status {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-slate-100);
}
.member-hover-card__status--online {
  color: var(--color-green-800);
  background: var(--color-green-100);
}
.member-hover-card__status--offline {
  color: var(--color-slate-700);
  background: var(--color-slate-100);
}

.member-hover-card__body {
  text-align: center;
  margin-bottom: 12px;
}

.member-hover-card__body h4 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
}

.member-hover-card__body p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-slate-700);
}

.member-hover-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.member-hover-card__action {
  border-radius: 10px;
  border: 1px solid var(--color-slate-300);
  background: transparent;
  padding: 9px 10px;
  font-weight: 600;
  cursor: pointer;
}
.member-hover-card__action--primary {
  background: var(--color-white);
  color: var(--color-slate-900);
}
.member-hover-card__action--secondary {
  background: var(--color-slate-50);
  color: var(--color-slate-900);
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
  background: var(--color-slate-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-white);
}

.status-indicator {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--color-white);
}
.status-indicator--online {
  background: var(--color-green-500);
}
.status-indicator--away {
  background: var(--color-amber-400);
}
.status-indicator--dnd {
  background: var(--color-red-500);
}
.status-indicator--offline {
  background: var(--color-slate-500);
}

.member-details {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-slate-900);
}

.member-email {
  font-size: 11px;
  color: var(--color-slate-600);
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
  background: var(--color-indigo-50);
  color: var(--color-indigo-800);
  border: 1px solid var(--color-indigo-200);
}
.role-badge--member {
  background: var(--color-slate-100);
  color: var(--color-slate-700);
}

.remove-btn {
  background: transparent;
  border: none;
  color: var(--color-red-600);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}
.leave-btn {
  border: 0;
  border-radius: 4px;
  padding: 4px 6px;
  background: transparent;
  color: var(--color-indigo-700);
  cursor: pointer;
  font-size: 11px;
}
.leave-btn:hover:not(:disabled) {
  background: var(--color-indigo-50);
}
.leave-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.remove-btn:hover:not(:disabled) {
  color: var(--color-red-700);
  background: var(--color-red-50);
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
  color: var(--color-slate-600);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: var(--color-slate-50);
  border-top: 1px solid var(--color-slate-200);
}

.btn-done {
  background: var(--color-white);
  color: var(--color-slate-800);
  border: 1px solid var(--color-slate-300);
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-done:hover {
  background: var(--color-slate-50);
}
</style>
