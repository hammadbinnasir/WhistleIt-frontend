<script setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useTeamsStore } from '@/stores/teams'
import { ChannelSidebar, ChannelHeader } from '@/features/channels'
import { UserModule } from '@/features/account'

// Shell components
import {
  TeamRail,
  TeamSwitcher,
  CreateTeamModal,
  JoinTeamModal,
  HelpModal,
  MemberManageModal,
} from '@/features/shell'

const ui = useUiStore()
const teamsStore = useTeamsStore()
const router = useRouter()

const user = {
  profile: { fullName: 'Hammad Haider' },
  status: 'online',
}

// storeToRefs keeps state reactive when destructuring; actions are taken from the store directly.
const { selectedChannelId, sidebarOpen } = storeToRefs(ui)
const { activeTeam } = storeToRefs(teamsStore)

const isTeamSwitcherOpen = ref(false)

onMounted(() => {
  teamsStore.fetchTeams()
})
</script>

<template>
  <div class="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
    <!-- 1. Left-most Rail: Teams & Workspaces Switcher + Help Button -->
    <TeamRail />

    <!-- 2. Workspace Sidebar: Team Switcher + Channels + Members -->
    <aside
      v-show="sidebarOpen"
      class="w-64 shrink-0 overflow-y-auto bg-slate-900 p-4 text-slate-100 flex flex-col justify-between"
    >
      <div>
        <!-- Workspace Switcher Header -->
        <div class="relative mb-4 pb-3 border-b border-slate-800">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-800 text-left transition-colors cursor-pointer"
            :aria-expanded="isTeamSwitcherOpen"
            @click="isTeamSwitcherOpen = !isTeamSwitcherOpen"
          >
            <div class="flex items-center gap-2 min-w-0">
              <div
                class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
                :style="{ background: activeTeam?.color || '#7C3AED' }"
              >
                {{ activeTeam?.initials || 'WI' }}
              </div>
              <span class="font-bold text-base text-slate-100 truncate">
                {{ activeTeam?.name || 'WhistleIt' }}
              </span>
            </div>
            <svg
              class="text-slate-400 transition-transform duration-200 shrink-0"
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

          <!-- Dropdown TeamSwitcher -->
          <TeamSwitcher
            :is-open="isTeamSwitcherOpen"
            @close="isTeamSwitcherOpen = false"
          />
        </div>

        <!-- Channels list from Channels feature -->
        <ChannelSidebar />
      </div>
    </aside>

    <!-- 3. Main Chat Stage -->
    <main class="flex min-w-0 flex-1 flex-col">
      <ChannelHeader v-if="selectedChannelId" :channel-id="selectedChannelId">
        <template #actions>
          <button class="rounded border px-2 py-1 text-sm cursor-pointer" @click="ui.toggleSidebar()">
            {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
          </button>
        </template>
      </ChannelHeader>

      <header v-else class="flex items-center gap-3 border-b bg-white p-4">
        <button class="rounded border px-2 py-1 text-sm cursor-pointer" @click="ui.toggleSidebar()">
          {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
        </button>
        <h2 class="font-semibold text-sm">
          {{ selectedChannelId ? `# ${selectedChannelId}` : 'Select a channel' }}
        </h2>
        <ChatHeaderActions :is-dm="!selectedChannel" />
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
            <p>Pinia is working: this state lives in <code>src/stores/ui.js</code>.</p>
            <p class="mt-2 text-sm">Choose a channel to open its tools and try the search and reminder features.</p>
          </template>
        </section>

        <aside v-if="ui.activePanel" class="min-h-0 w-full shrink-0 border-l border-slate-200 bg-white md:w-[min(65vw,720px)]">
          <RemindersPanel v-if="ui.activePanel === 'reminders'" />
          <SearchPage v-else-if="ui.activePanel === 'search'" :channel-id="selectedChannelId || ''" />
        </aside>
      </div>
    </main>

    <ChannelSettingsModal
      v-if="ui.channelSettingsOpen && selectedChannel"
      :channel="selectedChannel"
      @toggle-mute="selectedChannel.muted = !selectedChannel.muted"
      @toggle-favourite="selectedChannel.favourite = !selectedChannel.favourite"
      @left="ui.selectChannel(null)"
    />
    <SetReminderModal
      v-if="reminderModalOpen && selectedChannel"
      :message="reminderMessage"
      @close="reminderModalOpen = false"
    />

    <div class="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      <div v-for="toast in ui.toasts" :key="toast.id" class="rounded-lg bg-slate-900 p-4 text-white shadow-lg">
        <p class="font-semibold">{{ toast.title }}</p>
        <p class="mt-1 text-sm text-slate-200">{{ toast.body }}</p>
      </div>
    </div>
        <RouterLink class="ml-auto rounded border px-3 py-1 text-sm hover:bg-slate-50" to="/login">
          Back to login
        </RouterLink>
      </header>

      <section class="flex-1 p-6 text-slate-500">
        <!-- Messages module mounts here. -->
      </section>
    </main>

    <!-- UserModule from Account team -->
    <UserModule :user="user" @log-out="router.push('/login')" />

    <!-- Shell Modals -->
    <CreateTeamModal />
    <JoinTeamModal />
    <HelpModal />
    <MemberManageModal />
  </div>
</template>
