<script setup>
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { clearAuthSession } from '@/features/auth/session'
import { useUiStore } from '@/stores/ui'
import { ChannelSidebar, ChannelHeader } from '@/features/channels'

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
  <div class="flex h-screen bg-slate-50 text-slate-800">
    <!-- v-show (not v-if): the Channels dialogs live inside <ChannelSidebar />, so it must stay mounted. -->
    <aside
      v-show="sidebarOpen"
      class="w-64 shrink-0 overflow-y-auto bg-slate-900 p-4 text-slate-100"
    >
      <h1 class="mb-4 text-xl font-bold">WhistleIt</h1>
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
        <h2 class="font-semibold">
          {{ selectedChannelId ? `# ${selectedChannelId}` : 'Select a channel' }}
        </h2>
        <button class="ml-auto rounded border px-3 py-1 text-sm hover:bg-slate-50" @click="logout">
          Log out
        </button>
        <h2 class="font-semibold">Select a channel</h2>
      </header>

      <section class="flex-1 p-6 text-slate-500">
        <!-- Messages module mounts here. -->
      </section>
    </main>
  </div>
</template>
