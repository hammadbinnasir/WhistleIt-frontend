<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

const router = useRouter()
const teamsStore = useTeamsStore()
const ui = useUiStore()
const emit = defineEmits(['invite'])
const {
  activeWorkspaceId,
  activeTeamId,
  teamsOfActiveWorkspace,
  workspacesLoading,
  workspacesError,
  teamsLoading,
  teamsError,
} = storeToRefs(teamsStore)

const teamActionsOpen = ref(false)
const teamActionsButton = ref(null)
const teamActionsPopover = ref(null)
const teamActionsPosition = ref({ top: 0, left: 0 })
const railTooltip = ref(null)

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

async function updateRoute(workspaceId, teamId) {
  if (!workspaceId) return
  await router.push(
    teamId
      ? { name: 'workspace-team', params: { workspaceId, teamId } }
      : { path: `/app/${encodeURIComponent(workspaceId)}` },
  )
}

async function handleWorkspaceSelect(workspaceId) {
  await teamsStore.selectWorkspace(workspaceId)
  await updateRoute(workspaceId, teamsStore.activeTeamId)
}

async function handleTeamSelect(teamId) {
  if (!teamsStore.selectTeam(teamId)) return
  await updateRoute(activeWorkspaceId.value, teamId)
}

function closeTeamActions(restoreFocus = false) {
  teamActionsOpen.value = false
  if (restoreFocus) nextTick(() => teamActionsButton.value?.focus())
}

function toggleTeamActions() {
  if (teamActionsOpen.value) {
    closeTeamActions()
    return
  }
  const bounds = teamActionsButton.value.getBoundingClientRect()
  const railBounds = teamActionsButton.value.closest('.team-rail').getBoundingClientRect()
  teamActionsPosition.value = {
    top: Math.min(bounds.top, window.innerHeight - 108),
    left: Math.max(bounds.right + 8, railBounds.right + 8),
  }
  teamActionsOpen.value = true
  nextTick(() => teamActionsPopover.value?.querySelector('button')?.focus())
}

function handleDocumentPointer(event) {
  if (
    teamActionsOpen.value &&
    !teamActionsButton.value?.contains(event.target) &&
    !teamActionsPopover.value?.contains(event.target)
  ) {
    closeTeamActions()
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape' && teamActionsOpen.value) {
    event.preventDefault()
    closeTeamActions(true)
  }
}

function openCreateTeam() {
  closeTeamActions()
  ui.toggleTeamCreateModal()
}

function openJoinTeam() {
  closeTeamActions()
  ui.toggleTeamJoinModal()
}

function retryLoad() {
  if (workspacesError.value) {
    void teamsStore.fetchWorkspaces()
  } else if (activeWorkspaceId.value) {
    void teamsStore.fetchTeams(activeWorkspaceId.value)
  }
}

function showRailTooltip(event, text) {
  const bounds = event.currentTarget.getBoundingClientRect()
  railTooltip.value = {
    text,
    top: bounds.top + bounds.height / 2,
    left: bounds.right + 10,
  }
}

