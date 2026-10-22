<script setup>
import { ref } from 'vue'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const teamsStore = useTeamsStore()
const ui = useUiStore()

const teamName = ref('')
const selectedColor = ref('#7C3AED')
const isSubmitting = ref(false)
const errorMessage = ref('')

const presetColors = [
  '#7C3AED',
  '#2DD4BF',
  '#F97316',
  '#EC4899',
  '#3B82F6',
  '#10B981',
]

async function handleSubmit() {
  if (!teamName.value.trim()) {
    errorMessage.value = 'Please enter a workspace name.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await teamsStore.createTeam({
      name: teamName.value.trim(),
      color: selectedColor.value,
    })
    teamName.value = ''
    ui.toggleTeamCreateModal()
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to create workspace. Try again.'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (isSubmitting.value) return
  ui.toggleTeamCreateModal()
}
</script>

<template>
  <div
    v-if="ui.teamCreateModalOpen"
    class="modal-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-team-title"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="create-team-title" class="modal-title">Create a new Workspace</h3>
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

      <form @submit.prevent="handleSubmit" class="modal-body">
        <p class="modal-desc">
          Workspaces are shared spaces where teams communicate in channels and direct messages.
        </p>

        <div v-if="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <div class="form-group">
          <label for="team-name" class="form-label">Workspace Name</label>
          <input
            id="team-name"
            v-model="teamName"
            type="text"
            class="form-input"
            placeholder="e.g. Acme Corp or Engineering"
            maxlength="40"
            autofocus
            required
          />
        </div>

        <div class="form-group">
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
          <button
            type="button"
            class="btn-secondary"
            :disabled="isSubmitting"
            @click="handleClose"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting">Creating...</span>
            <span v-else>Create Workspace</span>
          </button>
        </div>
      </form>
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
  max-width: 440px;
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
  line-height: 1.4;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
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
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;
}
.form-input:focus {
  border-color: #7c3aed;
  background: rgba(255, 255, 255, 0.08);
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
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.color-swatch:hover {
  transform: scale(1.15);
}
.color-swatch--active {
  border-color: #ffffff;
  transform: scale(1.15);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.btn-primary {
  background: #7c3aed;
  border: none;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) {
  background: #6d28d9;
}
.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
