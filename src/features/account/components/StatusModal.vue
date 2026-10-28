<script setup>
import { ref, computed, nextTick } from 'vue'
import SelectField from './SelectField.vue'
import { DURATIONS, computeExpiry, toDateInput, todayInput } from '../composables/statusExpiry'

const props = defineProps({
  modelValue: { type: String, default: '' },
  duration: { type: String, default: 'never' },
  expiresAt: { type: Number, default: null },
})

const emit = defineEmits(['update:modelValue', 'close', 'save', 'clear'])

const text = ref(props.modelValue)
const hasStatus = props.modelValue.trim().length > 0

/** 'list'     → predefined statuses
 *  'duration' → "Remove status after" (shown once a status is picked / already set) */
const view = ref(hasStatus ? 'duration' : 'list')
const duration = ref(hasStatus ? props.duration || 'never' : 'never')
const date = ref(
  hasStatus && props.duration === 'date' && props.expiresAt ? toDateInput(props.expiresAt) : '',
)
const today = todayInput()

const inputEl = ref(null)

const predefined = [
  { id: 'meeting', label: 'In a meeting', icon: 'meeting' },
  { id: 'commuting', label: 'Commuting', icon: 'bus' },
  { id: 'sick', label: 'Sick Leave', icon: 'sick' },
  { id: 'vacation', label: 'On Vacations', icon: 'vacation' },
  { id: 'remote', label: 'Working Remotely', icon: 'remote' },
]

const dateValid = computed(() => duration.value !== 'date' || (!!date.value && date.value >= today))

const canSave = computed(() => text.value.trim().length > 0 && dateValid.value)

const pick = (item) => {
  text.value = item.label
  duration.value = 'never'
  date.value = ''
  view.value = 'duration'
}

/** The X in the input: wipe the text and go back to the predefined list. */
const clearText = async () => {
  text.value = ''
  duration.value = 'never'
  date.value = ''
  view.value = 'list'
  await nextTick()
  inputEl.value?.focus()
}

const clear = () => {
  text.value = ''
  emit('update:modelValue', '')
  emit('clear')
}

const save = () => {
  if (!canSave.value) return
  const payload = {
    text: text.value.trim(),
    duration: duration.value,
    expiresAt: computeExpiry(duration.value, date.value),
  }
  emit('update:modelValue', payload.text)
  emit('save', payload)
}
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="status-title">
    <button class="close" aria-label="Close" @click="emit('close')">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
      >
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    </button>

    <h2 id="status-title" class="title">Set a Status</h2>

    <div class="body" :class="{ scroll: view === 'list' }">
      <div class="input-wrap">
        <input
          ref="inputEl"
          v-model="text"
          class="input"
          type="text"
          placeholder="What's your current status?"
          data-autofocus
          @keydown.enter="save"
        />
        <button
          v-if="view === 'duration'"
          type="button"
          class="clear-x"
          aria-label="Clear status text"
          @click="clearText"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <svg
          v-else
          class="cup"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 3c-.8.8.8 1.6 0 2.4M12 3c-.8.8.8 1.6 0 2.4M15 3c-.8.8.8 1.6 0 2.4" />
          <path d="M5 9h12v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9z" />
          <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H16.5" />
          <path d="M4 21h15" />
        </svg>
      </div>

      <!-- View 1: predefined statuses -->
      <template v-if="view === 'list'">
        <h3 class="subtitle">Some Predefined Statuses</h3>

        <ul class="list">
          <li v-for="item in predefined" :key="item.id">
            <button class="row" @click="pick(item)">
              <svg
                class="icon"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <!-- meeting -->
                <template v-if="item.icon === 'meeting'">
                  <circle cx="16" cy="9" r="3.2" />
                  <circle cx="7" cy="12.5" r="2.6" />
                  <circle cx="25" cy="12.5" r="2.6" />
                  <path d="M10.5 24v-5a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v5z" />
                  <path d="M3 24v-4a2.5 2.5 0 0 1 2.5-2.5H8" />
                  <path d="M29 24v-4a2.5 2.5 0 0 0-2.5-2.5H24" />
                  <path d="M2 24h28" />
                </template>
                <!-- bus -->
                <template v-else-if="item.icon === 'bus'">
                  <rect x="5" y="3" width="22" height="24" rx="2.5" />
                  <path d="M5 16h22" />
                  <path d="M5 8h22" />
                  <circle cx="10.5" cy="21.5" r="1.2" />
                  <circle cx="21.5" cy="21.5" r="1.2" />
                  <path d="M9 27v2M23 27v2" />
                </template>
                <!-- sick -->
                <template v-else-if="item.icon === 'sick'">
                  <circle cx="16" cy="16" r="13" />
                  <path d="M8 11c2.5-2 13.5-2 16 0" />
                  <path d="M10.5 14.5l2 1M21.5 14.5l-2 1" />
                  <rect x="8.5" y="18" width="15" height="7" rx="2" />
                  <path d="M8.5 21.5h15" />
                </template>
                <!-- vacation -->
                <template v-else-if="item.icon === 'vacation'">
                  <circle cx="19" cy="19" r="10" />
                  <path d="M9 19c3 0 4 2 7 2M19 9c0 3 2 4 2 7M22 25c-1-2 1-4 4-4" />
                  <path d="M4 13l8.5-4.5a1.5 1.5 0 0 1 2 .8l.4 1-4.5 2.2 4 6-2 1-5-5.5-2.5 1.2z" />
                </template>
                <!-- remote -->
                <template v-else-if="item.icon === 'remote'">
                  <path d="M3 14L16 3l13 11" />
                  <path d="M6 12v14M26 12v14" />
                  <path d="M6 20h20" />
                  <rect x="9" y="20" width="14" height="6" rx="1" />
                  <path d="M4 28h24" />
                </template>
              </svg>
              <span class="label">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </template>

      <!-- View 2: remove status after -->
      <template v-else>
        <div class="field">
          <SelectField v-model="duration" :options="DURATIONS" label="Remove status after" />
        </div>

        <div v-if="duration === 'date'" class="field">
          <input
            v-model="date"
            class="date-input"
            type="date"
            :min="today"
            aria-label="Remove status on"
          />
          <span class="float-label">Remove status on</span>
        </div>
      </template>
    </div>

    <div class="footer">
      <button class="btn clear" @click="clear">CLEAR STATUS</button>
      <button class="btn save" :disabled="!canSave" @click="save">SAVE</button>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 490px;
  max-width: 100%;
  max-height: calc(100vh - 32px);
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-family:
    'Roboto',
    -apple-system,
    'Segoe UI',
    sans-serif;
  color: #1f1f2e;
  padding-top: 38px;
  box-sizing: border-box;
}

