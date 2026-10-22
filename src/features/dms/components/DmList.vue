<script setup>
import { ref } from 'vue'
import { useDmStore } from '@/stores/dms'
import DmListItem from './DmListItem.vue'
import NewDmPanel from './NewDmPanel.vue'

const dms = useDmStore()
const open = ref(true)
const panelOpen = ref(false)
</script>

<template>
  <section>
    <header class="flex items-center justify-between px-4 py-2 text-white">
      <button class="flex items-center gap-2 font-semibold" @click="open = !open">
        <svg
          class="h-4 w-4 transition-transform"
          :class="open ? '' : 'rotate-180'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 15 12 9 18 15" />
        </svg>
        Direct Messages
      </button>

      <button class="text-3xl leading-none hover:text-indigo-300" title="New message" @click="panelOpen = true">+</button>
    </header>

    <NewDmPanel v-if="panelOpen" @close="panelOpen = false" />

    <template v-if="open">
      <p v-if="dms.loading" class="px-4 py-1.5 text-sm text-slate-400">Loading…</p>

      <p v-else-if="dms.error" class="px-4 py-1.5 text-sm text-slate-400">
        {{ dms.error }}
        <button class="underline" @click="dms.init()">Retry</button>
      </p>

      <DmListItem
        v-for="c in dms.sorted"
        :key="c.id"
        :conversation="c"
        :active="c.id === dms.activeId"
        @select="dms.openConversation"
        @close="dms.closeConversation"
      />
    </template>
  </section>
</template>