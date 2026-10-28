<script setup>
import { storeToRefs } from 'pinia'
import { useTeamsStore } from '@/stores/teams'

const emit = defineEmits(['select'])
const teamsStore = useTeamsStore()
const { workspaces, activeWorkspaceId } = storeToRefs(teamsStore)

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
</script>

<template>
  <div class="workspace-switcher" aria-label="Workspaces">
    <button
      v-for="workspace in workspaces"
      :key="workspace.id"
      type="button"
      class="workspace-switcher__button"
      :class="{ 'workspace-switcher__button--active': activeWorkspaceId === workspace.id }"
      :title="workspace.name"
      :aria-label="`Switch to workspace ${workspace.name}`"
      :aria-current="activeWorkspaceId === workspace.id ? 'page' : undefined"
      @click="emit('select', workspace.id)"
    >
      {{ workspace.initials || getInitials(workspace.name) }}
    </button>
  </div>
</template>

<style scoped>
.workspace-switcher {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  max-height: clamp(56px, 28vh, 224px);
  overflow-y: auto;
  padding: 2px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-slate-400) transparent;
}

.workspace-switcher__button {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: var(--color-orange-500);
  color: var(--color-white);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition:
    border-radius 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}

.workspace-switcher__button:hover,
.workspace-switcher__button--active {
  border-radius: 7px;
  transform: scale(1.05);
  box-shadow: 0 0 0 2px var(--color-white);
}

.workspace-switcher__button:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 3px;
}
</style>
