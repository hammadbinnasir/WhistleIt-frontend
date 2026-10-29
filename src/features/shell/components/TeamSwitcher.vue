<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])
const teamsStore = useTeamsStore()
const ui = useUiStore()
const router = useRouter()
const root = ref(null)
const searchInput = ref(null)
const { teamsOfActiveWorkspace, activeTeamId, activeWorkspaceId } = storeToRefs(teamsStore)
const searchFilter = ref('')

const filteredTeams = computed(() => {
  const query = searchFilter.value.trim().toLowerCase()
  if (!query) return teamsOfActiveWorkspace.value
  return teamsOfActiveWorkspace.value.filter((team) => team.name.toLowerCase().includes(query))
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

function handleOutsidePointer(event) {
  const wrapper = root.value?.parentElement
  if (props.isOpen && wrapper && !wrapper.contains(event.target)) emit('close')
}

function handleKeydown(event) {
  if (event.key === 'Escape' && props.isOpen) {
    event.preventDefault()
    emit('close')
    root.value?.parentElement?.querySelector('button')?.focus()
  }
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) nextTick(() => searchInput.value?.focus())
    else searchFilter.value = ''
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="isOpen" ref="root" class="team-switcher">
    <div class="team-switcher__search">
      <label class="team-switcher__search-label" for="team-switcher-search">Search teams</label>
      <input id="team-switcher-search" ref="searchInput" v-model="searchFilter" type="search" />
    </div>

    <div class="team-switcher__list">
      <p v-if="!filteredTeams.length" class="team-switcher__empty">No teams found</p>
      <button
        v-for="team in filteredTeams"
        :key="team.id"
        type="button"
        class="team-switcher__team"
        :class="{ 'team-switcher__team--active': activeTeamId === team.id }"
        :aria-current="activeTeamId === team.id ? 'page' : undefined"
        @click="handleSelect(team.id)"
      >
        <span
          class="team-switcher__badge"
          :style="{ background: team.color || 'var(--color-indigo-500)' }"
        >
          {{ team.initials || team.name.slice(0, 2).toUpperCase() }}
        </span>
        <span class="team-switcher__name">{{ team.name }}</span>
        <span v-if="activeTeamId === team.id" aria-hidden="true">✓</span>
      </button>
    </div>

    <div class="team-switcher__actions">
      <button type="button" @click="closeAndRun(ui.toggleTeamCreateModal)">Create a team</button>
      <button type="button" @click="closeAndRun(ui.toggleTeamJoinModal)">Join a Team</button>
      <button type="button" @click="closeAndRun(ui.toggleMemberManageModal)">Manage Members</button>
    </div>
  </div>
</template>

<style scoped>
.team-switcher {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.5rem);
  left: 0;
  display: flex;
  width: min(15rem, calc(100vw - 6rem));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.5rem;
  background: var(--color-white);
  color: var(--color-slate-800);
  box-shadow: 0 0.75rem 1.75rem color-mix(in srgb, var(--color-slate-950) 20%, transparent);
}

.team-switcher__search {
  display: grid;
  gap: 0.375rem;
  border-bottom: 1px solid var(--color-slate-200);
  padding: 0.625rem;
}

.team-switcher__search-label {
  color: var(--color-slate-600);
  font-size: 0.75rem;
  font-weight: 600;
}

.team-switcher__search input {
  width: 100%;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  color: var(--color-slate-900);
}

.team-switcher__search input:focus-visible,
.team-switcher button:focus-visible {
  outline: 2px solid var(--color-indigo-500);
  outline-offset: -2px;
}

.team-switcher__list {
  display: flex;
  max-height: 13.75rem;
  flex-direction: column;
  gap: 0.125rem;
  overflow-y: auto;
  padding: 0.25rem;
}

.team-switcher__team {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.625rem;
  border: 0;
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.team-switcher__team:hover,
.team-switcher__team--active {
  background: var(--color-indigo-50);
}

.team-switcher__badge {
  display: grid;
  width: 1.625rem;
  height: 1.625rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.375rem;
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

.team-switcher__empty {
  margin: 0;
  padding: 0.75rem;
  color: var(--color-slate-600);
  text-align: center;
}

.team-switcher__actions {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  border-top: 1px solid var(--color-slate-200);
  padding: 0.25rem;
}

.team-switcher__actions button {
  border: 0;
  border-radius: 0.375rem;
  padding: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.team-switcher__actions button:hover {
  background: var(--color-slate-100);
}
</style>
