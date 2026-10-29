<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const teamsStore = useTeamsStore()
const ui = useUiStore()
const router = useRouter()

const name = ref('')
const initials = ref('')
const isSubmitting = ref(false)
const validationError = ref('')
const serverError = ref('')

function getGeneratedInitials(workspaceName) {
  const words = workspaceName.trim().split(/\s+/)
  const initialsFromWords = words
    .slice(0, 2)
    .map((word) => [...word].find((character) => /\p{L}/u.test(character)) ?? '')
    .join('')
  const letters = [...workspaceName].filter((character) => /\p{L}/u.test(character))
  return (initialsFromWords.length === 2 ? initialsFromWords : letters.slice(0, 2).join(''))
    .toUpperCase()
    .padEnd(2, 'W')
}

function validate() {
  const trimmedName = name.value.trim()
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    validationError.value = 'Workspace name must be 2–50 characters.'
    return null
  }

  const trimmedInitials = initials.value.trim()
  if (trimmedInitials && !/^\p{L}{2}$/u.test(trimmedInitials)) {
    validationError.value = 'Initials must contain exactly two letters.'
    return null
  }

  validationError.value = ''
  return {
    name: trimmedName,
    initials: (trimmedInitials || getGeneratedInitials(trimmedName)).toUpperCase(),
  }
}

async function handleSubmit() {
  serverError.value = ''
  const payload = validate()
  if (!payload) return

  isSubmitting.value = true
  try {
    const workspace = await teamsStore.createWorkspace(payload)
    await router.push(`/app/${encodeURIComponent(workspace.id)}`)
    ui.toggleWorkspaceCreateModal()
    name.value = ''
    initials.value = ''
  } catch (error) {
    serverError.value = error?.message || 'Failed to create workspace. Try again.'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (isSubmitting.value) return
  ui.toggleWorkspaceCreateModal()
  validationError.value = ''
  serverError.value = ''
}

function handleKeydown(event) {
  if (event.key === 'Escape' && ui.workspaceCreateModalOpen) {
    event.preventDefault()
    handleClose()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    v-if="ui.workspaceCreateModalOpen"
    class="workspace-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-workspace-title"
    @click.self="handleClose"
  >
    <form class="workspace-modal" novalidate @submit.prevent="handleSubmit">
      <header class="workspace-modal__header">
        <h2 id="create-workspace-title">Create a workspace</h2>
        <button type="button" aria-label="Close dialog" @click="handleClose">×</button>
      </header>

      <p class="workspace-modal__description">Workspaces keep teams and conversations organized.</p>

      <div v-if="validationError" class="workspace-modal__error" role="alert">
        {{ validationError }}
      </div>
      <div v-if="serverError" class="workspace-modal__error" role="alert">
        {{ serverError }}
      </div>

      <label class="workspace-modal__field" for="workspace-name">
        <span>Name</span>
        <input
          id="workspace-name"
          v-model="name"
          type="text"
          minlength="2"
          maxlength="50"
          autocomplete="off"
          autofocus
          required
        />
      </label>

      <label class="workspace-modal__field" for="workspace-initials">
        <span>Initials <span class="workspace-modal__optional">(optional)</span></span>
        <input
          id="workspace-initials"
          v-model="initials"
          type="text"
          maxlength="2"
          autocomplete="off"
          aria-describedby="workspace-initials-hint"
        />
        <span id="workspace-initials-hint" class="workspace-modal__hint">
          Leave empty to generate initials from the workspace name.
        </span>
      </label>

      <footer class="workspace-modal__actions">
        <button
          type="button"
          class="workspace-modal__secondary"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          Cancel
        </button>
        <button type="submit" class="workspace-modal__primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating…' : 'Create workspace' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.workspace-modal-backdrop {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, var(--color-slate-950) 65%, transparent);
}

.workspace-modal {
  display: flex;
  width: min(100%, 28rem);
  flex-direction: column;
  gap: 1rem;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: var(--color-white);
  color: var(--color-slate-900);
  box-shadow: 0 1.25rem 3rem color-mix(in srgb, var(--color-slate-950) 25%, transparent);
}

.workspace-modal__header,
.workspace-modal__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.workspace-modal__header h2 {
  margin: 0;
  font-size: 1.125rem;
}

.workspace-modal__header button {
  border: 0;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1.5rem;
}

.workspace-modal__description,
.workspace-modal__hint {
  margin: 0;
  color: var(--color-slate-600);
  font-size: 0.875rem;
}

.workspace-modal__field {
  display: grid;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.workspace-modal__field input {
  width: 100%;
  border: 1px solid var(--color-slate-400);
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-slate-900);
}

.workspace-modal__field input:focus-visible,
.workspace-modal button:focus-visible {
  outline: 2px solid var(--color-indigo-600);
  outline-offset: 2px;
}

.workspace-modal__optional,
.workspace-modal__hint {
  font-weight: 400;
}

.workspace-modal__error {
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-red-100);
  color: var(--color-red-800);
  font-size: 0.875rem;
}

.workspace-modal__actions {
  justify-content: flex-end;
}

.workspace-modal__actions button {
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
  padding: 0.625rem 0.875rem;
  cursor: pointer;
}

.workspace-modal__secondary {
  background: var(--color-white);
  color: var(--color-slate-700);
}

.workspace-modal__primary {
  border-color: var(--color-indigo-600) !important;
  background: var(--color-indigo-600);
  color: var(--color-white);
}

.workspace-modal button:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
