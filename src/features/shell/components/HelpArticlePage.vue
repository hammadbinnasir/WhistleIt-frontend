<script setup>
import { computed } from 'vue'
import { shouldShowMedia } from '../help/helpMedia'
import HelpMedia from './HelpMedia.vue'

// Renders one Help page (a topic or What's New): its articles with an optional number,
// text, bullet or numbered lists, and an image slot under each article.
// All content comes from help/helpContent.js.
const props = defineProps({
  page: { type: Object, required: true },
})

const BADGE_COLORS = { dark: 'bg-[#1f1d3d]', indigo: 'bg-[#3f51b5]' }

const headingClass = computed(() => (props.page.large ? 'text-xl' : 'text-lg'))
const bodyClass = computed(() =>
  props.page.large ? 'text-base leading-7 text-slate-700' : 'text-[15px] leading-6 text-slate-700',
)

function headingText(section, index) {
  return props.page.numbering === 'prefix' ? `${index + 1}:${section.title}` : section.title
}

function mediaFor(section) {
  return { name: section.id, url: section.image ?? null }
}
</script>

<template>
  <div class="space-y-6 pb-4">
    <h3 v-if="page.heading" class="text-center text-xl font-bold text-slate-900">
      {{ page.heading }}
    </h3>

    <section
      v-for="(section, index) in page.sections"
      :key="section.id"
      :data-section-id="section.id"
      class="space-y-2"
    >
      <h3 class="flex items-start gap-2 font-bold text-slate-900" :class="headingClass">
        <span
          v-if="page.numbering === 'badge'"
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          :class="BADGE_COLORS[page.badge] || BADGE_COLORS.dark"
        >
          {{ index + 1 }}
        </span>
        <span>{{ headingText(section, index) }}</span>
      </h3>

      <p v-if="section.text" :class="bodyClass">{{ section.text }}</p>

      <ul v-if="section.bullets" class="list-disc space-y-3 pl-6" :class="bodyClass">
        <li v-for="(bullet, i) in section.bullets" :key="i">{{ bullet }}</li>
      </ul>

      <ol v-if="section.steps" class="list-decimal space-y-1 pl-6" :class="bodyClass">
        <li v-for="(step, i) in section.steps" :key="i">{{ step }}</li>
      </ol>

      <!-- Image slot: src/assets/help/<section id>.gif|svg|png, or `image` (a link) in helpContent.js -->
      <div
        v-if="section.showImage !== false && shouldShowMedia(mediaFor(section))"
        class="overflow-hidden rounded-lg"
      >
        <HelpMedia
          :media="mediaFor(section)"
          :alt="section.title"
          img-class="h-auto w-full object-contain"
        />
      </div>
    </section>
  </div>
</template>
