<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useChannelsStore } from '../store/channels.store'
import { DESCRIPTION_MAX, NAME_MAX } from '../constants'
import ChannelModal from './ChannelModal.vue'

// Create AND edit share this form.
const props = defineProps({
  mode: { type: String, default: 'create' }, // 'create' | 'edit'
  channel: { type: Object, default: null }, // required when mode === 'edit'
})
const emit = defineEmits(['close', 'saved'])

const store = useChannelsStore()
const isEdit = computed(() => props.mode === 'edit')

const name = ref(props.channel?.name ?? '')
const description = ref(props.channel?.description ?? '')
const isPrivate = ref(props.channel?.isPrivate ?? false)
const saving = ref(false)
const touched = ref(false)
const serverError = ref('')
const nameInput = ref(null)

const trimmedName = computed(() => name.value.trim())
const nameError = computed(() => (trimmedName.value ? '' : 'Channel name is required.'))
const unchanged = computed(
  () =>
    isEdit.value &&
    trimmedName.value === props.channel.name &&
    description.value.trim() === props.channel.description,
)
const canSubmit = computed(() => !nameError.value && !saving.value && !unchanged.value)

const title = computed(() => {
  if (isEdit.value) return 'Edit Channel'
  return isPrivate.value ? 'Create Private Channel' : 'Create Public Channel'
})

onMounted(() => nameInput.value?.focus())
watch(name, () => {
  touched.value = true
})

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  serverError.value = ''
  try {
    const payload = { name: trimmedName.value, description: description.value.trim() }
    const saved = isEdit.value
      ? await store.updateChannel(props.channel.id, payload)
      : await store.createChannel({ ...payload, isPrivate: isPrivate.value })
    emit('saved', saved)
  } catch (err) {
    serverError.value = err?.message || 'Something went wrong. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ChannelModal :title="title" :busy="saving" @close="emit('close')">
    <form id="ch-channel-form" novalidate @submit.prevent="submit">
      <p class="ch-form__intro">
        Channels are a way to communicate with your team. Organize your channels to relevant topic -
        Off-Topic
      </p>

      <div class="ch-field">
        <label class="ch-field__label" for="ch-name">Name</label>
        <input
          id="ch-name"
          ref="nameInput"
          v-model="name"
          class="ch-input"
          :class="{ 'ch-input--invalid': touched && nameError }"
          type="text"
          placeholder="e.g. Business-Plan"
          autocomplete="off"
          :maxlength="NAME_MAX"
          :aria-invalid="touched && !!nameError"
          aria-describedby="ch-name-error"
        />
        <p v-if="touched && nameError" id="ch-name-error" class="ch-error">{{ nameError }}</p>
      </div>

      <div class="ch-field">
        <label class="ch-field__label" for="ch-description"
          >Description <small>(optional)</small></label
        >
        <input
          id="ch-description"
          v-model="description"
          class="ch-input"
          type="text"
          autocomplete="off"
          :maxlength="DESCRIPTION_MAX"
        />
        <p class="ch-form__hint">*What's the purpose of the channel?</p>
      </div>

      <div class="ch-switch-row">
        <div>
          <div class="ch-switch-row__title">Make private</div>
          <div class="ch-switch-row__text">
            Private channel is only visible to members of the channel and can be joined by
            invitation only.
            <template v-if="isEdit"> Visibility can't be changed after creation.</template>
          </div>
        </div>
        <button
          class="ch-switch"
          :class="{ 'ch-switch--on': isPrivate }"
          type="button"
          role="switch"
          :aria-checked="isPrivate"
          aria-label="Make private"
          :disabled="isEdit || saving"
          @click="isPrivate = !isPrivate"
        >
          <span class="ch-switch__thumb" />
        </button>
      </div>

      <p v-if="serverError" class="ch-error" role="alert">{{ serverError }}</p>
    </form>

    <template #footer>
      <button class="ch-btn ch-btn--ghost" type="button" :disabled="saving" @click="emit('close')">
        Cancel
      </button>
      <button
        class="ch-btn ch-btn--primary"
        type="submit"
        form="ch-channel-form"
        :disabled="!canSubmit"
      >
        {{ saving ? 'Saving…' : isEdit ? 'Save' : 'Create' }}
      </button>
    </template>
  </ChannelModal>
</template>

<style scoped>
.ch-form__intro {
  margin: 0 0 24px;
  font-size: 16px;
  line-height: 1.5;
  color: var(--ch-muted);
}
.ch-form__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ch-muted);
}
.ch-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.ch-switch-row__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ch-muted);
}
.ch-switch-row__text {
  margin-top: 2px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ch-muted);
}
.ch-switch {
  position: relative;
  flex-shrink: 0;
  width: 60px;
  height: 36px;
  border: 0;
  border-radius: 18px;
  background: #e0e0e6;
  cursor: pointer;
  transition: background 0.15s;
}
.ch-switch:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.ch-switch--on {
  background: var(--ch-accent);
}
.ch-switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.ch-switch--on .ch-switch__thumb {
  transform: translateX(24px);
}
</style>
