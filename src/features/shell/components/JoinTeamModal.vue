<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import { USE_SHELL_MOCKS } from '@/features/shell/api/config'

const teamsStore = useTeamsStore()
const ui = useUiStore()
const router = useRouter()

const inviteInput = ref('')
const isSubmitting = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
let closeTimer

function getInviteCode(value) {
  const trimmedValue = value.trim()
  try {
    const url = new URL(trimmedValue)
    const segments = url.pathname.split('/').filter(Boolean)
    return decodeURIComponent(segments.at(-1) ?? '').trim()
  } catch {
    return trimmedValue
  }
}

async function handleSubmit() {
  const inviteCode = getInviteCode(inviteInput.value)
  statusMessage.value = ''
  errorMessage.value = ''
  if (!inviteCode) {
    errorMessage.value = 'Enter an invite code or invite link.'
    return
  }

  isSubmitting.value = true
  try {
    const result = await teamsStore.joinTeam(inviteCode)
    await router.push({
      name: 'workspace-team',
      params: {
        workspaceId: result.team.workspaceId,
        teamId: result.team.id,
      },
    })
    statusMessage.value = result.alreadyMember
      ? `You are already a member of ${result.team.name}.`
      : `Joined ${result.team.name}.`
    closeTimer = setTimeout(handleClose, 900)
  } catch (error) {
    errorMessage.value = error?.message || 'Could not join this team. Try again.'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (isSubmitting.value) return
  if (closeTimer) clearTimeout(closeTimer)
  ui.toggleTeamJoinModal()
  inviteInput.value = ''
  statusMessage.value = ''
  errorMessage.value = ''
}

function handleKeydown(event) {
  if (event.key === 'Escape' && ui.teamJoinModalOpen) {
    event.preventDefault()
    handleClose()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <div
    v-if="ui.teamJoinModalOpen"
    class="join-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="join-team-title"
    @click.self="handleClose"
  >
    <form class="join-modal" @submit.prevent="handleSubmit">
      <header class="join-modal__header">
        <h2 id="join-team-title">Join a Team</h2>
        <button
          type="button"
          aria-label="Close dialog"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          ×
        </button>
      </header>

      <p class="join-modal__description">Enter the invite code or paste the team invite link.</p>
      <p v-if="!USE_SHELL_MOCKS" class="join-modal__notice" role="status">
        Team joining is not available on the backend yet; this action uses local mock data.
      </p>

      <div v-if="statusMessage" class="join-modal__success" role="status" aria-live="polite">
        {{ statusMessage }}
      </div>
      <div v-if="errorMessage" class="join-modal__error" role="alert">
        {{ errorMessage }}
      </div>

      <label class="join-modal__field" for="team-invite-code">
        <span>Invite code or link</span>
        <input
          id="team-invite-code"
          v-model="inviteInput"
          type="text"
          autocomplete="off"
          autofocus
          :disabled="isSubmitting"
          placeholder="Paste an invite code or link"
        />
      </label>

      <footer class="join-modal__actions">
        <button
          type="button"
          class="join-modal__secondary"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          Cancel
        </button>
        <button type="submit" class="join-modal__primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Joining...' : 'Join' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.join-modal-backdrop {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, var(--color-slate-950) 65%, transparent);
}

.join-modal {
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

.join-modal__header,
.join-modal__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.join-modal__header h2 {
  margin: 0;
  font-size: 1.125rem;
}

.join-modal__header button {
  border: 0;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1.5rem;
}

.join-modal__description {
  margin: 0;
  color: var(--color-slate-600);
  font-size: 0.875rem;
}

.join-modal__notice {
  margin: 0;
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-amber-100);
  color: var(--color-amber-900);
  font-size: 0.8125rem;
}

.join-modal__field {
  display: grid;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.join-modal__field input {
  width: 100%;
  border: 1px solid var(--color-slate-400);
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-slate-900);
}

.join-modal__field input:focus-visible,
.join-modal button:focus-visible {
  outline: 2px solid var(--color-indigo-600);
  outline-offset: 2px;
}

.join-modal__success,
.join-modal__error {
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
}

.join-modal__success {
  background: var(--color-emerald-100);
  color: var(--color-emerald-800);
}

.join-modal__error {
  background: var(--color-red-100);
  color: var(--color-red-800);
}

.join-modal__actions {
  justify-content: flex-end;
}

.join-modal__actions button {
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
  padding: 0.625rem 0.875rem;
  cursor: pointer;
}

.join-modal__secondary {
  background: var(--color-white);
  color: var(--color-slate-700);
}

.join-modal__primary {
  border-color: var(--color-indigo-600) !important;
  background: var(--color-indigo-600);
  color: var(--color-white);
}

.join-modal button:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
