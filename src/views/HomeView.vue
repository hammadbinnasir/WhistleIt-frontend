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
