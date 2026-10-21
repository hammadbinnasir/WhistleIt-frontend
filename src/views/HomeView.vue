<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
// storeToRefs keeps state reactive when destructuring; actions are taken from the store directly.
const { selectedChannelId, sidebarOpen } = storeToRefs(ui)

// Temporary demo data. Real channels will come from the API (Channels owner).
const channels = [
  { id: 'general', name: 'general' },
  { id: 'random', name: 'random' },
  { id: 'frontend', name: 'frontend-team' },
]
</script>

<template>
  <div class="flex h-screen bg-slate-50 text-slate-800">
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
        <button class="rounded border px-2 py-1 text-sm" @click="ui.toggleSidebar()">
          {{ sidebarOpen ? 'Hide' : 'Show' }} sidebar
        </button>
        <h2 class="font-semibold">
          {{ selectedChannelId ? `# ${selectedChannelId}` : 'Select a channel' }}
        </h2>
      </header>
      <section class="flex-1 p-6 text-slate-500">
        Pinia is working: this state lives in <code>src/stores/ui.js</code>.
      </section>
    </main>
  </div>
</template>
