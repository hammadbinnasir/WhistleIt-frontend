<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { allHelpPages, helpPages, helpSlides } from '../help/helpContent'
import { searchHelp } from '../help/helpSearch'
import HelpArticlePage from './HelpArticlePage.vue'
import HelpMedia from './HelpMedia.vue'
import HelpShortcutsModal from './HelpShortcutsModal.vue'
import HelpSlideArt from './HelpSlideArt.vue'
import HelpTopicIcon from './HelpTopicIcon.vue'

// The Help side panel.
//   Overview: search, "Discover more" carousel, topic list. Header icons: shortcuts, What's New.
//   Page:     one topic or What's New, with a back arrow in the header.
// All text and image slots live in ../help/helpContent.js.
const ui = useUiStore()

const pagesById = Object.fromEntries(allHelpPages.map((page) => [page.id, page]))

const bodyEl = ref(null)
const searchQuery = ref('')
const isSearchOpen = ref(false)
const isShortcutsOpen = ref(false)
const activePageId = ref(null)
const currentSlideIndex = ref(0)
const isCarouselHovered = ref(false)
const isCarouselFocused = ref(false)
let carouselTimer = null

const activePage = computed(() => (activePageId.value ? pagesById[activePageId.value] : null))
const currentSlide = computed(() => helpSlides[currentSlideIndex.value])
const results = computed(() => searchHelp(searchQuery.value))
const showResults = computed(() => isSearchOpen.value && searchQuery.value.trim() !== '')

function onKeydown(event) {
  if (event.key !== 'Escape' || isShortcutsOpen.value || !ui.helpModalOpen) return
  ui.toggleHelpModal()
}

function nextSlide() {
  currentSlideIndex.value = (currentSlideIndex.value + 1) % helpSlides.length
}

function prevSlide() {
  currentSlideIndex.value = (currentSlideIndex.value - 1 + helpSlides.length) % helpSlides.length
}

function handleCarouselFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) isCarouselFocused.value = false
}

watch(
  [
    () => ui.helpModalOpen,
    isShortcutsOpen,
    activePageId,
    currentSlideIndex,
    isSearchOpen,
    isCarouselHovered,
    isCarouselFocused,
  ],
  ([isHelpOpen, isShortcutsOpen, pageId, , searchOpen, isHovered, isFocused]) => {
    clearInterval(carouselTimer)
    carouselTimer = null

    if (
      isHelpOpen &&
      !isShortcutsOpen &&
      !pageId &&
      !searchOpen &&
      !isHovered &&
      !isFocused &&
      helpSlides.length > 1
    ) {
      carouselTimer = setInterval(nextSlide, 5000)
    }
  },
  { immediate: true, flush: 'sync' },
)

async function openPage(pageId, sectionId = null) {
  activePageId.value = pageId
  searchQuery.value = ''
  isSearchOpen.value = false

  await nextTick()
  const body = bodyEl.value
  if (!body) return
  const section = sectionId ? body.querySelector(`[data-section-id="${sectionId}"]`) : null
  if (section) {
    section.scrollIntoView?.({ block: 'start' })
  } else {
    body.scrollTop = 0
  }
}

async function closePage() {
  activePageId.value = null
  await nextTick()
  if (bodyEl.value) bodyEl.value.scrollTop = 0
}

function openResult(entry) {
  if (entry.action === 'shortcuts') {
    searchQuery.value = ''
    isSearchOpen.value = false
    isShortcutsOpen.value = true
    return
  }
  openPage(entry.pageId, entry.sectionId)
}

function openFirstResult() {
  if (results.value.length > 0) openResult(results.value[0])
}

