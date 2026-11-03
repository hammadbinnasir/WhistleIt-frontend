<script setup>
import { ref } from 'vue'
import BaseModal from '@/features/account/components/BaseModal.vue'

const emit = defineEmits(['close', 'confirm'])
const scheduleDelete = ref(false)
const scheduledAt = ref('')
const minimumDateTime = ref('')

function localDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function updateMinimumDateTime() {
  minimumDateTime.value = localDateTimeValue(new Date(Date.now() + 60_000))
}

function confirm() {
  if (!scheduleDelete.value) {
    emit('confirm', null)
    return
  }

  const date = new Date(scheduledAt.value)
  if (!scheduledAt.value || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return
  emit('confirm', date.toISOString())
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form
      class="delete-message-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-message-title"
      @submit.prevent="confirm"
    >
      <button
        class="delete-message-dialog__close"
        type="button"
        aria-label="Close"
        @click="emit('close')"
      >
        ×
      </button>
      <h2 id="delete-message-title">Delete Message</h2>
      <p>Are you sure you want to delete this message?</p>

      <label class="delete-message-dialog__schedule">
        <input
          v-model="scheduleDelete"
          type="checkbox"
          @change="scheduleDelete && updateMinimumDateTime()"
        />
        <span>Schedule Delete</span>
      </label>

      <label v-if="scheduleDelete" class="delete-message-dialog__datetime" for="delete-at">
        <span>Delete on</span>
        <input
          id="delete-at"
          v-model="scheduledAt"
          type="datetime-local"
          :min="minimumDateTime"
          required
        />
      </label>

      <footer>
        <button type="button" class="delete-message-dialog__cancel" @click="emit('close')">
          Cancel
        </button>
        <button
          type="submit"
          class="delete-message-dialog__confirm"
          :disabled="scheduleDelete && !scheduledAt"
        >
          Delete
        </button>
      </footer>
    </form>
  </BaseModal>
</template>

<style scoped>
.delete-message-dialog {
  position: relative;
  width: min(500px, 100%);
  box-sizing: border-box;
  padding: 28px 24px 20px;
  border-radius: 6px;
  background: #fff;
  color: #252536;
  box-shadow: 0 8px 32px rgb(0 0 0 / 22%);
}

.delete-message-dialog h2 {
  margin: 0;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
}

.delete-message-dialog p {
  margin: 28px 0 22px;
  color: #555565;
  font-size: 14px;
}

.delete-message-dialog__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: #f0f0f5;
  color: #303044;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.delete-message-dialog__schedule {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
  font-size: 14px;
  cursor: pointer;
}

.delete-message-dialog__schedule input {
  width: 18px;
  height: 18px;
  accent-color: #fa3857;
}

.delete-message-dialog__datetime {
  display: grid;
  gap: 7px;
  margin-top: 16px;
  color: #555565;
  font-size: 13px;
}

.delete-message-dialog__datetime input {
  width: 100%;
  min-height: 40px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #c9cbd9;
  border-radius: 4px;
  color: inherit;
  font: inherit;
}

.delete-message-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin: 30px -24px -20px;
  padding: 16px 24px 20px;
  border-top: 1px solid #e4e4e9;
}

.delete-message-dialog footer button {
  min-width: 90px;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 3px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
}

.delete-message-dialog__cancel {
  background: transparent;
  color: #454557;
}

.delete-message-dialog__confirm {
  background: #fa3857;
  color: #fff;
}

.delete-message-dialog__confirm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>