function hideRailTooltip() {
  railTooltip.value = null
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointer)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointer)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <aside class="team-rail" role="navigation" aria-label="Workspace and team navigation">
    <div class="team-rail__middle">
      <section class="team-rail__section" aria-labelledby="workspace-heading">
        <h2 id="workspace-heading" class="team-rail__label">Workspace</h2>
        <div
          v-if="workspacesLoading && !teamsStore.workspaces.length"
          class="team-rail__icon-list"
          aria-label="Loading workspaces"
        >
          <span v-for="item in 2" :key="item" class="team-rail__skeleton" />
        </div>
        <WorkspaceSwitcher v-else @select="handleWorkspaceSelect" />
        <p v-if="workspacesError" class="team-rail__message" role="alert">
          {{ workspacesError }}
        </p>
        <button v-if="workspacesError" type="button" class="team-rail__retry" @click="retryLoad">
          Retry
        </button>
        <p
          v-if="!workspacesLoading && !workspacesError && !teamsStore.workspaces.length"
          class="team-rail__message"
        >
          None yet
        </p>
        <button
          type="button"
          class="team-rail__add team-rail__add--invite"
          aria-label="Invite people"
          @mouseenter="showRailTooltip($event, 'Invite People')"
          @mouseleave="hideRailTooltip"
          @focus="showRailTooltip($event, 'Invite People')"
          @blur="hideRailTooltip"
          @click="emit('invite')"
        >
          <svg
            class="team-rail__invite-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9.5" cy="7" r="4" />
            <path d="M19 8v6" />
            <path d="M22 11h-6" />
          </svg>
        </button>
      </section>

      <section class="team-rail__section team-rail__section--teams" aria-labelledby="teams-heading">
        <h2 id="teams-heading" class="team-rail__label">Teams</h2>
        <p v-if="teamsError" class="team-rail__message" role="alert">
          {{ teamsError }}
        </p>
        <button v-if="teamsError" type="button" class="team-rail__retry" @click="retryLoad">
          Retry
        </button>
        <p
          v-else-if="!workspacesLoading && !teamsStore.workspaces.length"
          class="team-rail__message"
          role="status"
        >
          No workspaces
        </p>
        <p
          v-else-if="!teamsLoading && activeWorkspaceId && !teamsOfActiveWorkspace.length"
          class="team-rail__message"
          role="status"
        >
          No teams yet
        </p>

        <div class="team-rail__team-list" aria-label="Teams in the active workspace">
          <template v-if="teamsLoading && !teamsOfActiveWorkspace.length">
            <span v-for="item in 3" :key="item" class="team-rail__skeleton" />
          </template>
          <button
            v-for="team in teamsOfActiveWorkspace"
            :key="team.id"
            type="button"
            class="team-rail__team"
            :class="{ 'team-rail__team--active': activeTeamId === team.id }"
            :title="team.name"
            :aria-label="`Switch to team ${team.name}`"
            :aria-current="activeTeamId === team.id ? 'page' : undefined"
            @click="handleTeamSelect(team.id)"
          >
            <span class="team-rail__initials">{{ team.initials || getInitials(team.name) }}</span>
            <span class="team-rail__indicator" aria-hidden="true" />
          </button>
        </div>

        <button
          ref="teamActionsButton"
          type="button"
          class="team-rail__add"
          aria-label="Team actions"
          title="Create or join a team"
          aria-haspopup="menu"
          :aria-expanded="teamActionsOpen"
          :disabled="!activeWorkspaceId"
          @click="toggleTeamActions"
        >
          <span aria-hidden="true">+</span>
        </button>
      </section>
    </div>

    <footer class="team-rail__footer">
      <div class="team-rail__user">
        <slot name="footer" />
      </div>
      <button
        type="button"
        class="team-rail__help"
        :class="{ 'team-rail__help--active': ui.activePanel === 'help' }"
        aria-label="Open help"
        @mouseenter="showRailTooltip($event, 'Help')"
        @mouseleave="hideRailTooltip"
        @focus="showRailTooltip($event, 'Help')"
        @blur="hideRailTooltip"
        @click="ui.toggleHelpModal()"
      >
        <svg
          class="team-rail__help-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8ZM11 16h2v2h-2v-2Zm1-10c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4Z"
          />
        </svg>
      </button>
    </footer>

    <Teleport to="body">
      <div
        v-if="railTooltip"
        class="team-rail__tooltip"
        role="tooltip"
        :style="{ top: `${railTooltip.top}px`, left: `${railTooltip.left}px` }"
      >
        {{ railTooltip.text }}
      </div>
      <div
        v-if="teamActionsOpen"
        ref="teamActionsPopover"
        class="team-rail__popover"
        role="menu"
        aria-label="Team actions"
        :style="{ top: `${teamActionsPosition.top}px`, left: `${teamActionsPosition.left}px` }"
      >
        <button type="button" role="menuitem" @click="openCreateTeam">Create a team</button>
        <button type="button" role="menuitem" @click="openJoinTeam">Join a team</button>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.team-rail {
  position: relative;
  display: flex;
  width: 74px;
  min-width: 74px;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid color-mix(in srgb, var(--color-white) 8%, transparent);
  background: var(--color-indigo-950);
  color: var(--color-white);
}

