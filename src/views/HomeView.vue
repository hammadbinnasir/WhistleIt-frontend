<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

// Stores
import { useUiStore } from '@/stores/ui'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'
import { useChannelsStore } from '@/features/channels'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore, STATES } from '@/features/dms/stores/presence'
import { useActivityStore } from '@/stores/activity'
import { useRemindersStore } from '@/features/search/reminders'
import { useUserStore, UserModule } from '@/features/account'
import { clearAuthSession, getAuthUser } from '@/features/auth/session'
import { logout as logoutRequest } from '@/features/auth/api'

// Shell
import {
  TeamRail,
  TeamSwitcher,
  CreateTeamModal,
  CreateWorkspaceModal,
  JoinTeamModal,
  HelpModal,
  MemberManageModal,
} from '@/features/shell'

// Channels
import { ChannelSidebar, ChannelHeader } from '@/features/channels'

// Direct Messages
import DmList from '@/features/dms/components/DmList.vue'
import ActivityFeed from '@/features/dms/components/ActivityFeed.vue'
import PresenceDot from '@/features/dms/components/PresenceDot.vue'

// Composer
import { ComposerConversation } from '@/features/composer'

// Search & Reminders
import ChatHeaderActions from '@/features/search/ChatHeaderActions.vue'
import ChannelSettingsModal from '@/features/search/ChannelSettingsModal.vue'
import RemindersPanel from '@/features/search/RemindersPanel.vue'
import PinnedMessagesPanel from '@/features/search/PinnedMessagesPanel.vue'
import SearchPage from '@/features/search/SearchPage.vue'
import PollHistoryPanel from '@/features/search/PollHistoryPanel.vue'
import SetReminderModal from '@/features/search/SetReminderModal.vue'

const router = useRouter()
const ui = useUiStore()
const teamsStore = useTeamsStore()
const membersStore = useMembersStore()
const channelsStore = useChannelsStore()
const dms = useDmStore()
const presence = usePresenceStore()
const activity = useActivityStore()
const remindersStore = useRemindersStore()
const userStore = useUserStore()
const authenticatedUser = getAuthUser()

if (!userStore.state.profile.fullName && authenticatedUser?.fullName) {
  userStore.hydrate({ profile: { fullName: authenticatedUser.fullName } })
}

const { selectedChannelId, sidebarOpen } = storeToRefs(ui)
const { activeId: activeDmId } = storeToRefs(dms)
const { activeTeam, activeWorkspace } = storeToRefs(teamsStore)

const isTeamSwitcherOpen = ref(false)
const reminderModalOpen = ref(false)
const activeConversation = computed(
  () => dms.conversations.find((conversation) => conversation.id === activeDmId.value) || null,
)
const activeConversationPartnerId = computed(() =>
  activeConversation.value?.type === 'dm' ? dms.partnerId(activeConversation.value) : null,
)
const activeConversationPresence = computed(() =>
  activeConversationPartnerId.value
    ? presence.stateOf(activeConversationPartnerId.value)
    : null,
)
const activeConversationIsFavorite = computed(() =>
  activeConversation.value ? dms.isFavorite(activeConversation.value.id) : false,
)

const user = computed(() => ({
  profile: {
    ...userStore.state?.profile,
    fullName: userStore.state?.profile?.fullName || authenticatedUser?.fullName || '',
  },
  status: userStore.state?.status || 'online',
  customStatus: userStore.state?.customStatus,
}))

function onAccountSettingsSaved(payload) {
  const messages = {
    added: 'Profile picture updated',
    removed: 'Profile picture removed',
  }
  const message = messages[payload.photoAction]
  if (message) ui.toast('Success!', message, 'success')
}

function onAccountError(error) {
  ui.toast('Account error', error?.message || 'The account request failed.', 'error')
}

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

async function toggleChannelMute() {
  if (!selectedChannel.value) return
  try {
    await channelsStore.toggleMute(selectedChannel.value.id)
  } catch (error) {
    ui.toast('Unable to update mute setting', error?.message || 'Please try again.', 'error')
  }
}

async function toggleChannelFavorite() {
  if (!selectedChannel.value) return
  try {
    await channelsStore.toggleFavorite(selectedChannel.value.id)
  } catch (error) {
    ui.toast('Unable to update favorite setting', error?.message || 'Please try again.', 'error')
  }
}

async function logout() {
  try {
    await logoutRequest()
  } catch (error) {
    ui.toast(
      'Unable to log out from server',
      error?.message || 'Your local session was cleared.',
      'error',
    )
  } finally {
    clearAuthSession()
    await router.push({ name: 'login' })
  }
}

