<script setup>
import { computed, ref } from 'vue'
import { useRemindersStore } from './reminders'

const props = defineProps({
  message: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const reminders = useRemindersStore()
const defaultTime = new Date(Date.now() + 60 * 60 * 1000)
const localDateTime = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60 * 1000)
const remindAt = ref(localDateTime.toISOString().slice(0, 16))
const note = ref('')
const error = ref('')
const messagePreview = computed(() => props.message.text || 'Message')

function save() {
  const selectedTime = new Date(remindAt.value)
  if (!remindAt.value || Number.isNaN(selectedTime.getTime()) || selectedTime <= new Date()) {
    error.value = 'Choose a reminder time in the future.'
    return
  }
  reminders.addReminder(props.message, selectedTime.toISOString(), note.value.trim())
  emit('close')
}
</script>

<template>
  <div class="reminder-modal__backdrop" @click.self="emit('close')">
    <section
      class="reminder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-title"
    >
      <header class="reminder-modal__header">
        <h2 id="reminder-title">Set a reminder</h2>
        <button type="button" aria-label="Close" @click="emit('close')">×</button>
      </header>
      <p class="reminder-modal__conversation">
        {{ message.conversationType === 'channel' ? '#' : '' }}{{ message.conversationName }}
      </p>
      <blockquote>{{ messagePreview }}</blockquote>
      <label class="reminder-modal__label" for="reminder-time">Remind me</label>
      <input id="reminder-time" v-model="remindAt" type="datetime-local" />
      <label class="reminder-modal__label" for="reminder-note">Add a note (optional)</label>
      <textarea id="reminder-note" v-model="note" rows="2" placeholder="What should you remember?" />
      <p v-if="error" class="reminder-modal__error" role="alert">{{ error }}</p>
      <footer>
        <button class="reminder-modal__cancel" type="button" @click="emit('close')">Cancel</button>
        <button class="reminder-modal__save" type="button" @click="save">Save reminder</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.reminder-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(22 23 37 / 45%);
}
.reminder-modal {
  width: min(100%, 480px);
  padding: 22px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 55px rgb(18 20 40 / 24%);
}
.reminder-modal__header,
.reminder-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.reminder-modal__header h2 {
  margin: 0;
  color: #33334a;
  font-size: 21px;
}
.reminder-modal__header button {
  border: 0;
  background: transparent;
  color: #777;
  font-size: 26px;
  cursor: pointer;
}
.reminder-modal__conversation {
  margin: 18px 0 8px;
  color: #5b5cff;
  font-weight: 600;
}
.reminder-modal blockquote {
  margin: 0 0 18px;
  padding: 12px;
  border-left: 3px solid #5b5cff;
  background: #f7f7fb;
  color: #555;
}
.reminder-modal__label {
  display: block;
  margin: 14px 0 6px;
  color: #555;
  font-size: 14px;
  font-weight: 600;
}
.reminder-modal input,
.reminder-modal textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  border: 1px solid #d4d4dc;
  border-radius: 6px;
  color: #28283a;
  font: inherit;
}
.reminder-modal input:focus,
.reminder-modal textarea:focus {
  outline: 2px solid #5b5cff;
  outline-offset: 1px;
}
.reminder-modal__error {
  color: #c73546;
  font-size: 13px;
}
.reminder-modal footer {
  justify-content: flex-end;
  margin-top: 20px;
}
.reminder-modal footer button {
  padding: 9px 14px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.reminder-modal__cancel {
  background: #f1f1f5;
  color: #444;
}
.reminder-modal__save {
  background: #5b5cff;
  color: #fff;
  font-weight: 600;
}
</style>
