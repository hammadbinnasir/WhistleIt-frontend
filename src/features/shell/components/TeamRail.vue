<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

const router = useRouter()
const teamsStore = useTeamsStore()
const ui = useUiStore()
const { activeWorkspaceId, activeTeamId, teamsOfActiveWorkspace, loading, error } =
  storeToRefs(teamsStore)

onMounted(() => {
  void teamsStore.fetchTeams()
})

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
</script>

<template>
  <aside class="team-rail" role="navigation" aria-label="Workspace and team navigation">
    <section class="team-rail__workspaces" aria-labelledby="workspace-heading">
      <h2 id="workspace-heading" class="team-rail__label">Workspace</h2>
      <div
        v-if="loading && !teamsStore.workspaces.length"
        class="team-rail__loading"
        aria-label="Loading workspaces"
      >
        <span v-for="item in 2" :key="item" class="team-rail__skeleton" />
      </div>
      <WorkspaceSwitcher v-else @select="handleWorkspaceSelect" />
      <p v-if="!loading && !error && !teamsStore.workspaces.length" class="team-rail__empty">
        None yet
      </p>
    </section>

    <section class="team-rail__teams" aria-labelledby="teams-heading">
      <h2 id="teams-heading" class="team-rail__label">Teams</h2>
      <p v-if="error" class="team-rail__message" role="alert">{{ error }}</p>
      <p
        v-else-if="!loading && !teamsStore.workspaces.length"
        class="team-rail__message"
        role="status"
      >
        No workspaces
      </p>
      <p
        v-else-if="!loading && activeWorkspaceId && !teamsOfActiveWorkspace.length"
        class="team-rail__message"
        role="status"
      >
        No teams yet
      </p>

      <div class="team-rail__team-list" aria-label="Teams in the active workspace">
        <template v-if="loading && !teamsOfActiveWorkspace.length">
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

      <div class="team-rail__team-actions" aria-label="Team actions">
        <button
          type="button"
          class="team-rail__action"
          title="Create a team in this workspace"
          aria-label="Create a team"
          :disabled="!activeWorkspaceId"
          @click="ui.toggleTeamCreateModal()"
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          class="team-rail__action"
          title="Join a team"
          aria-label="Join a team"
          :disabled="!activeWorkspaceId"
          @click="ui.toggleTeamJoinModal()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5M10.5 7v7M7 10.5h7" />
          </svg>
        </button>
      </div>
    </section>

    <button
      type="button"
      class="team-rail__help"
      :class="{ 'team-rail__help--active': ui.helpModalOpen }"
      title="Help"
      aria-label="Open help"
      @click="ui.toggleHelpModal()"
    >
      ?
    </button>
  </aside>
</template>

<style scoped>
.team-rail {
  position: relative;
  display: flex;
  width: 74px;
  min-width: 74px;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  border-right: 1px solid color-mix(in srgb, var(--color-white) 8%, transparent);
  background: var(--color-indigo-950);
  color: var(--color-white);
  padding: 10px 0 62px;
}

.team-rail__workspaces,
.team-rail__teams {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
}

.team-rail__workspaces {
  flex: 0 0 auto;
}

.team-rail__teams {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
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
.team-rail__loading {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  overflow-y: auto;
  padding: 2px 0 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-slate-400) transparent;
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
.team-rail__action:focus-visible,
.team-rail__help:focus-visible {
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

.team-rail__team-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  padding: 4px 0 2px;
}

.team-rail__action,
.team-rail__help {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: color-mix(in srgb, var(--color-white) 10%, transparent);
  color: var(--color-white);
  cursor: pointer;
}

.team-rail__action {
  font-size: 22px;
  line-height: 1;
}

.team-rail__action svg {
  width: 16px;
  height: 16px;
}

.team-rail__action:hover,
.team-rail__help:hover,
.team-rail__help--active {
  background: color-mix(in srgb, var(--color-white) 20%, transparent);
}

.team-rail__action:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.team-rail__help {
  position: absolute;
  bottom: 60px;
  left: 22px;
  border: 1px solid color-mix(in srgb, var(--color-white) 50%, transparent);
  border-radius: 50%;
  font-size: 16px;
  font-weight: 700;
}

.team-rail__message,
.team-rail__empty {
  max-width: 62px;
  margin: 2px 0;
  color: var(--color-slate-300);
  font-size: 9px;
  line-height: 1.3;
  text-align: center;
}

.team-rail__message {
  padding: 0 3px;
}

.team-rail__skeleton {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-white) 12%, transparent);
  animation: rail-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes rail-pulse {
  to {
    opacity: 0.45;
  }
}
</style>
