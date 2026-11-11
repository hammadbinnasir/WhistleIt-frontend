<script setup>
import { computed } from 'vue'

const props = defineProps({
  poll: { type: Object, required: true },
  backendAvailable: { type: Boolean, default: true },
  canPublish: { type: Boolean, default: false },
  closed: { type: Boolean, default: false },
  scheduled: { type: Boolean, default: false },
  alreadyVoted: { type: Boolean, default: false },
  canClose: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['participate', 'results', 'close', 'export', 'publish'])
const status = computed(() =>
  props.closed ? 'Closed' : props.scheduled ? 'Scheduled' : 'Open',
)
</script>

<template>
  <section class="composer-conversation__poll-card" :data-poll-id="poll.id">
    <h2>{{ poll.title || poll.question || 'Poll' }}</h2>
    <div class="composer-conversation__poll-meta">
      <span class="composer-conversation__poll-status" :class="{ 'is-closed': closed }">
        <i
          class="composer-conversation__poll-status-icon"
          :class="closed ? 'is-closed' : scheduled ? 'is-scheduled' : 'is-open'"
          aria-hidden="true"
        >
          {{ closed ? '×' : scheduled ? '◷' : '✓' }}
        </i>
        {{ status }}
      </span>
      <span class="composer-conversation__poll-meta-divider" aria-hidden="true"></span>
      <span class="composer-conversation__poll-visibility">
        {{ poll.audience === 'anonymous' ? 'Anonymous' : 'Public' }}
      </span>
    </div>
    <p v-if="!backendAvailable" class="composer-conversation__poll-message-state" role="status">
      This older poll has no server ID. Publish a server copy to collect responses.
    </p>
    <p v-if="error" class="composer-conversation__poll-message-state" role="alert">
      {{ error }}
    </p>
    <div class="composer-conversation__poll-actions">
      <button
        v-if="backendAvailable && alreadyVoted"
        type="button"
        class="is-done"
        disabled
      >
        You're Done
      </button>
      <button
        v-if="backendAvailable && !scheduled && !closed && !alreadyVoted"
        type="button"
        :disabled="loading"
        @click="emit('participate')"
      >
        Participate
      </button>
      <button
        v-if="backendAvailable && !scheduled"
        type="button"
        :disabled="loading"
        @click="emit('results')"
      >
        View All Results
      </button>
      <button
        v-if="backendAvailable && canClose && !closed && !scheduled"
        type="button"
        :disabled="loading"
        @click="emit('close')"
      >
        Close Poll
      </button>
      <button
        v-if="backendAvailable && closed"
        type="button"
        :disabled="loading"
        @click="emit('export')"
      >
        Export To Csv
      </button>
      <span v-if="loading" aria-live="polite">Saving poll...</span>
      <button
        v-if="!backendAvailable && canPublish"
        type="button"
        :disabled="loading"
        @click="emit('publish')"
      >
        Publish poll
      </button>
    </div>
  </section>
</template>

<style scoped>
.composer-conversation__poll-card {
  overflow: hidden;
  border-left: 4px solid #1717ff;
  background: #edeef6;
}

.composer-conversation__poll-card h2 {
  margin: 0;
  padding: 18px 16px 12px;
  border-bottom: 1px solid #d5d7e2;
  color: #25263a;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.3;
}

.composer-conversation__poll-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 16px 9px;
  color: #696d81;
  font-size: 14px;
}

.composer-conversation__poll-status,
.composer-conversation__poll-visibility {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.composer-conversation__poll-status-icon {
  display: inline-grid;
  width: 15px;
  height: 15px;
  place-items: center;
  border-radius: 3px;
  background: #4caf50;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  line-height: 1;
}

.composer-conversation__poll-status-icon.is-closed {
  background: #f04444;
}

.composer-conversation__poll-status-icon.is-scheduled {
  background: #5962ff;
}

.composer-conversation__poll-status.is-closed {
  color: #696d81;
}

.composer-conversation__poll-meta-divider {
  width: 1px;
  height: 18px;
  background: #c9cbd6;
}

.composer-conversation__poll-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 14px;
}

.composer-conversation__poll-actions button {
  min-height: 33px;
  padding: 7px 10px;
  border: 1px solid #5962ff;
  border-radius: 4px;
  background: #fff;
  color: #5962ff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.composer-conversation__poll-actions button:hover:not(:disabled) {
  border-color: #27338f;
  background: #27338f;
  color: #fff;
}

.composer-conversation__poll-actions button.is-done,
.composer-conversation__poll-actions button.is-done:disabled {
  border-color: #929bff;
  background: #929bff;
  color: #fff;
  cursor: default;
  opacity: 1;
}

.composer-conversation__poll-actions button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.composer-conversation__poll-message-state {
  padding: 9px 16px 0;
  color: #4c625d;
}

@media (max-width: 620px) {
  .composer-conversation__poll-card h2 {
    padding: 14px 12px 10px;
    font-size: 19px;
  }

  .composer-conversation__poll-meta {
    padding: 10px 12px 8px;
  }

  .composer-conversation__poll-actions {
    padding: 0 8px 10px;
  }
}
</style>