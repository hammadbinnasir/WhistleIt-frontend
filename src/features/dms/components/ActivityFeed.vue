<script setup>
import { computed, onMounted, ref } from 'vue'
import { useActivityStore } from '@/stores/activity'
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'
import { useRemindersStore } from '@/features/search/reminders'
import { useChannelsStore } from '@/features/channels/store/channels.store'
import MessageComposer from '@/features/composer/components/MessageComposer.vue'

const tabs = [
  { id: 'recent-dms', label: 'Recent DMs' },
  { id: 'recent-messages', label: 'Recent Messages' },
  { id: 'scheduled', label: 'Scheduled Messages' },
  { id: 'pinned', label: 'Pinned Messages' },
  { id: 'reminders', label: 'Upcoming Reminders' },
  { id: 'mentions', label: 'All Mentions' },
  { id: 'workflows', label: 'Workflows' },
]

const activity = useActivityStore()
const dms = useDmStore()
const ui = useUiStore()
const reminders = useRemindersStore()
const channels = useChannelsStore()

const activeTab = ref('recent-dms')
const tabPage = ref(0)
const allWorkflowsExpanded = ref(true)
const workflowSearch = ref('')
const workflowTemplate = ref(null)
const workflowName = ref('')
const workflowMessage = ref('')
const workflowChannelId = ref('')
const workflowSchedule = ref('09:00')
const workflowTimeZone = ref('Asia/Karachi')
const workflowRecurrence = ref('weekly')
const workflowStartDate = ref('')
const workflowEndDate = ref('')
const activeThread = ref(null)

onMounted(() => {
  void activity.init()
  void dms.init()
})

const recentDms = computed(() =>
  dms.sorted
    .filter((conversation) => conversation.type === 'dm')
    .map((conversation) => ({
      conversation,
      message: conversation.messages.at(-1),
    })),
)

const recentMessages = computed(() =>
  dms.conversations
    .flatMap((conversation) => conversation.messages.map((message) => ({ conversation, message })))
    .sort(
      (a, b) =>
        new Date(b.message.createdAt || 0).getTime() - new Date(a.message.createdAt || 0).getTime(),
    ),
)

const threadConversation = computed(
  () =>
    dms.conversations.find(
      (conversation) => conversation.id === activeThread.value?.conversationId,
    ) || null,
)
const threadReplies = computed(
  () =>
    threadConversation.value?.messages.filter(
      (message) => message.threadId === activeThread.value?.message.id,
    ) || [],
)

const scheduledMessages = computed(() =>
  recentMessages.value
    .filter(({ message }) => message.scheduled)
    .sort(
      (a, b) =>
        new Date(a.message.scheduledAt).getTime() - new Date(b.message.scheduledAt).getTime(),
    ),
)

const pinnedMessages = computed(() => recentMessages.value.filter(({ message }) => message.pinned))

const upcomingReminders = computed(() =>
  reminders.sorted.filter(
    (reminder) => !reminder.fired && new Date(reminder.remindAt).getTime() > Date.now(),
  ),
)

const mentions = computed(() => activity.sorted.filter((item) => item.type === 'mention'))
const unreadMentionCount = computed(() => mentions.value.filter((item) => !item.read).length)
const visibleTabs = computed(() => (tabPage.value === 0 ? tabs.slice(0, 5) : tabs.slice(1)))

const filteredWorkflows = computed(() => {
  const query = workflowSearch.value.trim().toLowerCase()
  if (!query) return activity.workflows
  return activity.workflows.filter((workflow) =>
    [workflow.name, workflow.channelName, workflow.message, workflow.recurrence]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)),
  )
})

