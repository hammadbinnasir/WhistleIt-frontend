<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

// Stores
import { useUiStore } from '@/stores/ui'
import { useTeamsStore } from '@/stores/teams'
import { useRemindersStore } from '@/features/search'
import { ChannelSidebar, ChannelHeader } from '@/features/channels'
import { UserModule } from '@/features/account'

// Search & Reminder components
import {
  ChatHeaderActions,
  ChannelSettingsModal,
  RemindersPanel,
  SearchPage,
  SetReminderModal,
} from '@/features/search'

// Shell
import {
  TeamRail,
  TeamSwitcher,
  CreateTeamModal,
  JoinTeamModal,
  HelpModal,
  MemberManageModal,
} from '@/features/shell'

// Channels
import { ChannelSidebar, ChannelHeader } from '@/features/channels'

// Direct Messages
import DmList from '@/features/dms/components/DmList.vue'

// Composer
import { ComposerConversation } from '@/features/composer'

// Search & Reminders
import ChatHeaderActions from '@/features/search/ChatHeaderActions.vue'
import ChannelSettingsModal from '@/features/search/ChannelSettingsModal.vue'
import RemindersPanel from '@/features/search/RemindersPanel.vue'
import SearchPage from '@/features/search/SearchPage.vue'
import SetReminderModal from '@/features/search/SetReminderModal.vue'

// Account
import { UserModule } from '@/features/account'

const router = useRouter()
const ui = useUiStore()
const teamsStore = useTeamsStore()
const membersStore = useMembersStore()
const channelsStore = useChannelsStore()
const remindersStore = useRemindersStore()
const userStore = useUserStore()

const { selectedChannelId, sidebarOpen } = storeToRefs(ui)
const { activeTeam } = storeToRefs(teamsStore)

const isTeamSwitcherOpen = ref(false)
const reminderModalOpen = ref(false)

const user = computed(() => ({
  profile: {
    fullName: userStore.state.profile.fullName || 'Hammad Haider',
    ...userStore.state.profile,
  },
  status: userStore.state.status || 'online',
  customStatus: userStore.state.customStatus,
}))

const selectedChannel = computed(() => {
  if (!selectedChannelId.value) return null
  const ch = channelsStore.getById(selectedChannelId.value)
  if (!ch) {
    return {
      id: String(selectedChannelId.value),
      name: String(selectedChannelId.value),
      description: '',
      createdBy: 'Team Member',
      muted: false,
      favourite: false,
    }
  }
  return {
    id: ch.id,
    name: ch.name,
    description: ch.description || '',
    createdBy: ch.createdBy || 'Team Member',
    muted: ch.isMuted || false,
    favourite: ch.isFavorite || false,
  }
})

const reminderMessage = computed(() => ({
  conversationId: selectedChannel.value?.id || 'general',
  conversationName: selectedChannel.value?.name || 'General',
  conversationType: 'channel',
  messageId: `msg-${Date.now()}`,
  text: selectedChannel.value
    ? `Welcome to #${selectedChannel.value.name}. Use this demo message to try reminders.`
    : 'Welcome to WhistleIt.',
}))

async function logout() {
  clearAuthSession()
  await router.push({ name: 'login' })
}

onMounted(async () => {
  await teamsStore.fetchTeams()
  if (teamsStore.activeTeamId) {
    await membersStore.fetchMembers(teamsStore.activeTeamId)
  }
  remindersStore.startWatcher()
})

onBeforeUnmount(() => {
  remindersStore.stopWatcher()
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
    <!-- 1. Leftmost Rail: Workspace/Teams Switcher & Bottom User Profile -->
    <TeamRail />

    <!-- 2. Workspace Sidebar: Header Switcher + Activities + Channels + Direct Messages -->
    <aside
      v-show="sidebarOpen"
      class="flex w-64 shrink-0 flex-col justify-between overflow-hidden bg-[#22123b] text-slate-100"
    >
      <div class="flex flex-1 flex-col overflow-y-auto">
        <!-- Team / Workspace Header Switcher -->
        <div class="relative border-b border-purple-900/40 p-3">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
            :aria-expanded="isTeamSwitcherOpen"
            @click="isTeamSwitcherOpen = !isTeamSwitcherOpen"
          >
            <div class="flex min-w-0 items-center gap-2">
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                :style="{ background: activeTeam?.color || '#7C3AED' }"
              >
                {{ activeTeam?.initials || 'WI' }}
              </div>
              <span class="truncate text-base font-bold text-white">
                {{ activeTeam?.name || 'WhistleIt' }}
              </span>
            </div>
            <svg
              class="shrink-0 text-slate-400 transition-transform duration-200"
              :class="{ 'rotate-180': isTeamSwitcherOpen }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <TeamSwitcher :is-open="isTeamSwitcherOpen" @close="isTeamSwitcherOpen = false" />
        </div>

        <!-- Activities row -->
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg
            class="h-4 w-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>Activities</span>
        </button>

        <!-- Channels List -->
        <ChannelSidebar />

        <!-- Direct Messages List -->
        <div class="mt-2 border-t border-purple-900/30 pt-2">
          <DmList />
        </div>
      </div>
    </aside>

    <!-- 3. Main Chat Stage -->
    <main class="flex min-w-0 flex-1 flex-col bg-white">
      <!-- Channel or Conversation Header -->
      <ChannelHeader
        v-if="selectedChannelId"
        :channel-id="selectedChannelId"
        @members-click="ui.toggleMemberManageModal()"
      >
        <template #actions>
          <ChatHeaderActions :is-dm="false" />
        </template>
      </ChannelHeader>

      <header
        v-else
        class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3"
      >
        <div class="flex items-center gap-3">
          <button
            class="cursor-pointer rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            @click="ui.toggleSidebar()"
          >
            {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
          </button>
          <h2 class="text-sm font-semibold text-slate-700">Select a channel</h2>
        </div>
        <ChatHeaderActions :is-dm="true" />
      </header>

      <!-- Chat area with composer & optional side panel -->
      <div class="flex min-h-0 flex-1">
        <section class="flex min-w-0 flex-1 flex-col">
          <ComposerConversation />
        </section>

        <!-- Side Drawer: Reminders or Search -->
        <aside
          v-if="ui.activePanel"
          class="min-h-0 w-full shrink-0 border-l border-slate-200 bg-white md:w-[min(450px,40vw)] shadow-lg"
        >
          <RemindersPanel v-if="ui.activePanel === 'reminders'" />
          <SearchPage
            v-else-if="ui.activePanel === 'search'"
            :channel-id="selectedChannelId || ''"
          />
        </aside>
      </div>
    </main>

    <!-- Channel Settings Modal -->
    <ChannelSettingsModal
      v-if="ui.channelSettingsOpen && selectedChannel"
      :channel="selectedChannel"
      @toggle-mute="selectedChannel.muted = !selectedChannel.muted"
      @toggle-favourite="selectedChannel.favourite = !selectedChannel.favourite"
      @left="ui.selectChannel(null)"
    />

    <!-- Set Reminder Modal -->
    <SetReminderModal
      v-if="reminderModalOpen && selectedChannel"
      :message="reminderMessage"
      @close="reminderModalOpen = false"
    />

    <!-- Toast Notifications -->
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

    <!-- Account UserModule (Pinned to bottom-left of TeamRail) -->
    <UserModule :user="user" @log-out="logout" />

    <!-- Shell Modals -->
    <CreateTeamModal />
    <JoinTeamModal />
    <HelpModal />
    <MemberManageModal />
  </div>
</template>
