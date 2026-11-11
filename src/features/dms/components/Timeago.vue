<script setup>
import { computed, ref } from 'vue'
import { fullDate, parseDate, timeAgo, useNow } from '@/features/dms/utils/time'

defineOptions({ name: 'TimeAgo' })

// "3 days ago" (7 din se purana: "Oct 26th at 4:27 PM") dikhata hai;
// mouse le jane ya click karne par "Today at 3:33:57 PM" / "Oct 26th at 4:27:28 PM".
// Har 30 sec khud update ("just now" -> "1 minute ago" ...)
const props = defineProps({
  value: { type: [String, Number, Date], default: null },
})

const now = useNow()
const hover = ref(false)
const pinned = ref(false) // click se khula (mobile/touch par bhi)
const show = computed(() => hover.value || pinned.value)
const label = computed(() => timeAgo(props.value, now.value))
const full = computed(() => fullDate(props.value, new Date(now.value)))
const iso = computed(() => parseDate(props.value)?.toISOString() ?? '')
</script>

<template>
  <span
    v-if="label"
    class="relative inline-block"
    @mouseenter="hover = true"
    @mouseleave="hover = false; pinned = false"
    @focusin="hover = true"
    @focusout="hover = false; pinned = false"
    @click.stop="pinned = !pinned"
  >
    <time
      :datetime="iso"
      :aria-label="full"
      tabindex="0"
      class="cursor-pointer rounded text-sm text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {{ label }}
    </time>
    <span
      v-if="show"
      role="tooltip"
      class="pointer-events-none absolute left-0 top-full z-40 mt-1 whitespace-nowrap rounded-md bg-black/55 px-3 py-1.5 text-sm text-white"
    >
      {{ full }}
    </span>
  </span>
</template>