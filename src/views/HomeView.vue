<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { clearAuthSession } from '@/features/auth/session'
import { useUiStore } from '@/stores/ui'
import { UserModule } from '@/features/account'
import { useRemindersStore } from '@/features/search/reminders'
import ChatHeaderActions from '@/features/search/ChatHeaderActions.vue'
import ChannelSettingsModal from '@/features/search/ChannelSettingsModal.vue'
import RemindersPanel from '@/features/search/RemindersPanel.vue'
import SearchPage from '@/features/search/SearchPage.vue'
import SetReminderModal from '@/features/search/SetReminderModal.vue'
import { ChannelSidebar, ChannelHeader } from '@/features/channels'
import { ComposerConversation } from '@/features/composer'

const ui = useUiStore()
const router = useRouter()

// storeToRefs keeps state reactive when destructuring; actions are taken from the store directly.
const { selectedChannelId, sidebarOpen } = storeToRefs(ui)

async function logout() {
  clearAuthSession()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative flex h-screen bg-slate-50 text-slate-800">
    <!-- v-show (not v-if): the Channels dialogs live inside <ChannelSidebar />, so it must stay mounted. -->
    <aside
      v-show="sidebarOpen"
      class="relative z-10 w-64 shrink-0 overflow-y-auto border-r-2 border-indigo-400/40 bg-slate-950 p-4 text-slate-100 shadow-xl"
    >
      <h1 class="mb-4 border-b border-indigo-300/30 pb-4 text-xl font-bold text-white">
        WhistleIt
      </h1>
      <ChannelSidebar />
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <ChannelHeader v-if="selectedChannelId" :channel-id="selectedChannelId">

        <template #actions> 

          <button class="rounded border px-2 py-1 text-sm" @click="ui.toggleSidebar()">
            {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
          </button>
          <button class="rounded border px-2 py-1 text-sm" @click="logout">Log out</button>
        </template>
      </ChannelHeader>

      <header v-else class="flex items-center gap-3 border-b bg-white p-4">
        <button class="rounded border px-2 py-1 text-sm" @click="ui.toggleSidebar()">
          {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
        </button>
        <h2 class="font-semibold">Select a channel</h2>
      </header>

      <ComposerConversation />
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