<script setup>
import { ref } from 'vue'
import { useRemindersStore } from './reminders'

defineEmits(['close'])

const reminders = useRemindersStore()
const showDeleted = ref(false)

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <section class="reminders-panel" aria-label="Reminders">
    <header class="reminders-panel__header">
      <h2>Reminders</h2>
      <button type="button" aria-label="Close reminders" @click="$emit('close')">×</button>
    </header>
    <div class="reminders-panel__content">
      <div class="reminders-panel__section">
        <h3>Upcoming reminders</h3>
        <div v-if="reminders.activeReminders.length" class="reminders-panel__list">
          <article
            v-for="reminder in reminders.activeReminders"
            :key="reminder.id"
            class="reminder-card"
            :class="{ 'reminder-card--completed': reminder.completed }"
          >
            <div class="reminder-card__top">
              <strong>
                {{ reminder.conversationType === 'channel' ? '#' : '' }}{{ reminder.conversationName }}
              </strong>
              <button
                type="button"
                :aria-label="reminder.completed ? 'Mark as incomplete' : 'Mark as complete'"
                :title="reminder.completed ? 'Mark as incomplete' : 'Mark as complete'"
                @click="reminders.updateReminder(reminder.id, { completed: !reminder.completed })"
              >
                {{ reminder.completed ? '✓' : '○' }}
              </button>
            </div>
            <p class="reminder-card__message">{{ reminder.text }}</p>
            <p v-if="reminder.note" class="reminder-card__note">{{ reminder.note }}</p>
            <time>{{ formatDate(reminder.remindAt) }}</time>
            <button
              class="reminder-card__delete"
              type="button"
              @click="reminders.removeReminder(reminder.id)"
            >
              Delete
            </button>
          </article>
        </div>
        <p v-else class="reminders-panel__empty">No reminders yet. Use the clock on a message to add one.</p>
      </div>

      <div class="reminders-panel__section">
        <button
          class="reminders-panel__toggle"
          type="button"
          :aria-expanded="showDeleted"
          @click="showDeleted = !showDeleted"
        >
          <span>Deleted Reminders ({{ reminders.deletedReminders.length }})</span>
          <span>{{ showDeleted ? '⌃' : '⌄' }}</span>
        </button>
        <div v-if="showDeleted" class="reminders-panel__list">
          <article v-for="reminder in reminders.deletedReminders" :key="reminder.id" class="reminder-card reminder-card--deleted">
            <strong>{{ reminder.conversationName }}</strong>
            <p class="reminder-card__message">{{ reminder.text }}</p>
            <time>{{ formatDate(reminder.remindAt) }}</time>
            <button
              class="reminder-card__restore"
              type="button"
              @click="reminders.restoreReminder(reminder.id)"
            >
              Restore
            </button>
          </article>
          <p v-if="!reminders.deletedReminders.length" class="reminders-panel__empty">
            Deleted reminders will appear here.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reminders-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
  color: #303044;
}
.reminders-panel__header {
  display: flex;
  height: 64px;
  flex: 0 0 64px;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e6e6eb;
}
.reminders-panel__header h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 500;
}
.reminders-panel__header button {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: #f1f1f7;
  color: #46465b;
  font-size: 23px;
  cursor: pointer;
}
.reminders-panel__content {
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px 28px;
}
.reminders-panel__section + .reminders-panel__section {
  margin-top: 20px;
}
.reminders-panel__section h3,
.reminders-panel__toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 12px 4px;
  border: 0;
  background: transparent;
  color: #333;
  font-size: 17px;
  text-align: left;
}
.reminders-panel__toggle {
  cursor: pointer;
}
.reminders-panel__list {
  display: grid;
  gap: 12px;
}
.reminder-card {
  padding: 15px;
  border-left: 5px solid #5b5cff;
  background: #f7f7ff;
}
.reminder-card--completed {
  opacity: 0.65;
}
.reminder-card--deleted {
  border-left-color: #df525b;
  background: #fff5f5;
}
.reminder-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.reminder-card__top button {
  border: 0;
  background: transparent;
  color: #5b5cff;
  font-size: 22px;
  cursor: pointer;
}
.reminder-card__message {
  margin: 8px 0;
  color: #353545;
  line-height: 1.5;
}
.reminder-card__note {
  margin: 8px 0;
  color: #5b5cff;
}
.reminder-card time {
  color: #737381;
  font-size: 13px;
}
.reminder-card__delete,
.reminder-card__restore {
  display: block;
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #5555dc;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.reminder-card__delete {
  color: #d44752;
}
.reminders-panel__empty {
  margin: 0;
  padding: 14px;
  color: #777;
  font-size: 14px;
}
</style>
