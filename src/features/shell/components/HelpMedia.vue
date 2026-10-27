<script setup>
import { computed, ref, watch } from 'vue'
import { IS_DEV, resolveMediaSrc } from '../help/helpMedia'

// One image slot in the Help drawer (GIF, SVG, PNG...).
// Shows the image when the media entry resolves to one. Otherwise shows the default slot
// (the built-in artwork), or - while developing, when no slot content is given - a dashed
// placeholder naming the file that belongs here.
const props = defineProps({
  media: { type: Object, default: null },
  alt: { type: String, default: '' },
  imgClass: { type: String, default: 'h-full w-full object-contain' },
})

const src = computed(() => resolveMediaSrc(props.media))
const failed = ref(false)

watch(src, () => {
  failed.value = false
})

const hint = computed(() => {
  const name = props.media?.name
  return name
    ? `Add ${name}.gif (or .svg / .png) to src/assets/help/`
    : 'Add an image or a url in helpContent.js'
})
</script>

<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="alt"
    :class="imgClass"
    draggable="false"
    decoding="async"
    loading="lazy"
    @error="failed = true"
  />
  <slot v-else-if="$slots.default" />
  <div
    v-else-if="IS_DEV"
    class="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 text-center text-xs text-slate-400"
    data-testid="help-media-placeholder"
  >
    {{ hint }}
  </div>
</template>
