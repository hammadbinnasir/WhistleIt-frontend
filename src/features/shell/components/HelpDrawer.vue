<script setup>
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const searchQuery = ref('')
const activeTopic = ref(null)
const isSearchOpen = ref(false)

const currentSlideIndex = ref(0)
const slides = [
  {
    id: 'whats-new',
    title: "What's new in Whistleit",
    subtitle: 'Discover new features available now',
    type: 'gift',
  },
  {
    id: 'comm-companies',
    title: 'Communication between companies',
    subtitle: 'Click to try it and learn more',
    type: 'company',
  },
  {
    id: 'quick-jump',
    title: 'Quickly jump to another conversation',
    subtitle: 'Click to try it and learn more',
    type: 'jump',
  },
]

function nextSlide() {
  currentSlideIndex.value = (currentSlideIndex.value + 1) % slides.length
}

function prevSlide() {
  currentSlideIndex.value = (currentSlideIndex.value - 1 + slides.length) % slides.length
}

function showLatestHelp() {
  currentSlideIndex.value = 0
  activeTopic.value = null
}

const topics = [
  {
    id: 'features',
    title: 'Features',
    icon: 'star',
    details: [
      {
        heading: 'Channels & Collaboration',
        text: 'Create public or private channels to organize team conversations around projects, topics, or departments.',
      },
      {
        heading: 'Rich Message Composer',
        text: 'Format text with bold, italic, code blocks, bulleted lists, and media attachments.',
      },
      {
        heading: 'Workspace Switcher',
        text: 'Easily switch between different organizations or teams from the left rail.',
      },
      {
        heading: 'Keyboard Navigation',
        text: 'Use Ctrl+K to jump between chats, Alt+Up/Down for channels, and Esc to dismiss panels.',
      },
    ],
  },
  {
    id: 'dms',
    title: 'Understand direct messages',
    icon: 'chat',
    details: [
      {
        heading: '1-on-1 Chats',
        text: 'Communicate privately with any teammate outside of public channels.',
      },
      {
        heading: 'Presence & Status',
        text: 'See real-time status indicators (online, away, offline) for colleagues.',
      },
      {
        heading: 'Media Sharing',
        text: 'Send screenshots, files, and voice notes directly in the conversation.',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Problem with notification',
    icon: 'bell',
    details: [
      {
        heading: 'Browser Permissions',
        text: 'Ensure notification permissions are set to "Allow" in your browser address bar.',
      },
      {
        heading: 'Muted Channels',
        text: 'Check if you have muted the channel from channel settings.',
      },
      {
        heading: 'Do Not Disturb',
        text: 'Verify your custom status is not set to Do Not Disturb or Offline.',
      },
    ],
  },
  {
    id: 'mentions',
    title: 'Use mention at Whistleit',
    icon: 'at',
    details: [
      {
        heading: '@username',
        text: "Type @ followed by a colleague's name to notify them directly in a channel message.",
      },
      {
        heading: '@channel',
        text: 'Notify everyone in the current active channel about an important update.',
      },
      { heading: '@here', text: 'Notify members who are currently active and online right now.' },
    ],
  },
]

function openTopic(topic) {
  activeTopic.value = topic
}

function closeTopic() {
  activeTopic.value = null
}

function openSearchTopic(topic) {
  openTopic(topic)
  isSearchOpen.value = false
}

function handleSearch(val) {
  searchQuery.value = val
  if (val.trim()) {
    isSearchOpen.value = true
  }
}
</script>

<template>
  <div class="help-drawer flex h-full w-full flex-col bg-white select-none">
    <!-- Header -->
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
      <div class="flex items-center gap-2">
        <button
          v-if="activeTopic"
          type="button"
          class="mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          title="Back"
          @click="closeTopic"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 class="text-base font-bold text-slate-800">Help</h2>
      </div>

      <div class="flex items-center gap-1">
        <!-- Dock / Layout Icon -->
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          title="Shortcuts & Docs"
          @click="openTopic(topics[0])"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </button>

        <!-- Gift Icon -->
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          title="What's New"
          @click="showLatestHelp"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </button>

        <!-- Close Arrow Icon (arrow pointing right to close right side panel) -->
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Close Help"
          aria-label="Close Help"
          @click="ui.closePanel()"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Drawer Content Body -->
    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      <!-- TOPIC DETAIL VIEW (When a topic is selected) -->
      <div v-if="activeTopic" class="space-y-4">
        <div class="flex items-center gap-3 pb-2 border-b border-slate-100">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
          >
            <!-- Topic Icon -->
            <svg
              v-if="activeTopic.icon === 'star'"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
            <svg
              v-else-if="activeTopic.icon === 'chat'"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <svg
              v-else-if="activeTopic.icon === 'bell'"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <svg
              v-else
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-slate-800 text-sm">{{ activeTopic.title }}</h3>
            <p class="text-xs text-slate-400">Topic Overview & Guides</p>
          </div>
        </div>

        <div class="space-y-3">
          <div
            v-for="(item, i) in activeTopic.details"
            :key="i"
            class="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-1"
          >
            <h4 class="text-xs font-bold text-slate-700">{{ item.heading }}</h4>
            <p class="text-xs text-slate-500 leading-relaxed">{{ item.text }}</p>
          </div>
        </div>

        <button
          type="button"
          class="w-full mt-4 py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 text-center transition-colors"
          @click="closeTopic"
        >
          Back to all topics
        </button>
      </div>

      <!-- MAIN HELP OVERVIEW (Default) -->
      <template v-else>
        <!-- 1. Find Answers Quickly -->
        <div>
          <label for="help-search" class="block text-xs font-medium text-slate-500 mb-1.5">
            Find answers quickly
          </label>
          <div class="relative">
            <div
              class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 hover:border-slate-300"
            >
              <input
                id="help-search"
                v-model="searchQuery"
                type="text"
                class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                placeholder="How can we help?"
                @input="handleSearch($event.target.value)"
                @focus="isSearchOpen = true"
              />
              <svg
                class="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform"
                :class="{ 'rotate-180': isSearchOpen && searchQuery }"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>

            <!-- Quick Search Suggestions Dropdown -->
            <div
              v-if="isSearchOpen && searchQuery.trim()"
              class="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              <button
                v-for="topic in topics.filter((t) =>
                  t.title.toLowerCase().includes(searchQuery.toLowerCase()),
                )"
                :key="topic.id"
                type="button"
                class="flex w-full items-center px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                @click="openSearchTopic(topic)"
              >
                {{ topic.title }}
              </button>
              <div
                v-if="
                  !topics.some((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                "
                class="px-3.5 py-2 text-xs text-slate-400"
              >
                No exact topic match. Try keywords like "Features" or "Direct messages".
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Discover More (Carousel) -->
        <div>
          <p class="text-xs font-medium text-slate-500 mb-2">Discover more</p>

          <div
            class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <!-- Top Slide Text Info -->
            <div class="px-4 pt-3.5 pb-2.5">
              <h3 class="text-sm font-bold text-slate-800">
                {{ slides[currentSlideIndex].title }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ slides[currentSlideIndex].subtitle }}
              </p>
            </div>

            <!-- Bottom Graphic Section -->
            <div class="relative h-36 w-full overflow-hidden flex items-center justify-center">
              <!-- SLIDE 1: What's new in Whistleit (Dark background with 3D gift boxes) -->
              <div
                v-if="slides[currentSlideIndex].type === 'gift'"
                class="absolute inset-0 flex items-center justify-center bg-[#232042]"
              >
                <svg
                  width="220"
                  height="130"
                  viewBox="0 0 220 130"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <!-- Dark background shadow -->
                  <ellipse cx="110" cy="110" rx="90" ry="16" fill="black" fill-opacity="0.25" />
                  <!-- Left Large Red Box -->
                  <g transform="translate(68, 42)">
                    <path d="M42 22L0 38V85L42 70V22Z" fill="#C53030" />
                    <path d="M42 22L84 38V85L42 70V22Z" fill="#E53E3E" />
                    <path d="M42 22L0 38L42 54L84 38L42 22Z" fill="#F56565" />
                    <!-- Yellow Ribbon -->
                    <path d="M42 22L21 30L42 38L63 30L42 22Z" fill="#ECC94B" />
                    <path d="M18 31V78L24 76V33L18 31Z" fill="#D69E2E" />
                    <path d="M60 33V76L66 78V31L60 33Z" fill="#ECC94B" />
                    <!-- Ribbon Bow -->
                    <circle cx="38" cy="19" r="6" fill="#F6E05E" />
                    <circle cx="46" cy="19" r="6" fill="#ECC94B" />
                    <circle cx="42" cy="19" r="3" fill="#D69E2E" />
                  </g>
                  <!-- Right Cyan Small Box -->
                  <g transform="translate(132, 62)">
                    <path d="M22 12L0 20V50L22 42V12Z" fill="#2B6CB0" />
                    <path d="M22 12L44 20V50L22 42V12Z" fill="#3182CE" />
                    <path d="M22 12L0 20L22 28L44 20L22 12Z" fill="#63B3ED" />
                    <!-- White/Red Ribbon -->
                    <path d="M22 12L11 16L22 20L33 16L22 12Z" fill="#FED7D7" />
                    <path d="M9 17V45L13 44V18L9 17Z" fill="#FC8181" />
                    <path d="M31 18V44L35 45V17L31 18Z" fill="#FEB2B2" />
                    <circle cx="22" cy="11" r="3" fill="#E53E3E" />
                  </g>
                </svg>
              </div>

              <!-- SLIDE 2: Communication between companies (Peach background with avatars) -->
              <div
                v-else-if="slides[currentSlideIndex].type === 'company'"
                class="absolute inset-0 flex items-center justify-center bg-[#fdf2e9]"
              >
                <div class="relative flex w-full items-center justify-center gap-12">
                  <!-- Female Avatar in Blue Circle -->
                  <div
                    class="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1e88e5] text-white shadow-sm"
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zm0 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"
                      />
                    </svg>
                    <!-- Headset -->
                    <div
                      class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-blue-600 shadow-xs"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                      >
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      </svg>
                    </div>
                  </div>

                  <!-- Center Speech Bubble Node -->
                  <div
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  >
                    <div
                      class="flex h-11 w-11 items-center justify-center rounded-full bg-[#f97316] shadow-sm"
                    >
                      <div
                        class="flex h-6 w-8 items-center justify-center rounded-lg bg-white px-1 shadow-xs"
                      >
                        <span
                          class="text-xs font-extrabold text-slate-700 tracking-widest leading-none pb-1"
                          >...</span
                        >
                      </div>
                    </div>
                    <!-- Small bottom blue node -->
                    <div
                      class="mt-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#1e88e5]"
                    >
                      <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                    </div>
                  </div>

                  <!-- Connecting dotted arch line -->
                  <svg
                    class="absolute inset-0 h-full w-full pointer-events-none"
                    viewBox="0 0 300 120"
                    fill="none"
                  >
                    <path
                      d="M90 60 Q 150 25 210 60"
                      stroke="#cbd5e1"
                      stroke-width="2"
                      stroke-dasharray="4 4"
                    />
                  </svg>

                  <!-- Male Avatar in Orange/Dark Circle -->
                  <div
                    class="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#ea580c] text-white shadow-sm"
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zm0 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- SLIDE 3: Quickly jump to another conversation (Gold/Yellow with Ctrl+K) -->
              <div
                v-else-if="slides[currentSlideIndex].type === 'jump'"
                class="absolute inset-0 flex flex-col items-center justify-center bg-[#f59e0b] px-6"
              >
                <!-- Mini Search Box Mockup -->
                <div
                  class="w-full max-w-[210px] rounded-lg bg-white/95 px-2.5 py-1.5 shadow-sm space-y-1"
                >
                  <div class="flex items-center gap-1.5">
                    <svg
                      class="h-3 w-3 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <div class="h-2 w-16 rounded bg-slate-200"></div>
                  </div>
                  <div class="flex items-center gap-2 pt-0.5">
                    <span class="text-[10px] font-bold text-slate-500">#</span>
                    <div class="h-2 w-24 rounded bg-slate-100"></div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="h-3 w-3 rounded-full bg-slate-700"></div>
                    <div class="h-2 w-14 rounded bg-slate-100"></div>
                  </div>
                </div>

                <!-- Ctrl/Cmd + K Badge -->
                <div
                  class="mt-2.5 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 shadow-md"
                >
                  <span class="text-xs font-bold text-slate-800">Ctrl/Cmd</span>
                  <span class="text-xs font-bold text-slate-400">+</span>
                  <span class="text-xs font-bold text-slate-800">K</span>
                </div>
              </div>

              <!-- Left and Right Nav Arrows -->
              <button
                type="button"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 transition-colors shadow-sm"
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
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 transition-colors shadow-sm"
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
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Explore Help Topics -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-slate-500 mb-2.5">Explore help topics</p>

          <!-- Topic 1: Features -->
          <div
            class="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs transition-all cursor-pointer"
            @click="openTopic(topics[0])"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                />
              </svg>
            </div>
            <span class="text-sm font-semibold text-slate-800">Features</span>
          </div>

          <!-- Topic 2: Understand direct messages -->
          <div
            class="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs transition-all cursor-pointer"
            @click="openTopic(topics[1])"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="8" y1="9" x2="16" y2="9" />
                <line x1="8" y1="13" x2="14" y2="13" />
              </svg>
            </div>
            <span class="text-sm font-semibold text-slate-800">Understand direct messages</span>
          </div>

          <!-- Topic 3: Problem with notification -->
          <div
            class="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs transition-all cursor-pointer"
            @click="openTopic(topics[2])"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <span class="text-sm font-semibold text-slate-800">Problem with notification</span>
          </div>

          <!-- Topic 4: Use mention at Whistleit -->
          <div
            class="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs transition-all cursor-pointer"
            @click="openTopic(topics[3])"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
              </svg>
            </div>
            <span class="text-sm font-semibold text-slate-800">Use mention at Whistleit</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.help-drawer {
  font-family: inherit;
}
</style>