function titleOf(conversation) {
  return dms.titleOf(conversation) || 'Direct message'
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function displayMessage(message) {
  if (message.text || message.content) return message.text || message.content
  if (message.attachments?.length) return `${message.attachments.length} attachment(s).`
  return 'Message'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function openConversation(conversationId) {
  if (dms.openConversation(conversationId)) ui.activePanel = null
}

function openThread(conversation, message) {
  if (!message) return
  activeThread.value = { conversationId: conversation.id, message }
}

function closeThread() {
  activeThread.value = null
}

function sendThreadReply(payload) {
  if (!activeThread.value) return
  dms.sendMessage(activeThread.value.conversationId, {
    ...payload,
    threadId: activeThread.value.message.id,
  })
}

function showTabPage(page) {
  tabPage.value = page
}

function selectTab(tabId) {
  const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
  if (tabIndex >= 5) showTabPage(1)
  else showTabPage(0)
  activeTab.value = tabId
}

function openMention(item) {
  activity.setRead(item.id, true)
  openConversation(item.conversationId)
}

function openReminder(reminder) {
  if (reminder.conversationType === 'dm') {
    openConversation(reminder.conversationId)
    return
  }
  ui.selectChannel(reminder.conversationId)
  ui.activePanel = null
}

function openWorkflowForm(template) {
  workflowTemplate.value = template
  workflowName.value = template === 'schedule' ? 'Schedule Message' : 'Welcome Newcomer'
  workflowMessage.value =
    template === 'schedule' ? '' : 'Welcome to the channel! We are glad to have you here.'
  workflowChannelId.value = channels.visibleChannels[0]?.id || ''
  workflowSchedule.value = '09:00'
  workflowTimeZone.value = 'Asia/Karachi'
  workflowRecurrence.value = 'weekly'
  workflowStartDate.value = ''
  workflowEndDate.value = ''
}

function saveWorkflow() {
  const channel = channels.getById(workflowChannelId.value)
  if (!workflowTemplate.value || !channel || !workflowName.value.trim()) return

  activity.createWorkflow({
    type: workflowTemplate.value,
    name: workflowName.value.trim(),
    channelId: channel.id,
    channelName: channel.name,
    message: workflowMessage.value.trim(),
    scheduleTime: workflowSchedule.value,
    timeZone: workflowTimeZone.value,
    recurrence: workflowTemplate.value === 'schedule' ? workflowRecurrence.value : 'on join',
    startDate: workflowStartDate.value,
    endDate: workflowEndDate.value,
  })
  workflowTemplate.value = null
  activeTab.value = 'workflows'
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden bg-white text-slate-800">
    <header class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3">
      <button
        type="button"
        class="grid h-10 w-8 shrink-0 place-items-center text-xl text-slate-600 hover:text-indigo-600"
        aria-label="Close activities"
        title="Close activities"
        @click="ui.activePanel = null"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 18-6-6 6-6" />
          <path d="M20 12H9" />
        </svg>
      </button>

      <button
        type="button"
        class="grid h-10 w-8 shrink-0 place-items-center text-lg text-slate-500 hover:text-indigo-600"
        aria-label="Scroll tabs left"
        title="Scroll tabs left"
        :disabled="tabPage === 0"
        :class="{ 'cursor-not-allowed opacity-40': tabPage === 0 }"
        @click="showTabPage(0)"
      >
        ‹
      </button>
      <nav
        class="flex min-w-0 flex-1 items-center justify-around gap-1 overflow-hidden"
        aria-label="Activity views"
      >
        <button
          v-for="tab in visibleTabs"
          :key="tab.id"
          type="button"
          class="min-w-0 shrink border-b-2 px-2 py-4 text-center text-sm font-semibold transition-colors"
          :class="
            activeTab === tab.id
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          "
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="selectTab(tab.id)"
        >
          {{ tab.label }}
          <span v-if="tab.id === 'mentions' && unreadMentionCount" class="ml-1 text-xs">
            {{ unreadMentionCount }}
          </span>
        </button>
      </nav>

      <button
        type="button"
        class="grid h-10 w-8 shrink-0 place-items-center text-lg text-slate-500 hover:text-indigo-600"
        aria-label="Scroll tabs right"
        title="Scroll tabs right"
        :disabled="tabPage === 1"
        :class="{ 'cursor-not-allowed opacity-40': tabPage === 1 }"
        @click="showTabPage(1)"
      >
        ›
      </button>
      <button
        type="button"
        class="grid h-10 w-8 shrink-0 place-items-center text-lg text-slate-500 hover:text-indigo-600"
        aria-label="Refresh activity"
        title="Refresh activity"
        :disabled="activity.loading"
        @click="activity.refresh()"
      >
        ↻
      </button>
    </header>

    <p
      v-if="activity.error"
      class="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700"
      role="alert"
    >
      {{ activity.error }}
      <button class="ml-2 underline" @click="activity.refresh()">Retry</button>
    </p>
    <p
      v-else-if="activity.loading"
      class="border-b border-slate-100 px-5 py-2 text-sm text-slate-500"
    >
      Loading activity…
    </p>

    <div
      v-if="activeTab === 'mentions'"
      class="flex shrink-0 justify-end gap-2 border-b border-slate-100 px-5 py-2"
    >
      <button
        type="button"
        class="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
        @click="activity.markAllRead()"
      >
        Mark all as read
      </button>
      <button
        type="button"
        class="rounded border border-indigo-300 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
        @click="dms.receiveDemo()"
      >
        Demo: new message
      </button>
    </div>

    <div class="flex min-h-0 flex-1">
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div v-if="activeTab === 'recent-dms'" class="space-y-4 p-5">
          <article
            v-for="{ conversation, message } in recentDms"
            :key="conversation.id"
            class="rounded-xl border border-slate-200 p-4"
          >
            <div class="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <span class="text-indigo-300" aria-hidden="true">♙</span>
              <span>{{ titleOf(conversation) }}</span>
              <time class="ml-auto text-xs text-slate-500">{{
                formatDate(message?.createdAt)
              }}</time>
            </div>
            <div class="flex items-center gap-3">
              <span
                class="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-violet-600 font-semibold text-white"
              >
                {{ initials(titleOf(conversation)) }}
              </span>
              <div class="min-w-0 flex-1">
                <strong class="block truncate">{{ titleOf(conversation) }}</strong>
                <p class="break-words text-slate-700">
                  {{ message ? displayMessage(message) : 'No messages yet.' }}
                </p>
              </div>
              <button
                type="button"
                class="rounded border border-slate-400 px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                @click="openThread(conversation, message)"
              >
                Reply
              </button>
            </div>
          </article>
          <p v-if="!recentDms.length" class="py-12 text-center text-slate-500">
            No recent direct messages.
          </p>
        </div>

        <div v-else-if="activeTab === 'recent-messages'" class="space-y-4 p-5">
          <article
            v-for="{ conversation, message } in recentMessages"
            :key="`${conversation.id}-${message.id}`"
            class="rounded-xl border border-slate-200 p-4"
          >
            <div class="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <span class="text-indigo-300" aria-hidden="true">♙</span>
              <span>{{ titleOf(conversation) }}</span>
              <time class="ml-auto text-xs text-slate-500">{{
                formatDate(message.createdAt)
              }}</time>
            </div>
            <div class="flex items-center gap-3">
              <span
                class="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-emerald-500 font-semibold text-white"
              >
                {{ initials(dms.usersById[message.from]?.name || titleOf(conversation)) }}
              </span>
              <div class="min-w-0 flex-1">
                <strong class="block">{{
                  dms.usersById[message.from]?.name || titleOf(conversation)
                }}</strong>
                <p class="break-words text-slate-700">{{ displayMessage(message) }}</p>
              </div>
              <button
                type="button"
                class="rounded border border-slate-400 px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                @click="openThread(conversation, message)"
              >
                Reply
              </button>
            </div>
          </article>
          <p v-if="!recentMessages.length" class="py-12 text-center text-slate-500">
            No recent messages.
          </p>
        </div>

        <div v-else-if="activeTab === 'scheduled'" class="space-y-4 p-5">
          <article
            v-for="{ conversation, message } in scheduledMessages"
            :key="`${conversation.id}-${message.id}`"
            class="flex items-center gap-4 rounded-xl border border-slate-200 p-4"
          >
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ titleOf(conversation) }}</p>
              <p class="mt-1 break-words text-slate-700">{{ displayMessage(message) }}</p>
              <p class="mt-2 text-sm text-slate-500">
                {{ formatDate(message.scheduledAt) }} · {{ message.timeZone || 'Local time' }}
              </p>
            </div>
            <button
              type="button"
              class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              @click="dms.cancelScheduledMessage(conversation.id, message.id)"
            >
              Cancel
            </button>
          </article>
          <p v-if="!scheduledMessages.length" class="py-12 text-center text-slate-500">
            No scheduled messages. Schedule a message from the composer to see it here.
          </p>
        </div>

        <div v-else-if="activeTab === 'pinned'" class="space-y-4 p-5">
          <article
            v-for="{ conversation, message } in pinnedMessages"
            :key="`${conversation.id}-${message.id}`"
            class="flex items-center gap-4 rounded-xl border border-slate-200 p-4"
          >
            <span class="text-xl text-indigo-500" aria-hidden="true">◆</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ titleOf(conversation) }}</p>
              <p class="mt-1 break-words text-slate-700">{{ displayMessage(message) }}</p>
              <p class="mt-2 text-sm text-slate-500">{{ formatDate(message.createdAt) }}</p>
            </div>
          </article>
          <p v-if="!pinnedMessages.length" class="py-12 text-center text-slate-500">
            No pinned messages.
          </p>
        </div>

        <div v-else-if="activeTab === 'reminders'" class="space-y-4 p-5">
          <article
            v-for="reminder in upcomingReminders"
            :key="reminder.id"
            class="flex items-center gap-4 rounded-xl border border-slate-200 p-4"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-xl text-indigo-600"
            >
              ◷
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ reminder.conversationName }}</p>
              <p class="mt-1 break-words text-slate-700">{{ reminder.text }}</p>
              <p class="mt-2 text-sm text-slate-500">{{ formatDate(reminder.remindAt) }}</p>
            </div>
            <button
              type="button"
              class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              @click="openReminder(reminder)"
            >
              Open
            </button>
            <button
              type="button"
              class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              @click="reminders.remove(reminder.id)"
            >
              Delete
            </button>
          </article>
          <p v-if="!upcomingReminders.length" class="py-12 text-center text-slate-500">
            No upcoming reminders. Use “Remind me” on a message to add one.
          </p>
        </div>

        <div v-else-if="activeTab === 'mentions'" class="space-y-4 p-5">
          <article
            v-for="item in mentions"
            :key="item.id"
            class="flex items-center gap-4 rounded-xl border border-slate-200 p-4"
            :class="item.read ? '' : 'bg-indigo-50/50'"
          >
            <span
              class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700"
            >
              @
            </span>
            <button type="button" class="min-w-0 flex-1 text-left" @click="openMention(item)">
              <strong class="block truncate">{{ item.title }}</strong>
              <span class="block break-words text-slate-700">{{ item.body }}</span>
              <time class="mt-1 block text-xs text-slate-500">{{
                formatDate(item.createdAt)
              }}</time>
            </button>
            <button
              type="button"
              class="text-sm text-indigo-600 hover:underline"
              @click="activity.setRead(item.id, !item.read)"
            >
              {{ item.read ? 'Mark unread' : 'Mark read' }}
            </button>
          </article>
          <p v-if="!mentions.length" class="py-12 text-center text-slate-500">No mentions yet.</p>
        </div>

        <div v-else class="space-y-8 p-6">
          <section>
            <h2 class="mb-4 text-center text-xl font-bold">Workflow Templates</h2>
            <div class="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
              <button
                type="button"
                class="flex min-h-24 items-center gap-4 rounded-lg border border-slate-200 p-5 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
                @click="openWorkflowForm('schedule')"
              >
                <span
                  class="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-indigo-50 text-3xl text-indigo-600"
                >
                  ➤
                </span>
                <span class="min-w-0">
                  <strong class="block text-lg">Schedule Message</strong>
                  <span class="block truncate text-sm text-slate-600"
                    >Create a recurring message for a channel.</span
                  >
                </span>
              </button>
              <button
                type="button"
                class="flex min-h-24 items-center gap-4 rounded-lg border border-slate-200 p-5 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
                @click="openWorkflowForm('welcome')"
              >
                <span
                  class="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-red-50 text-3xl text-red-600"
                >
                  ◆
                </span>
                <span class="min-w-0">
                  <strong class="block text-lg">Welcome Newcomer</strong>
                  <span class="block truncate text-sm text-slate-600"
                    >Prepare a welcome message for new members.</span
                  >
                </span>
              </button>
            </div>
          </section>

          <section>
            <button
              type="button"
              class="mb-4 flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-4 text-left hover:bg-slate-50"
              :aria-expanded="allWorkflowsExpanded"
              aria-controls="all-workflows-content"
              @click="allWorkflowsExpanded = !allWorkflowsExpanded"
            >
              <span
                class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xl"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-5 w-5 transition-transform"
                  :class="allWorkflowsExpanded ? 'rotate-180' : ''"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
              <span class="text-lg font-bold">All Workflows</span>
            </button>
            <div v-if="allWorkflowsExpanded" id="all-workflows-content">
              <div class="mb-4 flex flex-wrap items-center gap-3">
                <label class="sr-only" for="workflow-search">Search workflows</label>
                <input
                  id="workflow-search"
                  v-model="workflowSearch"
                  type="search"
                  placeholder="Search"
                  class="w-full rounded border border-slate-300 px-3 py-2 md:max-w-sm"
                />
              </div>
              <div class="overflow-x-auto rounded-lg border border-slate-200">
                <table class="w-full min-w-[760px] text-left text-sm">
                  <thead class="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th class="px-4 py-3">Channels</th>
                      <th class="px-4 py-3">Type</th>
                      <th class="px-4 py-3">Schedule Time</th>
                      <th class="px-4 py-3">Time Zone</th>
                      <th class="px-4 py-3">Start Date</th>
                      <th class="px-4 py-3">End Date</th>
                      <th class="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="workflow in filteredWorkflows"
                      :key="workflow.id"
                      class="border-b border-slate-100"
                    >
                      <td class="px-4 py-3 font-medium">{{ workflow.channelName }}</td>
                      <td class="px-4 py-3">
                        {{ workflow.type === 'schedule' ? 'Schedule Message' : 'Welcome Newcomer' }}
                        <span class="block text-xs text-slate-500"
                          >{{ workflow.name }} · {{ workflow.recurrence }}</span
                        >
                      </td>
                      <td class="px-4 py-3">{{ workflow.scheduleTime }}</td>
                      <td class="px-4 py-3">{{ workflow.timeZone }}</td>
                      <td class="px-4 py-3">{{ workflow.startDate || '—' }}</td>
                      <td class="px-4 py-3">{{ workflow.endDate || '—' }}</td>
                      <td class="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          class="mr-3 text-indigo-600 hover:underline"
                          @click="activity.toggleWorkflow(workflow.id)"
                        >
                          {{ workflow.enabled ? 'Disable' : 'Enable' }}
                        </button>
                        <button
                          type="button"
                          class="text-red-600 hover:underline"
                          @click="activity.removeWorkflow(workflow.id)"
                        >
                          Delete
                        </button>
                        <span
                          class="ml-2 text-xs"
                          :class="workflow.enabled ? 'text-emerald-600' : 'text-slate-500'"
                        >
                          {{ workflow.enabled ? 'On' : 'Off' }}
                        </span>
                      </td>
                    </tr>
                    <tr v-if="!filteredWorkflows.length">
                      <td colspan="7" class="px-4 py-8 text-center text-slate-500">
                        {{ workflowSearch ? 'No matching workflows.' : 'No data available' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
      <aside
        v-if="activeThread && threadConversation"
        class="flex w-[min(420px,45vw)] min-w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white"
        aria-label="Reply thread"
      >
        <header class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
          <h2 class="mr-auto text-lg font-medium">Reply Thread</h2>
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded text-xl text-slate-700 hover:bg-slate-100"
            aria-label="Close reply thread"
            title="Close reply thread"
            @click="closeThread"
          >
            →
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto border-b border-slate-200 px-5 py-4">
          <article class="flex gap-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-sm font-semibold text-white"
            >
              {{
                initials(
                  dms.usersById[activeThread.message.from]?.name || titleOf(threadConversation),
                )
              }}
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-baseline gap-x-3">
                <strong>{{
                  dms.usersById[activeThread.message.from]?.name || titleOf(threadConversation)
                }}</strong>
                <time class="text-sm text-slate-500">{{
                  formatDate(activeThread.message.createdAt)
                }}</time>
              </div>
              <p class="mt-2 whitespace-pre-wrap break-words text-slate-700">
                {{ displayMessage(activeThread.message) }}
              </p>
            </div>
          </article>
          <div v-if="threadReplies.length" class="mt-5 space-y-4 border-t border-slate-100 pt-4">
            <article v-for="reply in threadReplies" :key="reply.id" class="flex gap-3">
              <span
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
              >
                {{ initials(dms.usersById[reply.from]?.name || 'You') }}
              </span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-baseline gap-x-3">
                  <strong>{{ dms.usersById[reply.from]?.name || 'You' }}</strong>
                  <time class="text-sm text-slate-500">{{ formatDate(reply.createdAt) }}</time>
                </div>
                <p class="mt-1 whitespace-pre-wrap break-words text-slate-700">
                  {{ displayMessage(reply) }}
                </p>
              </div>
            </article>
          </div>
        </div>
        <MessageComposer @send="sendThreadReply" />
      </aside>
    </div>

    <div
      v-if="workflowTemplate"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
      @click.self="workflowTemplate = null"
    >
      <form
        class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        @submit.prevent="saveWorkflow"
      >
        <div class="flex items-center">
          <h2 class="mr-auto text-xl font-bold">
            {{
              workflowTemplate === 'schedule'
                ? 'Schedule Message Workflow'
                : 'Welcome Newcomer Workflow'
            }}
          </h2>
          <button
            type="button"
            aria-label="Close"
            class="text-xl text-slate-500"
            @click="workflowTemplate = null"
          >
            ×
          </button>
        </div>

        <label class="block text-sm font-medium">
          Workflow name
          <input
            v-model="workflowName"
            required
            class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label class="block text-sm font-medium">
          Channel
          <select
            v-model="workflowChannelId"
            required
            class="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
          >
            <option value="" disabled>Select a channel</option>
            <option
              v-for="channel in channels.visibleChannels"
              :key="channel.id"
              :value="channel.id"
            >
              {{ channel.name }}
            </option>
          </select>
          <span v-if="!channels.visibleChannels.length" class="mt-1 block text-xs text-amber-700">
            Join a channel before creating a workflow.
          </span>
        </label>

        <label class="block text-sm font-medium">
          Message
          <textarea
            v-model="workflowMessage"
            required
            rows="3"
            class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm font-medium">
            Schedule time
            <input
              v-model="workflowSchedule"
              type="time"
              required
              class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label class="block text-sm font-medium">
            Time zone
            <select
              v-model="workflowTimeZone"
              class="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
            >
              <option>Asia/Karachi</option>
              <option>UTC</option>
              <option>America/New_York</option>
              <option>Europe/London</option>
            </select>
          </label>
          <label v-if="workflowTemplate === 'schedule'" class="block text-sm font-medium">
            Repeat
            <select
              v-model="workflowRecurrence"
              class="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label class="block text-sm font-medium">
            Start date
            <input
              v-model="workflowStartDate"
              type="date"
              class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label class="block text-sm font-medium">
            End date
            <input
              v-model="workflowEndDate"
              type="date"
              :min="workflowStartDate || undefined"
              class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <p class="text-xs text-slate-500">
          This demo saves workflow settings in this browser. It does not automatically post messages
          without a backend scheduler.
        </p>
        <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            class="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            @click="workflowTemplate = null"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="!channels.visibleChannels.length"
            class="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            Create workflow
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
