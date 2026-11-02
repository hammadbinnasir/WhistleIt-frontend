<script setup>
import { ref, watch } from 'vue'
import { useTeamsStore } from '@/stores/teams'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  team: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const teamsStore = useTeamsStore()
const name = ref('')
const description = ref('')
const submitting = ref(false)
const errorMessage = ref('')

watch(
  () => [props.isOpen, props.team],
  ([isOpen, team]) => {
    if (!isOpen || !team) return
    name.value = team.name
    description.value = team.description ?? ''
    errorMessage.value = ''
  },
  { immediate: true },
)

async function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    errorMessage.value = 'Enter a team name.'
    return
  }
  if (!/^[\p{L}\s]+$/u.test(trimmedName)) {
    errorMessage.value = 'Team names may only contain letters and spaces.'
    return
  }
  if (trimmedName.length > 40) {
    errorMessage.value = 'Team names must be 40 characters or fewer.'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    await teamsStore.updateTeam(props.team.id, {
      name: trimmedName,
      description: description.value.trim(),
    })
    emit('close')
  } catch (error) {
    errorMessage.value = error?.message || 'Could not update the team.'
  } finally {
    submitting.value = false
  }
}

function close() {
  if (!submitting.value) emit('close')
}
</script>

<template>
  <div
    v-if="isOpen"
    class="edit-team-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-team-title"
    @click.self="close"
    @keydown.esc.prevent="close"
  >
    <form class="edit-team-card" @submit.prevent="submit">
      <h2 id="edit-team-title">Edit team</h2>
      <div v-if="errorMessage" class="edit-team-error" role="alert">{{ errorMessage }}</div>
      <label for="edit-team-name">Team name</label>
      <input id="edit-team-name" v-model="name" maxlength="40" required />
      <label for="edit-team-description">Description</label>
      <textarea id="edit-team-description" v-model="description" rows="3" />
      <div class="edit-team-actions">
        <button type="button" :disabled="submitting" @click="close">Cancel</button>
        <button type="submit" :disabled="submitting">
          {{ submitting ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-team-backdrop {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, var(--color-slate-950) 65%, transparent);
}

.edit-team-card {
  display: flex;
  width: min(28rem, 100%);
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: var(--color-white);
  color: var(--color-slate-900);
  box-shadow: 0 1rem 2rem color-mix(in srgb, var(--color-slate-950) 20%, transparent);
}

.edit-team-card h2 {
  margin: 0;
  font-size: 1.125rem;
}

.edit-team-card label {
  font-size: 0.875rem;
  font-weight: 600;
}

.edit-team-card input,
.edit-team-card textarea {
  width: 100%;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
  padding: 0.5rem;
  color: var(--color-slate-900);
}

.edit-team-card input:focus-visible,
.edit-team-card textarea:focus-visible,
.edit-team-card button:focus-visible {
  outline: 2px solid var(--color-indigo-500);
  outline-offset: 2px;
}

.edit-team-error {
  color: var(--color-red-700);
  font-size: 0.875rem;
}

.edit-team-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.edit-team-actions button {
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-white);
  color: var(--color-slate-800);
  cursor: pointer;
}

.edit-team-actions button[type='submit'] {
  border-color: var(--color-indigo-600);
  background: var(--color-indigo-600);
  color: var(--color-white);
}

.edit-team-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