// Close the results when focus moves outside the search box and its results.
function closeResultsOnBlur(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) isSearchOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  clearInterval(carouselTimer)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="help-drawer flex h-full w-full flex-col bg-white">
    <!-- Header -->
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
      <div class="flex items-center gap-2">
        <button
          v-if="activePage"
          type="button"
          class="mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="Back"
          aria-label="Back"
          @click="closePage"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 class="text-xl font-normal text-slate-800">Help</h2>
      </div>

      <div class="flex items-center gap-2">
        <div v-if="!activePage" class="flex items-center gap-2">
          <!-- Keyboard shortcuts -->
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
            @click="isShortcutsOpen = true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
            </svg>
          </button>

          <!-- What's New -->
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            title="What's New"
            aria-label="What's New"
            @click="openPage('whats-new')"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title="Close Help"
          aria-label="Close Help"
          @click="ui.toggleHelpModal()"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Body -->
    <div ref="bodyEl" class="flex-1 overflow-y-auto px-5 py-4">
      <!-- A topic page or What's New -->
      <HelpArticlePage v-if="activePage" :page="activePage" />

      <!-- Overview (default) -->
      <div v-else class="space-y-5">
        <!-- 1. Find answers quickly: searches every article title -->
        <div>
          <label for="help-search" class="mb-1.5 block text-xs font-medium text-slate-500">
            Find answers quickly
          </label>
          <div class="relative" @focusout="closeResultsOnBlur">
            <div
              class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 hover:border-slate-300"
            >
              <input
                id="help-search"
                v-model="searchQuery"
                type="text"
                autocomplete="off"
                class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                placeholder="How can we help?"
                @input="isSearchOpen = true"
                @focus="isSearchOpen = true"
                @keydown.enter.prevent="openFirstResult"
                @keydown.esc="isSearchOpen = false"
              />
              <svg
                class="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform"
                :class="{ 'rotate-180': showResults }"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>

            <!-- Search results -->
            <div
              v-if="showResults"
              class="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              data-testid="help-search-results"
              @mousedown.prevent
            >
              <button
                v-for="entry in results"
                :key="entry.key"
                type="button"
                class="flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left hover:bg-slate-50"
                @click="openResult(entry)"
              >
                <span class="text-xs font-medium text-slate-700">{{ entry.title }}</span>
                <span class="shrink-0 text-[11px] text-slate-400">{{ entry.label }}</span>
              </button>
              <div v-if="results.length === 0" class="px-3.5 py-2 text-xs text-slate-400">
                No articles found. Try a different word.
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Discover more (carousel) -->
        <div>
          <p class="mb-2 text-xs font-medium text-slate-500">Discover more</p>

          <div
            class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            @mouseenter="isCarouselHovered = true"
            @mouseleave="isCarouselHovered = false"
            @focusin="isCarouselFocused = true"
            @focusout="handleCarouselFocusOut"
          >
            <div class="px-4 pt-3.5 pb-2.5">
              <h3 class="text-sm font-bold text-slate-800">{{ currentSlide.title }}</h3>
              <p class="mt-0.5 text-xs text-slate-500">{{ currentSlide.subtitle }}</p>
            </div>

            <!-- Image area: the slide's GIF/image, or the built-in artwork -->
            <div class="relative aspect-[7/3] w-full overflow-hidden bg-slate-100">
              <HelpMedia
                :key="currentSlide.id"
                :media="currentSlide.media"
                :alt="currentSlide.title"
                img-class="h-full w-full object-cover"
              >
                <HelpSlideArt :art="currentSlide.art" />
              </HelpMedia>

              <button
                type="button"
                class="absolute top-1/2 left-2.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-sm transition-colors hover:bg-black/55"
                title="Previous slide"
                aria-label="Previous slide"
                @click="prevSlide"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  aria-hidden="true"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                type="button"
                class="absolute top-1/2 right-2.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-sm transition-colors hover:bg-black/55"
                title="Next slide"
                aria-label="Next slide"
                @click="nextSlide"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Explore help topics -->
        <div class="space-y-2">
          <p class="mb-2.5 text-xs font-medium text-slate-500">Explore help topics</p>

          <button
            v-for="page in helpPages"
            :key="page.id"
            type="button"
            class="flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs"
            @click="openPage(page.id)"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1e293b] text-white"
            >
              <HelpMedia :media="page.iconMedia">
                <HelpTopicIcon :name="page.icon" />
              </HelpMedia>
            </span>
            <span class="text-sm font-semibold text-slate-800">{{ page.title }}</span>
          </button>
        </div>
      </div>
    </div>

    <HelpShortcutsModal v-if="isShortcutsOpen" @close="isShortcutsOpen = false" />
  </div>
</template>

<style scoped>
.help-drawer {
  font-family: inherit;
}
</style>
