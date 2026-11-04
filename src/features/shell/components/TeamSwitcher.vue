<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'
import { useUiStore } from '@/stores/ui'
import { getAuthUserId } from '@/features/auth/session'
import { useAnchoredPopover } from '../composables/useAnchoredPopover'
import ConfirmDialog from './ConfirmDialog.vue'
import EditTeamModal from './EditTeamModal.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])
const teamsStore = useTeamsStore()
const membersStore = useMembersStore()
const ui = useUiStore()
const router = useRouter()
const currentUserId = getAuthUserId()
const root = ref(null)
const popoverTrigger = ref(null)
const menuPosition = ref({ top: 0, left: 0 })
const searchInput = ref(null)
const editTeamOpen = ref(false)
const deletingTeam = ref(false)
const leavingTeam = ref(false)
const confirmation = ref(null)
const confirmationLoading = ref(false)
const confirmationError = ref('')
const { teamsOfActiveWorkspace, activeTeamId, activeWorkspaceId, activeTeam } =
  storeToRefs(teamsStore)
const searchFilter = ref('')
const { updatePosition } = useAnchoredPopover({
  isOpen: computed(() => props.isOpen && !confirmation.value),
  triggerRef: popoverTrigger,
  popoverRef: root,
  position: menuPosition,
  placement: 'bottom-start',
  onClose: () => emit('close'),
})

const filteredTeams = computed(() => {
  const query = searchFilter.value.trim().toLocaleLowerCase()
  if (!query) return teamsOfActiveWorkspace.value
  return teamsOfActiveWorkspace.value.filter((team) =>
    team.name.toLocaleLowerCase().includes(query),
  )
})

async function handleSelect(teamId) {
  if (!teamsStore.selectTeam(teamId)) return
  if (activeWorkspaceId.value) {
    await router.push({
      name: 'workspace-team',
      params: { workspaceId: activeWorkspaceId.value, teamId },
    })
  }
  emit('close')
}

function closeAndRun(action) {
  emit('close')
  action()
}

function openEditTeam() {
  emit('close')
  editTeamOpen.value = true
}

function requestConfirmation(kind) {
  const team = activeTeam.value
  if (!team) return
  confirmationError.value = ''
  confirmation.value = {
    kind,
    team,
    workspaceId: activeWorkspaceId.value,
    title: kind === 'delete' ? 'Delete team' : 'Leave team',
    message:
      kind === 'delete'
        ? `Delete the team ${team.name}? This can't be undone.`
        : `Leave ${team.name}? You will lose access to this team.`,
    confirmLabel: kind === 'delete' ? 'Delete team' : 'Leave team',
  }
}

async function confirmTeamAction() {
  const action = confirmation.value
  if (!action || confirmationLoading.value) return
  confirmationLoading.value = true
  confirmationError.value = ''

  if (action.kind === 'delete') deletingTeam.value = true
  else leavingTeam.value = true

  try {
    if (action.kind === 'delete') {
      await teamsStore.deleteTeam(action.team.id)
      confirmation.value = null
      emit('close')
      await router.replace({ path: `/app/${encodeURIComponent(action.workspaceId)}` })
      return
    }

    const response = await membersStore.leaveTeam(action.workspaceId, action.team.id, currentUserId)
    const nextTeamId = teamsStore.activeTeamId
    confirmation.value = null
    emit('close')
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
      (action.kind === 'leave' && membersStore.error) ||
      (action.kind === 'delete'
        ? 'Unable to delete team. Please try again.'
        : 'Unable to leave team.')
  } finally {
    confirmationLoading.value = false
    deletingTeam.value = false
    leavingTeam.value = false
  }
}

function cancelConfirmation() {
  if (confirmationLoading.value) return
  confirmation.value = null
  confirmationError.value = ''
}

function handleKeydown(event) {
  if (!props.isOpen || confirmation.value) return
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

  const items = [...(root.value?.querySelectorAll('[role="menuitem"]') ?? [])]
  if (!items.length) return
  event.preventDefault()
  const currentIndex = items.indexOf(document.activeElement)
  const direction = event.key === 'ArrowDown' ? 1 : -1
  const nextIndex =
    currentIndex < 0
      ? direction > 0
        ? 0
        : items.length - 1
      : (currentIndex + direction + items.length) % items.length
  items[nextIndex].focus()
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      popoverTrigger.value =
        root.value?.parentElement?.querySelector(':scope > button') ??
        root.value?.parentElement?.querySelector('button[aria-haspopup="menu"]')
      nextTick(() => {
        updatePosition()
        searchInput.value?.focus()
      })
    } else searchFilter.value = ''
  },
  { flush: 'sync' },
)

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
</script>

