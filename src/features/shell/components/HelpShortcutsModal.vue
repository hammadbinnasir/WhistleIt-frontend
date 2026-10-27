<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { shortcutColumns } from '../help/helpContent'

// The "Keyboard Shortcuts" dialog opened by the keyboard icon in the Help header.
// The list of shortcuts lives in help/helpContent.js.
const emit = defineEmits(['close'])

const closeButton = ref(null)
// Where focus was before the dialog opened, so closing it puts focus back there.
const opener = document.activeElement

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  opener?.focus?.()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      @click.self="emit('close')"
    >
      <div
        class="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-shortcuts-title"
      >
        <button
          ref="closeButton"
          type="button"
          class="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-slate-700 transition-colors hover:bg-indigo-100"
          aria-label="Close"
          @click="emit('close')"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <h2
          id="help-shortcuts-title"
          class="flex items-center justify-center gap-2 px-8 pt-8 pb-4 text-xl font-medium text-slate-800"
        >
          Keyboard Shortcuts
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-semibold text-white">
              Ctrl
            </kbd>
            <kbd class="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-semibold text-white">/</kbd>
          </span>
        </h2>

        <div
          class="grid flex-1 grid-cols-1 gap-x-10 gap-y-6 overflow-y-auto px-8 pb-8 md:grid-cols-2"
        >
          <section v-for="column in shortcutColumns" :key="column.title">
            <h3 class="mb-2 text-2xl font-semibold text-slate-700">{{ column.title }}</h3>

            <div v-for="group in column.groups" :key="group.title || 'main'" class="mb-4">
              <h4 v-if="group.title" class="mb-2 text-base font-semibold text-slate-700">
                {{ group.title }}
              </h4>
              <ul class="space-y-2 border-l-2 border-slate-700 pl-4">
                <li
                  v-for="item in group.items"
                  :key="item.label"
                  class="flex flex-wrap items-center gap-1.5 text-slate-500"
                >
                  <span>{{ item.label }}:</span>
                  <kbd
                    v-for="key in item.keys"
                    :key="key"
                    class="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-semibold text-white"
                  >
                    {{ key }}
                  </kbd>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
