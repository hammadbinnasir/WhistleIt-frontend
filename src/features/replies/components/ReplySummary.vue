<script setup>
import { computed } from 'vue'
import { longDate } from '@/features/dms/utils/time'

defineOptions({ name: 'ReplySummary' })

// "5 replies   Last reply: Nov 02, 2026 at 1:02 PM"  — hover par card + "View thread"
const props = defineProps({
  count: { type: Number, default: 0 },
  lastReplyAt: { type: [String, Number, Date], default: null },
})
const emit = defineEmits(['open'])

const label = computed(() => `${props.count} ${props.count === 1 ? 'reply' : 'replies'}`)
const last = computed(() => longDate(props.lastReplyAt))
</script>

<template>
  <button
    v-if="count > 0"
    type="button"
    class="group/replies flex w-full items-center gap-4 rounded-md border border-transparent px-2 py-1.5 text-left transition hover:border-slate-200 hover:bg-white hover:shadow-md focus-visible:border-slate-200 focus-visible:bg-white focus-visible:shadow-md focus-visible:outline-none"
    data-test="reply-summary"
    @click="emit('open')"
  >
    <span class="font-medium text-blue-600">{{ label }}</span>
    <span v-if="last" class="text-slate-500">Last reply: {{ last }}</span>
    <span class="hidden text-blue-600 group-hover/replies:inline group-focus-visible/replies:inline">
      View thread
    </span>
  </button>
</template>