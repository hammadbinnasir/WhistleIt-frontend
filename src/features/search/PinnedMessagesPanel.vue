<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const hasPinnedMessages = computed(() => ui.pinnedMessages.length > 0)
</script>

<template>
  <aside class="flex h-full w-full flex-col bg-white">
    <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 class="text-xl text-slate-700">Pinned Messages</h2>
      <button
        type="button"
        class="cursor-pointer text-3xl font-black text-slate-700"
        aria-label="Close pinned messages"
        @click="ui.closePanel()"
      >
        →
      </button>
    </header>

    <div
      v-if="!hasPinnedMessages"
      class="flex flex-1 flex-col items-center px-6 pt-16 text-slate-500"
    >
      <i
        class="fa-vellum fa-solid fa-thumbtack mb-6 text-[96px] text-[#8079a3]"
        aria-hidden="true"
      ></i>
      <div class="self-start text-base leading-8">
        <p class="flex gap-3"><span>•</span><span>There are no pinned messages yet.</span></p>
        <p class="flex gap-3">
          <span>•</span>
          <span
            >All members of this channel can pin important<br />or useful messages for easy
            reference.</span
          >
        </p>
      </div>
    </div>

    <ul v-else class="min-h-0 flex-1 divide-y overflow-y-auto">
      <li v-for="message in ui.pinnedMessages" :key="message.id" class="px-5 py-4">
        <p class="font-semibold text-slate-900">{{ message.author || message.sender || 'You' }}</p>
        <p class="mt-2 break-words text-slate-700">{{ message.content || message.text }}</p>
        <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{{ message.conversation?.name || '' }}</span>
          <button
            type="button"
            class="cursor-pointer text-indigo-600"
            @click="ui.togglePinnedMessage(message, message.conversation)"
          >
            Unpin
          </button>
        </div>
      </li>
    </ul>
  </aside>
</template>
