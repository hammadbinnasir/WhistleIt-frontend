<script setup>

import { storeToRefs } from 'pinia'
<<<<<<< Updated upstream
import { useUiStore } from '@/stores/ui'
=======

import { RouterLink } from 'vue-router'

import { useUiStore } from '@/stores/ui'

import { ChannelSidebar, ChannelHeader } from '@/features/channels'
>>>>>>> Stashed changes

import { ComposerConversation } from '@/features/composer'



const ui = useUiStore()

// storeToRefs keeps state reactive when destructuring; actions are taken from the store directly.

const { selectedChannelId, sidebarOpen } = storeToRefs(ui)

<<<<<<< Updated upstream
// Temporary demo data. Real channels will come from the API (Channels owner).
const channels = [
  { id: 'general', name: 'general' },
  { id: 'random', name: 'random' },
  { id: 'frontend', name: 'frontend-team' },
]
=======
>>>>>>> Stashed changes
</script>



<template>

  <div class="flex h-screen bg-slate-50 text-slate-800">
<<<<<<< Updated upstream
    <aside v-if="sidebarOpen" class="w-64 shrink-0 bg-slate-900 p-4 text-slate-100">
      <h1 class="mb-4 text-xl font-bold">WhistleIt</h1>
      <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">Channels</p>
      <ul class="space-y-1">
        <li v-for="c in channels" :key="c.id">
          <button
            class="w-full rounded px-2 py-1 text-left hover:bg-slate-700"
            :class="{ 'bg-slate-700 font-semibold': selectedChannelId === c.id }"
            @click="ui.selectChannel(c.id)"
          >
            # {{ c.name }}
          </button>
        </li>
      </ul>
    </aside>

    <main class="flex flex-1 flex-col">
      <header class="flex items-center gap-3 border-b bg-white p-4">
=======

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

        </template>

      </ChannelHeader>



      <header v-else class="flex items-center gap-3 border-b bg-white p-4">

>>>>>>> Stashed changes
        <button class="rounded border px-2 py-1 text-sm" @click="ui.toggleSidebar()">

          {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar

        </button>

        <h2 class="font-semibold">

          {{ selectedChannelId ? `# ${selectedChannelId}` : 'Select a channel' }}

        </h2>
<<<<<<< Updated upstream
      </header>
      <section class="flex-1 p-6 text-slate-500">
        Pinia is working: this state lives in <code>src/stores/ui.js</code>.
      </section>
=======

        <RouterLink class="ml-auto rounded border px-3 py-1 text-sm hover:bg-slate-50" to="/login">

          Back to login

        </RouterLink>

        <h2 class="font-semibold">Select a channel</h2>

      </header>



      <ComposerConversation />

>>>>>>> Stashed changes
    </main>

  </div>

</template>

