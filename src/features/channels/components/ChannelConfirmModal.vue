<script setup>
import { computed } from 'vue'
import ChannelModal from './ChannelModal.vue'

// Presentational confirm dialog for "leave" and "archive". The action itself runs in ChannelDialogs.
const props = defineProps({
  type: { type: String, required: true }, // 'leave' | 'archive'
  channelName: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'close'])

const isLeave = computed(() => props.type === 'leave')
const title = computed(() => (isLeave.value ? 'Leave Channel' : 'Archive Channel'))
</script>

<template>
  <ChannelModal :title="title" width="460px" :busy="busy" @close="emit('close')">
    <p v-if="isLeave" class="ch-confirm__text">
      Are you sure you want to leave <strong>{{ channelName }}</strong
      >?
      <template v-if="isPrivate">
        This is a private channel, so you can only rejoin if someone invites you.</template
      >
    </p>
    <p v-else class="ch-confirm__text">
      Archive <strong>{{ channelName }}</strong
      >? It will be hidden from the channel list and become read-only for all members.
    </p>
    <p v-if="error" class="ch-error" role="alert">{{ error }}</p>

    <template #footer>
      <button class="ch-btn ch-btn--ghost" type="button" :disabled="busy" @click="emit('close')">
        Cancel
      </button>
      <button class="ch-btn ch-btn--danger" type="button" :disabled="busy" @click="emit('confirm')">
        {{ busy ? 'Please wait…' : isLeave ? 'Leave' : 'Archive' }}
      </button>
    </template>
  </ChannelModal>
</template>

<style scoped>
.ch-confirm__text {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--ch-muted);
}
</style>
