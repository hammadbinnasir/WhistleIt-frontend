<script setup>
defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'close'])
</script>

<template>
  <div
    class="group flex items-center justify-between px-3 py-1.5 mx-2 rounded-md cursor-pointer transition-colors text-sm"
    :class="
      active
        ? 'bg-indigo-600/60 text-white font-medium'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'
    "
    role="button"
    :aria-selected="active"
    @click="emit('select', conversation.id)"
  >
    <div class="flex items-center gap-2.5 min-w-0">
      <!-- Person silhouette with status dot -->
      <div class="relative shrink-0 flex items-center justify-center">
        <svg
          class="w-4 h-4"
          :class="conversation.status === 'online' ? 'text-emerald-400' : 'text-slate-400'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span
          class="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-slate-900"
          :class="conversation.status === 'online' ? 'bg-emerald-500' : 'bg-slate-500'"
        />
      </div>

      <span class="truncate text-xs font-normal">
        {{ conversation.name }}
      </span>
    </div>

    <button
      class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white p-0.5 rounded transition-opacity"
      title="Close conversation"
      aria-label="Close conversation"
      @click.stop="emit('close', conversation.id)"
    >
      <svg
        class="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
</template>