.close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #e8e8f3;
  color: #2b2b3c;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close:hover {
  background: #dcdcee;
}
.close svg {
  width: 100%;
  height: 100%;
}

.title {
  flex-shrink: 0;
  margin: 0 0 22px;
  text-align: center;
  font-size: 19px;
  font-weight: 500;
  color: #323248;
}

/* Body: scrolls only in the list view so dropdowns in the other view are never clipped */
.body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 24px 20px;
}
.body.scroll {
  overflow-y: auto;
  padding-bottom: 14px;
}

.input-wrap {
  position: relative;
}

.input {
  width: 100%;
  height: 38px;
  box-sizing: border-box;
  padding: 0 52px 0 14px;
  font-size: 15px;
  font-family: inherit;
  color: #1f1f2e;
  border: 1px solid #a5a6b0;
  border-radius: 4px;
  outline: none;
}
.input::placeholder {
  color: #a3a4ad;
}
.input:focus {
  border-color: #5559f4;
}

.cup {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  color: #3b3b55;
  pointer-events: none;
}

.clear-x {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  padding: 4px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #5a5b6a;
  cursor: pointer;
}
.clear-x:hover {
  background: #f0f0f6;
  color: #1f1f2e;
}
.clear-x svg {
  width: 100%;
  height: 100%;
}

.field {
  position: relative;
  margin-top: 24px;
}

.date-input {
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  padding: 0 14px;
  font-family: inherit;
  font-size: 14px;
  color: #1f1f2e;
  background: #fff;
  border: 1px solid #a5a6b0;
  border-radius: 4px;
  outline: none;
}
.date-input:focus {
  border-color: #5559f4;
}

.float-label {
  position: absolute;
  top: -9px;
  left: 11px;
  padding: 0 4px;
  background: #fff;
  font-size: 14px;
  line-height: 1;
  color: #676879;
  pointer-events: none;
}

.subtitle {
  margin: 34px 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #676879;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 44px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.row:hover .label {
  color: #5559f4;
}

.icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: #3b3b55;
}

.label {
  font-size: 15px;
  color: #1f1f2e;
}

/* Footer is a fixed flex row, so it can never be clipped or pushed out of the card */
.footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 16px 14px;
  border-top: 1px solid #e5e5e8;
}

.btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1px;
  cursor: pointer;
  border: none;
  border-radius: 6px;
}

.clear {
  background: transparent;
  color: #1f1f2e;
  padding: 10px 8px;
}
.clear:hover {
  color: #5559f4;
}

.save {
  background: #5559f4;
  color: #fff;
  height: 34px;
  padding: 0 12px;
}
.save:hover:not(:disabled) {
  background: #4448d9;
}
.save:disabled {
  background: #a5a7fa;
  cursor: not-allowed;
}
</style>
