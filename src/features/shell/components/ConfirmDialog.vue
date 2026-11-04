<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  variant: { type: String, default: 'default' },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel'])
const dialog = ref(null)
const cancelButton = ref(null)
let opener = null

function getFocusableElements() {
  return [
    ...(dialog.value?.querySelectorAll(
      'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? []),
  ]
}

function handleKeydown(event) {
  if (event.key === 'Escape' && !props.loading) {
    event.preventDefault()
    emit('cancel')
    return
  }
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (!focusable.length) {
    event.preventDefault()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(async () => {
  opener = document.activeElement
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  cancelButton.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  opener?.focus?.()
})
</script>

<template>
  <div
    v-if="isOpen"
    class="shell-modal-backdrop shell-confirm-backdrop"
    @click.self="!loading && emit('cancel')"
  >
    <section
      ref="dialog"
      class="shell-surface shell-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      :aria-busy="loading"
    >
      <h2 id="confirm-dialog-title" class="shell-confirm-title">{{ title }}</h2>
      <p id="confirm-dialog-message" class="shell-confirm-message">{{ message }}</p>
      <p v-if="errorMessage" class="shell-error-message" role="alert">{{ errorMessage }}</p>
      <div class="shell-confirm-actions">
        <button
          ref="cancelButton"
          type="button"
          class="shell-secondary-button"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          :class="variant === 'danger' ? 'shell-danger-button' : 'shell-primary-button'"
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ loading ? 'Working…' : confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.shell-confirm-backdrop {
  z-index: var(--shell-z-confirm);
}

.shell-confirm-dialog {
  width: min(100%, 28rem);
  padding: 1.5rem;
}

.shell-confirm-title {
  margin: 0;
  color: var(--color-slate-900);
  font-size: 1.125rem;
  font-weight: 700;
}

.shell-confirm-message {
  margin: 0.75rem 0 1rem;
  color: var(--color-slate-700);
  line-height: 1.5;
}

.shell-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 1.25rem;
}
</style>