.team-rail__middle {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  overflow-y: auto;
  padding: 10px 0;
  scrollbar-color: var(--color-slate-400) transparent;
  scrollbar-width: thin;
}

.team-rail__section {
  display: flex;
  width: 100%;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
}

.team-rail__section--teams {
  border-top: 1px solid color-mix(in srgb, var(--color-white) 14%, transparent);
  padding-top: 8px;
}

.team-rail__label {
  margin: 0 0 8px;
  color: var(--color-white);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}

.team-rail__team-list,
.team-rail__icon-list {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 2px 0 6px;
}

.team-rail__team {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: var(--color-indigo-500);
  color: var(--color-white);
  cursor: pointer;
  transition:
    border-radius 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}

.team-rail__team:hover {
  border-radius: 6px;
  transform: scale(1.05);
}

.team-rail__team--active {
  border-radius: 6px;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-white) 55%, transparent);
}

.team-rail__team:focus-visible,
.team-rail__add:focus-visible,
.team-rail__help:focus-visible,
.team-rail__popover button:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 3px;
}

.team-rail__indicator {
  position: absolute;
  top: 50%;
  left: -19px;
  width: 4px;
  height: 0;
  transform: translateY(-50%);
  border-radius: 0 4px 4px 0;
  background: var(--color-white);
  transition: height 150ms ease;
}

.team-rail__team:hover .team-rail__indicator {
  height: 18px;
}

.team-rail__team--active .team-rail__indicator {
  height: 30px;
}

.team-rail__initials {
  font-size: 13px;
  font-weight: 700;
}

.team-rail__add,
.team-rail__help {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: color-mix(in srgb, var(--color-white) 10%, transparent);
  color: var(--color-white);
  cursor: pointer;
}

.team-rail__add {
  font-size: 22px;
  line-height: 1;
}

.team-rail__add--invite {
  position: relative;
  margin-top: 8px;
  padding: 0;
  line-height: 0;
}

.team-rail__invite-icon {
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
}

.team-rail__add:hover,
.team-rail__help:hover,
.team-rail__help--active {
  background: color-mix(in srgb, var(--color-white) 20%, transparent);
}

.team-rail__add:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.team-rail__message {
  max-width: 62px;
  margin: 2px 0;
  padding: 0 3px;
  color: var(--color-slate-300);
  font-size: 9px;
  line-height: 1.3;
  text-align: center;
}

.team-rail__retry {
  border: 0;
  padding: 2px 4px;
  background: transparent;
  color: var(--color-indigo-200);
  cursor: pointer;
  font-size: 9px;
  text-decoration: underline;
}

.team-rail__retry:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 2px;
}

.team-rail__skeleton {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-white) 12%, transparent);
  animation: rail-pulse 1.2s ease-in-out infinite alternate;
}

.team-rail__footer {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0 0 12px;
}

.team-rail__help {
  width: 22px;
  height: 22px;
  background: transparent;
}

.team-rail__help-icon {
  display: block;
  width: 20px;
  height: 20px;
}

.team-rail__user {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
}

.team-rail__popover {
  position: fixed;
  z-index: 45;
  display: flex;
  width: 11rem;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.5rem;
  padding: 0.25rem;
  background: var(--color-white);
  color: var(--color-slate-800);
  box-shadow: 0 0.5rem 1.5rem color-mix(in srgb, var(--color-slate-950) 20%, transparent);
}

.team-rail__tooltip {
  position: fixed;
  z-index: 80;
  transform: translateY(-50%);
  border-radius: 0.35rem;
  padding: 0.4rem 0.75rem;
  background: #555;
  color: var(--color-white);
  box-shadow: 0 2px 8px rgb(0 0 0 / 18%);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25rem;
  white-space: nowrap;
  pointer-events: none;
}

.team-rail__popover button {
  border: 0;
  border-radius: 0.25rem;
  padding: 0.5rem 0.625rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.team-rail__popover button:hover {
  background: var(--color-slate-100);
}

@keyframes rail-pulse {
  to {
    opacity: 0.45;
  }
}
</style>