<template>
  <Teleport to="body" :disabled="!isOpen">
    <div
      ref="root"
      v-show="isOpen"
      class="team-switcher shell-surface"
      role="menu"
      aria-label="Teams"
      :style="{ top: menuPosition.top, left: menuPosition.left }"
    >
      <div class="team-switcher__search">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="team-switcher-search"
          ref="searchInput"
          v-model="searchFilter"
          type="search"
          class="shell-input"
          aria-label="Search teams"
          placeholder="Search teams"
        />
      </div>

      <div class="team-switcher__list" role="group" aria-label="Available teams">
        <p v-if="!filteredTeams.length" class="team-switcher__empty" role="status">
          No teams found
        </p>
        <button
          v-for="team in filteredTeams"
          :key="team.id"
          type="button"
          class="team-switcher__team"
          :class="{ 'team-switcher__team--active': activeTeamId === team.id }"
          role="menuitem"
          :title="team.name"
          :aria-current="activeTeamId === team.id ? 'page' : undefined"
          @click="handleSelect(team.id)"
        >
          <span
            class="team-switcher__badge"
            :style="{ background: team.color || 'var(--color-indigo-500)' }"
            aria-hidden="true"
          >
            {{ team.initials || getInitials(team.name) }}
          </span>
          <span class="team-switcher__name">{{ team.name }}</span>
          <svg
            v-if="activeTeamId === team.id"
            class="team-switcher__check"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="m4 10 4 4 8-8" />
          </svg>
        </button>
      </div>

      <div class="team-switcher__actions">
        <button
          v-if="teamsStore.isAdmin"
          type="button"
          role="menuitem"
          @click="closeAndRun(ui.toggleTeamCreateModal)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Create a team</span>
        </button>
        <button type="button" role="menuitem" @click="closeAndRun(ui.toggleMemberManageModal)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20" />
          </svg>
          <span>Manage members</span>
        </button>
        <button
          v-if="activeTeam && teamsStore.isAdmin"
          type="button"
          role="menuitem"
          @click="openEditTeam"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          </svg>
          <span>Edit team</span>
        </button>
        <button
          v-if="activeTeam"
          type="button"
          role="menuitem"
          :disabled="leavingTeam"
          @click="requestConfirmation('leave')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 17l5-5-5-5M15 12H3M21 19V5" />
          </svg>
          <span>{{ leavingTeam ? 'Leaving…' : 'Leave team' }}</span>
        </button>
        <button
          v-if="activeTeam && teamsStore.isAdmin"
          type="button"
          class="team-switcher__danger"
          role="menuitem"
          :disabled="deletingTeam"
          @click="requestConfirmation('delete')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" />
          </svg>
          <span>{{ deletingTeam ? 'Deleting…' : 'Delete team' }}</span>
        </button>
      </div>
    </div>
  </Teleport>

  <EditTeamModal :is-open="editTeamOpen" :team="activeTeam" @close="editTeamOpen = false" />
  <ConfirmDialog
    v-if="confirmation"
    :is-open="Boolean(confirmation)"
    :title="confirmation.title"
    :message="confirmation.message"
    :confirm-label="confirmation.confirmLabel"
    :variant="confirmation.kind === 'delete' ? 'danger' : 'default'"
    :loading="confirmationLoading"
    :error-message="confirmationError"
    @confirm="confirmTeamAction"
    @cancel="cancelConfirmation"
  />
</template>

<style scoped>
.team-switcher {
  position: fixed;
  z-index: var(--shell-z-popover);
  top: calc(100% + 0.5rem);
  left: 0;
  display: flex;
  width: min(17.5rem, calc(100vw - 1rem));
  max-height: calc(100vh - 1rem);
  flex-direction: column;
  overflow-y: auto;
  padding: 0.375rem;
}

.team-switcher__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-slate-200);
  padding: 0.375rem 0.25rem 0.625rem;
}

.team-switcher__search svg {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  color: var(--color-slate-500);
}

.team-switcher__search input {
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.875rem;
}

.team-switcher__list {
  display: flex;
  max-height: min(14rem, calc(100vh - 20rem));
  flex-direction: column;
  gap: 0.125rem;
  overflow-y: auto;
  padding: 0.375rem 0.125rem;
  scrollbar-color: var(--color-slate-400) transparent;
  scrollbar-width: thin;
}

.team-switcher__list::-webkit-scrollbar,
.workspace-switcher__menu::-webkit-scrollbar {
  width: 0.375rem;
}

.team-switcher__list::-webkit-scrollbar-thumb,
.workspace-switcher__menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--color-slate-400);
}

.team-switcher__team {
  display: flex;
  min-width: 0;
  min-height: 2.375rem;
  align-items: center;
  gap: 0.625rem;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: transparent;
  color: var(--color-slate-800);
  cursor: pointer;
  text-align: left;
}

.team-switcher__team:hover,
.team-switcher__team--active {
  background: var(--color-indigo-50);
}

.team-switcher__badge {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  color: var(--color-white);
  font-size: 0.6875rem;
  font-weight: 700;
}

.team-switcher__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-switcher__check,
.team-switcher__actions svg {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.team-switcher__check {
  stroke: var(--shell-accent);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.team-switcher__empty {
  margin: 0;
  padding: 0.875rem 0.5rem;
  color: var(--color-slate-600);
  font-size: 0.875rem;
  text-align: center;
}

.team-switcher__actions {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  border-top: 1px solid var(--color-slate-200);
  padding: 0.375rem 0.125rem 0.125rem;
}

.team-switcher__actions button {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  color: var(--color-slate-700);
  cursor: pointer;
  font-size: 0.875rem;
  text-align: left;
}

.team-switcher__actions button:hover:not(:disabled) {
  background: var(--color-slate-100);
  color: var(--color-slate-900);
}

.team-switcher__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.team-switcher__actions .team-switcher__danger {
  margin-top: 0.25rem;
  border-top: 1px solid var(--color-slate-200);
  border-radius: 0;
  padding-top: 0.625rem;
  color: var(--color-red-700);
}

.team-switcher__actions .team-switcher__danger:hover:not(:disabled) {
  background: var(--color-red-50);
  color: var(--color-red-800);
}
</style>
