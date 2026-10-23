<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { UserModule } from '@/features/account'
import { useSearchStore } from '@/features/search/search.store'
import { useRemindersStore } from '@/features/search/reminders'
import ChatHeaderActions from '@/features/search/ChatHeaderActions.vue'
import ChannelSettingsModal from '@/features/search/ChannelSettingsModal.vue'
import RemindersPanel from '@/features/search/RemindersPanel.vue'
import SearchPage from '@/features/search/SearchPage.vue'
import SetReminderModal from '@/features/search/SetReminderModal.vue'

const ui = useUiStore()
const reminders = useRemindersStore()
const search = useSearchStore()
const router = useRouter()
const { selectedChannelId, sidebarOpen } = storeToRefs(ui)

const channels = ref([
  {
    id: 'general',
    name: 'general',
    description: 'General discussion',
    createdBy: 'WhistleIt team',
    muted: false,
    favourite: false,
  },
  {
    id: 'random',
    name: 'random',
    description: 'Off-topic conversations',
    createdBy: 'WhistleIt team',
    muted: false,
    favourite: false,
  },
  {
    id: 'frontend',
    name: 'frontend-team',
    description: 'Frontend team updates',
    createdBy: 'WhistleIt team',
    muted: false,
    favourite: false,
  },
])

const selectedChannel = computed(() =>
  channels.value.find((channel) => channel.id === selectedChannelId.value),
)
const sortedChannels = computed(() =>
  [...channels.value].sort((first, second) => Number(second.favourite) - Number(first.favourite)),
)
const reminderModalOpen = ref(false)
const currentConversationId = computed(() => selectedChannel.value?.id || 'dm-hammad')
const conversationMessages = computed(() =>
  search.messages.filter((message) => message.conversationId === currentConversationId.value),
)
const reminderMessage = ref(null)
const user = {
  profile: { fullName: 'Hammad Haider' },
  status: 'online',
}

onMounted(() => {
  reminders.startWatcher()
  if (!selectedChannelId.value) ui.selectChannel('frontend')
})
onBeforeUnmount(() => reminders.stopWatcher())

function leaveChannel() {
  if (selectedChannel.value)
    channels.value = channels.value.filter((channel) => channel.id !== selectedChannel.value.id)
  ui.selectChannel(null)
  ui.channelSettingsOpen = false
}

function updateChannel(updates) {
  if (!selectedChannel.value) return
  Object.assign(selectedChannel.value, updates)
}

function openReminder(message) {
  reminderMessage.value = {
    ...message,
    conversationId: currentConversationId.value,
    conversationName: selectedChannel.value?.name || 'Hammad Bin Nasir',
    conversationType: selectedChannel.value ? 'channel' : 'dm',
    messageId: message.id,
  }
  reminderModalOpen.value = true
}
</script>

<template>
  <div class="relative flex h-screen bg-slate-50 text-slate-800">
    <aside
      v-if="sidebarOpen"
      class="w-64 shrink-0 overflow-y-auto bg-slate-900 p-4 text-slate-100"
    >
      <h1 class="mb-4 text-xl font-bold">WhistleIt</h1>
      <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">Channels</p>
      <ul class="space-y-1">
        <li v-for="channel in sortedChannels" :key="channel.id">
          <button
            class="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-700"
            :class="{ 'bg-slate-700 font-semibold': selectedChannelId === channel.id }"
            @click="ui.selectChannel(channel.id)"
          >
            <span class="truncate"># {{ channel.name }}</span>
            <span v-if="channel.favourite" class="ml-2 text-amber-300" aria-label="Favourite channel">★</span>
            <span v-else-if="channel.muted" class="ml-2 text-slate-400" title="Muted">M</span>
          </button>
        </li>
        <li class="mt-5 border-t border-slate-700 pt-3">
          <p class="mb-2 px-2 text-xs uppercase tracking-wide text-slate-400">Direct messages</p>
          <button
            class="w-full rounded px-2 py-1 text-left hover:bg-slate-700"
            :class="{ 'bg-slate-700 font-semibold': !selectedChannel }"
            @click="ui.selectChannel(null)"
          >
            Hammad Bin Nasir
          </button>
        </li>
      </ul>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center gap-3 border-b bg-white p-4">
        <button class="rounded border px-2 py-1 text-sm" @click="ui.toggleSidebar()">
          {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
        </button>
        <h2 v-if="selectedChannel" class="min-w-0 flex-1 truncate font-semibold">
          # {{ selectedChannel.name }}
        </h2>
        <h2 v-else class="min-w-0 flex-1 truncate font-semibold">Hammad Bin Nasir</h2>
        <ChatHeaderActions class="ml-auto" :is-dm="!selectedChannel" />
      </header>

      <div class="flex min-h-0 flex-1">
        <section class="min-w-0 flex-1 overflow-y-auto bg-slate-50 p-6 text-slate-600">
          <div class="mx-auto flex max-w-3xl flex-col gap-4">
            <article
              v-for="message in conversationMessages"
              :key="message.id"
              class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p class="font-semibold text-slate-800">{{ message.authorName }}</p>
                <time class="text-xs text-slate-400">{{ new Date(message.createdAt).toLocaleString() }}</time>
              </div>
              <p class="mt-2 text-sm text-slate-700">{{ message.text }}</p>
              <ul v-if="message.attachments?.length" class="mt-3 flex flex-wrap gap-2">
                <li v-for="file in message.attachments" :key="file.id">
                  <a class="rounded border border-slate-200 px-2 py-1 text-xs text-indigo-600" :href="file.url" target="_blank" rel="noreferrer">
                    {{ file.name }}
                  </a>
                </li>
              </ul>
              <button
                class="mt-3 rounded border border-indigo-200 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
                @click="openReminder(message)"
              >
                Remind me
              </button>
            </article>
            <article v-if="!conversationMessages.length" class="rounded-lg border border-slate-200 bg-white p-6 text-sm">
              No messages yet. Start a conversation to see messages here.
            </article>
          </div>
        </section>

        <aside
          v-if="ui.activePanel"
          class="min-h-0 w-full shrink-0 border-l border-slate-200 bg-white md:w-[min(65vw,720px)]"
        >
          <RemindersPanel v-if="ui.activePanel === 'reminders'" @close="ui.activePanel = null" />
          <SearchPage
            v-else-if="ui.activePanel === 'search'"
            :channel-id="currentConversationId"
            @close="ui.activePanel = null"
          />
        </aside>
      </div>
    </main>

    <ChannelSettingsModal
      v-if="ui.channelSettingsOpen && selectedChannel"
      :channel="selectedChannel"
      @toggle-mute="selectedChannel.muted = !selectedChannel.muted"
      @toggle-favourite="selectedChannel.favourite = !selectedChannel.favourite"
      @left="leaveChannel"
      @close="ui.channelSettingsOpen = false"
      @update-channel="updateChannel"
    />
    <SetReminderModal
      v-if="reminderModalOpen && reminderMessage"
      :message="reminderMessage"
      @close="reminderModalOpen = false"
    />

    <div class="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="rounded-lg bg-slate-900 p-4 text-white shadow-lg"
      >
        <p class="font-semibold">{{ toast.title }}</p>
        <p class="mt-1 text-sm text-slate-200">{{ toast.body }}</p>
      </div>
    </div>

    <UserModule :user="user" @log-out="router.push('/login')" />
  </div>
</template>
