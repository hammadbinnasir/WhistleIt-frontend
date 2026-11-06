<script setup>
import { computed, nextTick } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const polls = computed(() => ui.polls)

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

async function jumpToPoll(poll) {
  ui.closePanel()
  await nextTick()
  const target = [...document.querySelectorAll('[data-poll-title]')].find(
    (element) => element.dataset.pollTitle === poll.title,
  )
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.classList.add('poll-jump-highlight')
  setTimeout(() => target?.classList.remove('poll-jump-highlight'), 1800)
}
</script>

<template>
  <aside class="flex h-full w-full flex-col bg-white">
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
      <h2 class="text-xl font-normal text-slate-800">
        Polls in {{ polls[0]?.conversation?.name || 'this channel' }}
      </h2>
      <button
        type="button"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-indigo-50 text-slate-600 transition-colors hover:text-slate-900"
        title="Close Poll History"
        aria-label="Close poll history"
        @click="ui.closePanel()"
      >
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M5 5l14 14M19 5 5 19" />
        </svg>
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <p v-if="!polls.length" class="mt-16 text-center text-sm text-slate-500">
        No polls created in this channel yet.
      </p>

      <article
        v-for="poll in polls"
        :key="poll.id"
        class="relative border-b border-slate-200 px-5 py-5"
      >
        <p class="mb-5 text-center text-sm text-slate-600">{{ formatDate(poll.createdAt) }}</p>
        <div class="border-l-4 border-indigo-500 pl-5 pr-16">
          <h3 class="text-xl font-bold text-slate-900">{{ poll.title }}</h3>
          <p class="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <span class="text-green-600">✓</span>
            <span>{{ poll.status }}</span>
            <span>|</span>
            <span>Close at {{ formatDate(poll.createdAt) }}</span>
          </p>
        </div>
        <button
          type="button"
          class="absolute right-5 top-14 cursor-pointer rounded border border-indigo-400 px-3 py-1 text-sm font-semibold text-indigo-600"
          @click="jumpToPoll(poll)"
        >
          JUMP
        </button>
      </article>
    </div>
  </aside>
</template>

<style scoped>
:global(.poll-jump-highlight) {
  outline: 3px solid rgba(99, 102, 241, 0.35);
  outline-offset: 6px;
}
</style>
