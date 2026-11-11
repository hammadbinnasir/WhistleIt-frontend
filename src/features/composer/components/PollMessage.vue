<script setup>
import { computed } from 'vue'

const props = defineProps({
  poll: { type: Object, required: true },
  backendAvailable: { type: Boolean, default: true },
  canPublish: { type: Boolean, default: false },
  result: { type: Object, default: null },
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
    <div v-if="poll.description" class="composer-conversation__poll-description">
      {{ poll.description }}
    </div>
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
    <div
      v-if="poll.scheduleStart || poll.scheduleClose"
      class="composer-conversation__poll-schedule-info"
    >
      <span v-if="poll.scheduleStart">Starts {{ new Date(poll.scheduleStart).toLocaleString() }}</span>
      <span v-if="poll.scheduleClose">Ends {{ new Date(poll.scheduleClose).toLocaleString() }}</span>
    </div>
    <div
      v-for="(question, questionIndex) in poll.questions || []"
      :key="question.id ?? questionIndex"
      class="composer-conversation__poll-question-preview"
    >
      <strong>{{ question.text }}</strong>
      <ul v-if="question.options?.length">
        <li v-for="(option, optionIndex) in question.options" :key="option.id ?? optionIndex">
          {{ typeof option === 'object' ? option.text ?? option.label : option }}
        </li>
      </ul>
      <small v-else-if="question.type === 'openEnded'">Open-ended response</small>
    </div>
    <p v-if="!poll.questions?.length" class="composer-conversation__poll-message-state">
      No poll questions are available.
    </p>
    <section
      v-if="result && (alreadyVoted || closed)"
      class="composer-conversation__poll-results-preview"
      aria-label="Poll results"
    >
      <strong>Total votes: {{ result.totalVotes || 0 }}</strong>
      <div v-for="(question, questionIndex) in poll.questions || []" :key="question.id ?? questionIndex">
        <p>{{ question.text }}</p>
        <div v-for="(option, optionIndex) in question.options || []" :key="optionIndex">
          <span>{{ typeof option === 'object' ? option.text ?? option.label : option }}</span>
          <strong>{{ result.questions?.[questionIndex]?.votes?.[optionIndex] || 0 }}</strong>
        </div>
      </div>
    </section>
    <p v-if="alreadyVoted" class="composer-conversation__poll-message-state">
      You're Done. You have already voted.
    </p>
    <p v-if="!backendAvailable" class="composer-conversation__poll-message-state" role="status">
      This older poll has no server ID. Publish a server copy to collect responses.
    </p>
    <p v-if="error" class="composer-conversation__poll-message-state" role="alert">
      {{ error }}
    </p>
    <div class="composer-conversation__poll-actions">
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
  border-left: 4px solid #287b72;
  background: #edf4f2;
}

.composer-conversation__poll-card h2 {
  margin: 0;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #cbd9d5;
  font-size: 19px;
  font-weight: 600;
}

.composer-conversation__poll-description,
.composer-conversation__poll-meta,
.composer-conversation__poll-question-preview,
.composer-conversation__poll-message-state {
  padding: 9px 16px 0;
}

.composer-conversation__poll-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #4c625d;
  font-size: 13px;
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
  background: #348263;
  color: white;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.composer-conversation__poll-status-icon.is-closed {
  background: #a94747;
}

.composer-conversation__poll-status-icon.is-scheduled {
  background: #59717a;
}

.composer-conversation__poll-meta-divider {
  width: 1px;
  height: 16px;
  background: #b6c8c2;
}

.composer-conversation__poll-question-preview {
  padding-top: 12px;
}

.composer-conversation__poll-schedule-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 10px 12px 0;
  padding: 8px;
  border: 1px solid #cbd9d5;
  border-radius: 4px;
  background: white;
  color: #355b54;
  font-size: 12px;
}

.composer-conversation__poll-question-preview ul {
  margin: 7px 0 0;
  padding-left: 20px;
}

.composer-conversation__poll-question-preview li {
  margin: 3px 0;
}

.composer-conversation__poll-results-preview {
  margin: 10px 12px 0;
  padding: 10px;
  border: 1px solid #cbd9d5;
  border-radius: 4px;
  background: white;
}

.composer-conversation__poll-results-preview p {
  margin: 8px 0 4px;
  font-weight: 600;
}

.composer-conversation__poll-results-preview div div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
}

.composer-conversation__poll-question-preview small,
.composer-conversation__poll-message-state {
  color: #4c625d;
}

.composer-conversation__poll-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px;
}

.composer-conversation__poll-actions button {
  min-height: 34px;
  padding: 6px 11px;
  border: 1px solid #9dbbb1;
  border-radius: 4px;
  background: #fff;
  color: #24574e;
  cursor: pointer;
}

.composer-conversation__poll-actions button:disabled {
  cursor: wait;
  opacity: 0.6;
}
</style>