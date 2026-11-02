<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRemindersStore } from './reminders'

const props = defineProps({
  message: { type: Object, required: true },
})
const emit = defineEmits(['close', 'saved'])
const store = useRemindersStore()

function localDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localTimeValue(date) {
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

const initialDateTime = new Date(Date.now() + 20 * 60_000)
const date = ref(localDateValue(initialDateTime))
const time = ref(localTimeValue(initialDateTime))
const title = ref('')
const today = localDateValue(new Date())
const remindAt = computed(() =>
  date.value && time.value ? new Date(`${date.value}T${time.value}`).getTime() : NaN,
)
const valid = computed(() => Number.isFinite(remindAt.value) && remindAt.value > Date.now())

function save() {
  if (!valid.value) return
  store.add({
    ...props.message,
    title: title.value.trim(),
    remindAt: new Date(remindAt.value).toISOString(),
  })
  emit('saved')
  emit('close')
}

function closeOnEscape(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', closeOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape))
</script>

<template>
  <div class="reminder-overlay" @click.self="emit('close')">
    <form
      class="reminder-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-title"
      @submit.prevent="save"
    >
      <button
        type="button"
        class="reminder-close"
        aria-label="Close reminder"
        @click="emit('close')"
      >
        ×
      </button>
      <h2 id="reminder-title">Reminder Message</h2>

      <div class="reminder-fields">
        <label>
          <span>Select date</span>
          <input v-model="date" aria-label="Select date" type="date" :min="today" required />
        </label>
        <label>
          <span>Select time</span>
          <input v-model="time" aria-label="Select time" type="time" required />
        </label>
      </div>

      <textarea v-model="title" aria-label="Reminder title" placeholder="Title" rows="6"></textarea>
      <p v-if="!valid" class="reminder-error">Choose a date and time in the future.</p>

      <footer>
        <button type="button" class="reminder-cancel" @click="emit('close')">Cancel</button>
        <button type="submit" class="reminder-save" :disabled="!valid">Save</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.reminder-overlay {
  position: fixed;
  z-index: 70;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #0006;
}

.reminder-dialog {
  position: relative;
  display: grid;
  width: min(565px, 100%);
  gap: 24px;
  border-radius: 6px;
  padding: 36px 50px 0;
  background: white;
  box-shadow: 0 16px 36px #0003;
}

.reminder-dialog h2 {
  margin: 0;
  color: #252525;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
}

.reminder-close {
  position: absolute;
  top: 18px;
  right: 18px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #f0eff8;
  color: #343449;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.reminder-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  margin-top: 6px;
}

.reminder-fields label {
  display: grid;
  gap: 4px;
  color: #686a78;
  font-size: 13px;
}

.reminder-fields input {
  width: 100%;
  min-width: 0;
  border: 0;
  border-bottom: 1px solid #aeb0b8;
  padding: 3px 2px 8px;
  background: transparent;
  color: #252525;
  font-size: 16px;
}

.reminder-fields label:focus-within {
  color: #5b5be2;
}

.reminder-fields label:focus-within input {
  border-color: #5b5be2;
  outline: none;
}

.reminder-dialog textarea {
  width: 100%;
  min-height: 185px;
  resize: vertical;
  border: 1px solid #c6c6c6;
  border-radius: 5px;
  padding: 14px;
  color: #252525;
  font: inherit;
  font-size: 16px;
}

.reminder-dialog textarea:focus {
  border-color: #5b5be2;
  outline: 1px solid #5b5be2;
}

.reminder-error {
  margin: -16px 0 0;
  color: #c92f43;
  font-size: 12px;
}

.reminder-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin: 0 -50px;
  border-top: 1px solid #e4e4e4;
  padding: 18px 10px;
}

.reminder-dialog footer button {
  min-width: 120px;
  min-height: 44px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.reminder-cancel {
  color: #3c3c3c;
}

.reminder-save {
  background: #5b5be2;
  color: white;
}

.reminder-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .reminder-dialog {
    gap: 18px;
    padding: 32px 20px 0;
  }

  .reminder-fields {
    gap: 18px;
  }

  .reminder-dialog footer {
    margin: 0 -20px;
  }
}
</style>
