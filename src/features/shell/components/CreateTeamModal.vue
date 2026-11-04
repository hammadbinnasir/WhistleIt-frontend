<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import { USE_SHELL_MOCKS } from '@/features/shell/api/config'

const teamsStore = useTeamsStore()
const ui = useUiStore()
const router = useRouter()

const teamName = ref('')
const selectedColor = ref('#7C3AED')
const isSubmitting = ref(false)
const errorMessage = ref('')

const presetColors = ['#7C3AED', '#2DD4BF', '#F97316', '#EC4899', '#3B82F6', '#10B981']

async function handleSubmit() {
  const name = teamName.value.trim()
  if (!name) {
    errorMessage.value = 'Please enter a team name.'
    return
  }
  if (!/^[\p{L}\s]+$/u.test(name)) {
    errorMessage.value = 'Team names may only contain letters and spaces.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const team = await teamsStore.createTeam({
      name,
      color: selectedColor.value,
    })
    teamName.value = ''
    ui.toggleTeamCreateModal()
    if (teamsStore.activeWorkspaceId) {
      await router.push({
        name: 'workspace-team',
        params: { workspaceId: teamsStore.activeWorkspaceId, teamId: team.id },
      })
    }
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to create team. Try again.'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (isSubmitting.value) return
  ui.toggleTeamCreateModal()
}

function handleKeydown(event) {
  if (event.key === 'Escape' && ui.teamCreateModalOpen) {
    event.preventDefault()
    handleClose()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    v-if="ui.teamCreateModalOpen && teamsStore.isAdmin"
    class="modal-backdrop shell-modal-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-team-title"
  >
    <div class="modal-card shell-surface">
      <div class="modal-header">
        <h3 id="create-team-title" class="modal-title">Create a new team</h3>
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

      <form @submit.prevent="handleSubmit" class="modal-body">
        <p class="modal-desc">
          Teams belong to the active workspace and have their own channels and members.
        </p>

        <div v-if="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <div class="form-group">
          <label for="team-name" class="form-label">Team Name</label>
          <input
            id="team-name"
            v-model="teamName"
            type="text"
            class="form-input shell-input"
            placeholder="e.g. Frontend or Design"
            maxlength="40"
            autofocus
            required
          />
        </div>

        <div v-if="USE_SHELL_MOCKS" class="form-group">
          <label class="form-label">Theme Color</label>
          <div class="color-palette">
            <button
              v-for="color in presetColors"
              :key="color"
              type="button"
              class="color-swatch"
              :class="{ 'color-swatch--active': selectedColor === color }"
              :style="{ background: color }"
              :aria-label="`Color ${color}`"
              @click="selectedColor = color"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" :disabled="isSubmitting" @click="handleClose">
            Cancel
          </button>
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            <span v-if="isSubmitting">Creating...</span>
            <span v-else>Create Team</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  z-index: var(--shell-z-modal);
}

.modal-card {
  width: 100%;
  max-width: 440px;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
}

.modal-desc {
  font-size: 13px;
  color: var(--color-slate-600);
  margin: 0;
  line-height: 1.4;
}

.error-banner {
  background: var(--color-red-50);
  border: 1px solid var(--color-red-200);
  color: var(--color-red-800);
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-slate-700);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-input {
  background: var(--color-white);
  border: 1px solid var(--color-slate-300);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--color-slate-900);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;
}
.form-input:focus {
  border-color: var(--color-indigo-600);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-indigo-600) 16%, transparent);
}

.color-palette {
  display: flex;
  gap: 10px;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}
.color-swatch:hover {
  transform: scale(1.15);
}
.color-swatch--active {
  border-color: var(--color-indigo-600);
  transform: scale(1.15);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.btn-secondary {
  background: var(--color-white);
  border: 1px solid var(--color-slate-300);
  color: var(--color-slate-800);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-secondary:hover:not(:disabled) {
  background: var(--color-slate-50);
}

.btn-primary {
  background: var(--color-indigo-600);
  border: none;
  color: var(--color-white);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-indigo-700);
}
.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn:focus-visible,
.color-swatch:focus-visible,
.btn-primary:focus-visible,
.btn-secondary:focus-visible {
  outline: 2px solid var(--color-indigo-400);
  outline-offset: 2px;
}
</style>
