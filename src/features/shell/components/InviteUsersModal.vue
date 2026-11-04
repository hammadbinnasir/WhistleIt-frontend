<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { sendInvitation } from '@/features/auth/api'

const emit = defineEmits(['close'])
const email = ref('')
const notice = ref('')
const error = ref('')
const isSending = ref(false)

function handleClose() {
  if (!isSending.value) emit('close')
}

function handleKeydown(event) {
  if (event.key === 'Escape' && !isSending.value) {
    event.preventDefault()
    emit('close')
  }
}

async function sendInvite() {
  const inviteEmail = email.value.trim()
  if (!inviteEmail) return

  isSending.value = true
  notice.value = ''
  error.value = ''
  try {
    await sendInvitation(inviteEmail)
    notice.value = `Invitation sent to ${inviteEmail}.`
    email.value = ''
  } catch (requestError) {
    error.value = requestError?.message || 'Could not send the invitation. Please try again.'
  } finally {
    isSending.value = false
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    class="shell-modal-backdrop flex items-center justify-center overflow-y-auto p-4 text-slate-900"
    role="dialog"
    aria-modal="true"
    aria-labelledby="invite-people-title"
    @click.self="handleClose"
  >
    <section
      class="shell-surface my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl p-6 sm:p-8"
    >
      <header class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 id="invite-people-title" class="text-xl font-semibold text-slate-900">
            Invite people to your company
          </h2>
          <p class="mt-2 text-sm leading-5 text-slate-600">
            Send a secure invitation link to a colleague’s email.
          </p>
        </div>
        <button
          type="button"
          class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Close invite people dialog"
          :disabled="isSending"
          @click="handleClose"
        >
          ×
        </button>
      </header>

      <form class="space-y-4" @submit.prevent="sendInvite">
        <div>
          <label for="invite-email" class="mb-2 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="invite-email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="name@company.com"
            required
            class="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <p v-if="notice" class="text-sm text-emerald-700" role="status">{{ notice }}</p>
        <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>

        <button
          type="submit"
          :disabled="isSending"
          class="shell-primary-button w-full px-4 py-3 text-sm transition focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-wait disabled:opacity-60"
        >
          {{ isSending ? 'Sending invitation...' : 'Send invitation' }}
        </button>
      </form>
    </section>
  </div>
</template>