onMounted(async () => {
  void activity.init()
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
    <TeamRail>
      <template #footer>
        <UserModule
          :user="user"
          :avatar-size="32"
          :fixed="false"
          @log-out="logout"
          @settings-saved="onAccountSettingsSaved"
          @error="onAccountError"
        />
      </template>
    </TeamRail>

    <!-- 2. Workspace Sidebar: Header Switcher + Activities + Channels + Direct Messages -->
    <aside
      v-show="sidebarOpen && ui.activePanel !== 'activity'"
      class="flex w-64 shrink-0 flex-col justify-between overflow-hidden bg-[#22123b] text-slate-100"
    >
      <div class="flex flex-1 flex-col overflow-y-auto">
        <!-- Team / Workspace Header Switcher -->
        <div class="relative border-b border-purple-900/40 p-3">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
            aria-haspopup="menu"
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
          :class="{ 'bg-white/10 text-white': ui.activePanel === 'activity' }"
          :aria-pressed="ui.activePanel === 'activity'"
          @click="ui.activePanel = ui.activePanel === 'activity' ? null : 'activity'"
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
          <span
            v-if="activity.unreadCount"
            class="ml-auto rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white"
          >
            {{ activity.unreadCount }}
          </span>
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
      <section
        v-if="!teamsStore.loading && !teamsStore.error && !activeTeam"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        aria-labelledby="workspace-empty-title"
      >
        <div class="max-w-lg space-y-2">
          <h1 id="workspace-empty-title" class="text-xl font-semibold text-slate-800">
            {{
              activeWorkspace ? `Welcome to ${activeWorkspace.name}` : 'Create your first workspace'
            }}
          </h1>
          <p class="text-sm text-slate-600">
            {{
              activeWorkspace
                ? 'This workspace does not have any teams yet.'
                : 'Create a workspace to start organizing teams and conversations.'
            }}
          </p>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <template v-if="activeWorkspace">
            <button
              type="button"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              @click="ui.toggleTeamCreateModal()"
            >
              Create a team
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              @click="ui.toggleTeamJoinModal()"
            >
              Join a team
            </button>
          </template>
          <button
            v-else
            type="button"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            @click="ui.toggleWorkspaceCreateModal()"
          >
            Create a workspace
          </button>
        </div>
      </section>

      <ActivityFeed v-else-if="ui.activePanel === 'activity'" class="min-h-0 flex-1" />

      <template v-else>
        <!-- Channel or Conversation Header -->
        <ChannelHeader
          v-if="selectedChannelId && !activeConversation"
          :channel-id="selectedChannelId"
          @members-click="ui.openChannelSettings('members')"
        >
          <template #actions>
            <ChatHeaderActions :is-dm="false" />
          </template>
        </ChannelHeader>

        <header
          v-else-if="activeConversation"
          class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <button
                v-if="activeConversationPartnerId"
                type="button"
                class="shrink-0 rounded p-0.5 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                :class="activeConversationIsFavorite ? 'text-indigo-500' : 'text-slate-400'"
                :aria-label="activeConversationIsFavorite ? 'Remove from favorites' : 'Add to favorites'"
                :aria-pressed="activeConversationIsFavorite"
                @click="dms.toggleFavorite(activeConversation.id)"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  :fill="activeConversationIsFavorite ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"
                  />
                </svg>
              </button>
              <div class="min-w-0">
                <h1 class="truncate text-lg font-semibold text-slate-800">
                  {{ dms.titleOf(activeConversation) }}
                </h1>
                <p
                  v-if="activeConversationPartnerId && !presence.loading && !presence.error"
                  class="flex items-center gap-1.5 text-xs text-slate-500"
                  :aria-label="STATES[activeConversationPresence]"
                >
                  <PresenceDot
                    :state="activeConversationPresence"
                    :size="9"
                    ring="border-white"
                  />
                  {{ STATES[activeConversationPresence] }}
                </p>
                <p v-else class="text-xs text-slate-500">
                  {{ activeConversationPartnerId ? 'Direct message' : 'Group direct message' }}
                </p>
              </div>
            </div>
          </div>
          <ChatHeaderActions :is-dm="true" />
        </header>

        <header
          v-else-if="!selectedChannelId"
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
            <ComposerConversation
              :conversation-id="activeConversation?.id || selectedChannelId"
              :conversation-type="activeConversation ? 'dm' : 'channel'"
            />
          </section>

          <!-- Side Drawer: Reminders or Search -->
          <aside
            v-if="ui.activePanel"
            class="min-h-0 w-full shrink-0 border-l border-slate-200 bg-white md:w-[min(450px,40vw)] shadow-lg"
          >
            <RemindersPanel v-if="ui.activePanel === 'reminders'" />
            <PinnedMessagesPanel v-else-if="ui.activePanel === 'pinned'" />
            <PollHistoryPanel v-else-if="ui.activePanel === 'poll-history'" />
            <SearchPage
              v-else-if="ui.activePanel === 'search'"
              :channel-id="selectedChannelId || ''"
            />
          </aside>
        </div>
      </template>
    </main>

    <!-- Channel Settings Modal -->
    <ChannelSettingsModal
      v-if="ui.channelSettingsOpen && selectedChannel"
      :channel="selectedChannel"
      @toggle-mute="toggleChannelMute"
      @toggle-favourite="toggleChannelFavorite"
      @show-polls="ui.openPanel('poll-history')"
      @left="ui.selectChannel(null)"
      @close="ui.channelSettingsOpen = false"
    />

    <!-- Set Reminder Modal -->
    <SetReminderModal
      v-if="reminderModalOpen && reminderMessage"
      :message="reminderMessage"
      @close="reminderModalOpen = false"
    />

    <!-- Toast Notifications -->
    <div class="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="flex items-center gap-3 rounded-lg p-4 shadow-lg"
        :class="
          toast.type === 'success'
            ? 'border-t-4 border-emerald-400 bg-white text-slate-700'
            : 'bg-slate-900 text-white'
        "
      >
        <svg
          v-if="toast.type === 'success'"
          class="h-5 w-5 shrink-0 text-emerald-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ toast.title }}</p>
          <p
            class="mt-1 text-sm"
            :class="toast.type === 'success' ? 'text-slate-500' : 'text-slate-200'"
          >
            {{ toast.body }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 text-slate-400 hover:text-slate-700"
          aria-label="Dismiss notification"
          @click="ui.dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Account UserModule (Pinned to bottom-left of TeamRail) -->
    <UserModule
      :user="user"
      :avatar-size="32"
      @log-out="logout"
      @settings-saved="onAccountSettingsSaved"
      @error="onAccountError"
    />

    <!-- Shell Modals -->
    <CreateWorkspaceModal />
    <CreateTeamModal />
    <JoinTeamModal />
    <HelpModal />
    <MemberManageModal />
  </div>
</template>
