<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { UserModule } from '@/features/account'
import { useRemindersStore } from '@/features/search/reminders'
import { UserModule } from '@/features/account'
import ChatHeaderActions from '@/features/search/ChatHeaderActions.vue'
import ChannelSettingsModal from '@/features/search/ChannelSettingsModal.vue'
import RemindersPanel from '@/features/search/RemindersPanel.vue'
import SearchPage from '@/features/search/SearchPage.vue'
import SetReminderModal from '@/features/search/SetReminderModal.vue'

const ui = useUiStore()
const reminders = useRemindersStore()
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
const reminderModalOpen = ref(false)
const reminderMessage = computed(() => ({
  conversationId: selectedChannel.value?.id,
  conversationName: selectedChannel.value?.name,
  conversationType: 'channel',
  messageId: `welcome-${selectedChannel.value?.id}`,
  text: `Welcome to #${selectedChannel.value?.name}. Use this demo message to try reminders.`,
}))
const user = {
  profile: { fullName: 'Hammad Haider' },
  status: 'online',
}

onMounted(() => reminders.startWatcher())
onBeforeUnmount(() => reminders.stopWatcher())

function leaveChannel() {
  ui.selectChannel(null)
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
        <li v-for="channel in channels" :key="channel.id">
          <button
            class="w-full rounded px-2 py-1 text-left hover:bg-slate-700"
            :class="{ 'bg-slate-700 font-semibold': selectedChannelId === channel.id }"
            @click="ui.selectChannel(channel.id)"
          >
            # {{ channel.name }}
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
        <ChatHeaderActions class="ml-auto" :is-dm="!selectedChannel" />
      </header>

      <div class="flex min-h-0 flex-1">
        <section class="min-w-0 flex-1 overflow-y-auto p-6 text-slate-500">
          <template v-if="selectedChannel">
            <article class="max-w-2xl rounded-lg border border-slate-200 bg-white p-4">
              <p class="font-semibold text-slate-800">WhistleIt</p>
              <p class="mt-2 text-sm text-slate-700">{{ reminderMessage.text }}</p>
              <button
                class="mt-3 rounded border border-indigo-200 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
                @click="reminderModalOpen = true"
              >
                Remind me
              </button>
            </article>
          </template>
          <template v-else>
            <p>Choose a channel to open its tools.</p>
          </template>
        </section>

        <aside
          v-if="ui.activePanel"
          class="min-h-0 w-full shrink-0 border-l border-slate-200 bg-white md:w-[min(65vw,720px)]"
        >
          <RemindersPanel v-if="ui.activePanel === 'reminders'" />
          <SearchPage
            v-else-if="ui.activePanel === 'search'"
            :channel-id="selectedChannelId || ''"
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
    />
    <SetReminderModal
      v-if="reminderModalOpen && selectedChannel"
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
