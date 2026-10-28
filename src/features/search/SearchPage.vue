<script setup>
// Search page: Text / File / Link tabs, scope (current channel | over Whistle It),
// filter popover (user, date, webhooks) and a paginated file grid.
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useUiStore } from '@/stores/ui'
import { searchMessages, searchFiles, searchLinks, searchUsers } from './search'

const props = defineProps({ channelId: { type: String, default: '' } })
const ui = useUiStore()

// icon = SVG path drawn inside each tab button
const tabs = [
  {
    id: 'text',
    label: 'Text',
    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 8h8M8 12h5',
  },
  {
    id: 'file',
    label: 'File',
    icon: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  },
  {
    id: 'link',
    label: 'Link',
    icon: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  },
]
const tab = ref('text')
const scope = ref('channel') // 'channel' | 'all'
const q = ref('')
const page = ref(1)
const totalPages = ref(1)
const items = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)

// filters: "draft" is edited inside the popover, "applied" is what the search uses
const filterOpen = ref(false)
const draft = reactive({ userIds: [], date: '', dateEnd: '', dateMode: 'on', webhooks: false })
const applied = reactive({ userIds: [], date: '', dateEnd: '', dateMode: 'on', webhooks: false })
const userQuery = ref('')
const userOptions = ref([])
const noun = computed(() => ({ text: 'messages', file: 'files', link: 'links' })[tab.value])
const hasFilters = computed(() => applied.userIds.length || applied.date || applied.webhooks)

async function run() {
  error.value = ''
  // files list shows everything by default (like the live app); text/link need a query or filter
  const canSearch = tab.value === 'file' || q.value.trim() || hasFilters.value
  if (!canSearch) {
    items.value = []
    searched.value = false
    return
  }
  loading.value = true
  try {
    const params = {
      q: q.value.trim(),
      page: page.value,
      pageSize: 6,
      channelId: scope.value === 'channel' ? props.channelId : '',
      userIds: applied.userIds,
      date: applied.date,
      dateEnd: applied.dateEnd,
      dateMode: applied.dateMode,
      webhooks: applied.webhooks,
    }
    const fn = { text: searchMessages, file: searchFiles, link: searchLinks }[tab.value]
    const res = await fn(params)
    items.value = res.items
    totalPages.value = res.totalPages
    searched.value = true
  } catch {
    error.value = 'Search failed. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}

let timer
watch(q, () => {
  page.value = 1
  clearTimeout(timer)
  timer = setTimeout(run, 350)
})
watch([tab, scope, () => props.channelId], () => {
  page.value = 1
  items.value = []
  run()
})
watch(page, run)
const searchInput = ref(null)
onMounted(() => {
  searchInput.value?.focus()
  run()
})
onBeforeUnmount(() => clearTimeout(timer))

watch(
  userQuery,
  async (v) => {
    userOptions.value = await searchUsers(v)
  },
  { immediate: true },
)

function toggleUser(id) {
  const i = draft.userIds.indexOf(id)
  i === -1 ? draft.userIds.push(id) : draft.userIds.splice(i, 1)
}
function applyFilters() {
  Object.assign(applied, { ...draft, userIds: [...draft.userIds] })
  filterOpen.value = false
  page.value = 1
  run()
}
function resetFilters() {
  Object.assign(draft, { userIds: [], date: '', dateEnd: '', dateMode: 'on', webhooks: false })
  Object.assign(applied, { userIds: [], date: '', dateEnd: '', dateMode: 'on', webhooks: false })
  filterOpen.value = false
  page.value = 1
  run()
}

// ---- date picker: dropdown (On / Before / After / Range) + calendar dialog ----
const pad = (n) => String(n).padStart(2, '0')
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const now = new Date()
const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate())
const dateModes = [
  { id: 'on', label: 'On...' },
  { id: 'before', label: 'Before...' },
  { id: 'after', label: 'After...' },
  { id: 'range', label: 'Range...' },
]
const dateMenuOpen = ref(false)
const calOpen = ref(false)
const calStep = ref('start') // 'start' | 'end' (end only used for range)
const calTmp = ref(todayISO)
const viewYear = ref(now.getFullYear())
const viewMonth = ref(now.getMonth())
const userListOpen = ref(false)
const userFocused = ref(false)

const parseISO = (iso) => new Date(`${iso}T00:00:00`)
const fmtShort = (iso) =>
  parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const dateLabel = computed(() => {
  if (!draft.date) return 'Select Date'
  if (draft.dateMode === 'range') {
    return draft.dateEnd
      ? `${fmtShort(draft.date)} – ${fmtShort(draft.dateEnd)}`
      : fmtShort(draft.date)
  }
  const word = { on: 'On', before: 'Before', after: 'After' }[draft.dateMode]
  return `${word} ${fmtShort(draft.date)}`
})
const calYear = computed(() => parseISO(calTmp.value).getFullYear())
const calHeadDate = computed(() =>
  parseISO(calTmp.value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }),
)
const monthTitle = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  }),
)
const calCells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1).getDay()
  const days = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
})
const cellISO = (d) => toISO(viewYear.value, viewMonth.value, d)
// future days are disabled; when picking a range end, days before the start are disabled too
const isDisabledDay = (d) => {
  const iso = cellISO(d)
  return iso > todayISO || (calStep.value === 'end' && iso < draft.date)
}
const canGoNext = computed(
  () => viewYear.value * 12 + viewMonth.value < now.getFullYear() * 12 + now.getMonth(),
)
function shiftMonth(delta) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}
function showCalendar(iso) {
  calTmp.value = iso
  const d = parseISO(iso)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
  calOpen.value = true
}
function pickMode(id) {
  draft.dateMode = id
  dateMenuOpen.value = false
  calStep.value = 'start'
  showCalendar(draft.date || todayISO)
}
function calCancel() {
  // cancelled halfway through a range: drop the half-picked start date
  if (draft.dateMode === 'range' && calStep.value === 'end' && !draft.dateEnd) draft.date = ''
  calOpen.value = false
}
function calOk() {
  if (draft.dateMode === 'range') {
    if (calStep.value === 'start') {
      draft.date = calTmp.value
      if (draft.dateEnd && draft.dateEnd < draft.date) draft.dateEnd = ''
      calStep.value = 'end'
      showCalendar(draft.dateEnd || draft.date)
      return
    }
    draft.dateEnd = calTmp.value
  } else {
    draft.date = calTmp.value
    draft.dateEnd = ''
  }
  calOpen.value = false
}
watch(filterOpen, (open) => {
  if (!open) {
    dateMenuOpen.value = false
    userListOpen.value = false
    calOpen.value = false
  }
})

const kindIcon = { public: '🌐', private: '🔒', dm: '👤' }
const fileIcon = { pdf: '📕', doc: '📄', audio: '🎧', image: '🖼️' }
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
</script>

<template>
  <section
    class="fixed inset-y-0 right-0 left-[328px] z-50 flex flex-col bg-white"
    style="
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: normal;
      color: rgba(0, 0, 0, 0.54);
    "
  >
    <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 class="text-xl text-slate-800">Search</h2>
      <button
        class="text-3x1 text-slate-800 hover:text-indigo-600"
        aria-label="Close search"
        @click="ui.closePanel()"
      >
        →
      </button>
    </header>

    <!-- search box + filter button -->
    <div class="relative flex items-center gap-3 px-4 pb-3 pt-4">
      <div
        class="flex flex-1 items-center rounded-sm border-2 border-slate-200 px-3 py-2 transition-colors focus-within:border-indigo-500"
      >
        <svg
          viewBox="0 0 24 24"
          class="mr-2 h-4 w-4 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref="searchInput"
          v-model="q"
          type="text"
          placeholder="Type here..."
          class="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
      </div>
      <button
        class="relative shrink-0 text-slate-600 hover:text-indigo-600"
        aria-label="Filters"
        @click="filterOpen = !filterOpen"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 4v16M12 4v16M19 4v16M3 9h4M10 15h4M17 8h4" />
        </svg>
        <span
          v-if="hasFilters"
          class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-indigo-500"
        ></span>
      </button>

      <!-- filter popover -->
      <div
        v-if="filterOpen"
        class="absolute right-4 top-14 z-20 w-[min(26rem,calc(100vw-2rem))] rounded bg-white shadow-xl"
      >
        <div class="space-y-6 p-6 text-slate-600">
          <!-- users -->
          <div>
            <p class="mb-2 text-base">Filter by Users</p>
            <div class="relative">
              <div
                class="group relative flex items-center rounded border border-slate-300 px-3 py-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
              >
                <span
                  class="absolute -top-2.5 left-2 hidden bg-white px-1 text-xs text-indigo-500 group-focus-within:block"
                  >Search</span
                >
                <svg
                  viewBox="0 0 24 24"
                  class="mr-2 h-4 w-4 shrink-0 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  v-model="userQuery"
                  type="text"
                  :placeholder="
                    userFocused
                      ? 'Type here to search'
                      : draft.userIds.length
                        ? `${draft.userIds.length} selected`
                        : 'Search'
                  "
                  class="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                  @focus="((userFocused = true), (userListOpen = true))"
                  @blur="userFocused = false"
                />
                <button
                  type="button"
                  class="text-indigo-500"
                  aria-label="Toggle users list"
                  @click="userListOpen = !userListOpen"
                >
                  <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
              </div>
              <ul
                v-if="userListOpen"
                class="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg"
              >
                <li v-for="u in userOptions" :key="u.id">
                  <label class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      :checked="draft.userIds.includes(u.id)"
                      @change="toggleUser(u.id)"
                    />
                    {{ u.name }}
                  </label>
                </li>
              </ul>
            </div>
          </div>

          <!-- date -->
          <div>
            <p class="mb-2 text-base">Filter by Date</p>
            <div class="relative">
              <button
                type="button"
                class="relative flex w-full items-center gap-3 rounded border px-3 py-3 text-left text-base"
                :class="
                  dateMenuOpen
                    ? 'border-indigo-500 ring-1 ring-indigo-500'
                    : 'border-slate-300 hover:border-slate-400'
                "
                aria-haspopup="listbox"
                :aria-expanded="dateMenuOpen"
                @click="dateMenuOpen = !dateMenuOpen"
              >
                <span
                  v-if="dateMenuOpen || draft.date"
                  class="absolute -top-2.5 left-2 bg-white px-1 text-xs"
                  :class="dateMenuOpen ? 'text-indigo-500' : 'text-slate-500'"
                  >Select Date</span
                >
                <svg
                  viewBox="0 0 24 24"
                  class="h-6 w-6 shrink-0 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
                <span
                  class="flex-1 truncate"
                  :class="draft.date ? 'text-slate-800' : 'text-slate-600'"
                >
                  {{ dateLabel }}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  class="h-6 w-6 shrink-0"
                  :class="dateMenuOpen ? 'text-indigo-500' : 'text-slate-500'"
                  fill="currentColor"
                >
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              <ul
                v-if="dateMenuOpen"
                role="listbox"
                class="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border border-slate-200 bg-white shadow-lg"
              >
                <li v-for="m in dateModes" :key="m.id">
                  <button
                    type="button"
                    role="option"
                    :aria-selected="draft.dateMode === m.id"
                    class="w-full px-4 py-3 text-left text-base hover:bg-slate-50"
                    :class="
                      draft.dateMode === m.id && draft.date
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-slate-700'
                    "
                    @click="pickMode(m.id)"
                  >
                    {{ m.label }}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- webhooks -->
          <div>
            <p class="mb-2 text-base">Additional Filter</p>
            <label class="flex cursor-pointer items-center gap-4 text-sm text-slate-700">
              <input v-model="draft.webhooks" type="checkbox" class="peer sr-only" />
              <span
                class="relative h-6 w-12 rounded-full bg-slate-300 transition peer-checked:bg-indigo-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-6"
              ></span>
              Webhooks
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-slate-200 p-3">
          <button
            class="px-4 py-2 text-sm font-semibold tracking-widest text-slate-800"
            @click="resetFilters"
          >
            RESET
          </button>
          <button
            class="rounded bg-indigo-500 px-6 py-3 text-sm font-semibold tracking-widest text-white hover:bg-indigo-600"
            @click="applyFilters"
          >
            SEARCH
          </button>
        </div>

        <!-- calendar dialog (opens after choosing On / Before / After / Range) -->
        <Teleport to="body">
          <div
            v-if="calOpen"
            class="flex items-center justify-center p-4"
            style="
              position: fixed;
              inset: 0;
              z-index: 99999;
              background: rgba(0, 0, 0, 0.5);
              font-family: 'Roboto', sans-serif;
            "
            @click.self="calCancel"
          >
            <div
              class="w-[min(21rem,100%)] overflow-hidden rounded bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Select date"
            >
              <div class="bg-indigo-500 px-6 py-5 text-white">
                <p class="text-sm font-medium text-white/70">
                  {{ calYear }}
                  <span v-if="draft.dateMode === 'range'">
                    · {{ calStep === 'start' ? 'Start date' : 'End date' }}
                  </span>
                </p>
                <p class="text-4xl font-medium">{{ calHeadDate }}</p>
              </div>

              <div class="px-5 pb-2 pt-4">
                <div class="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    class="rounded-full p-1 text-slate-600 hover:bg-slate-100"
                    aria-label="Previous month"
                    @click="shiftMonth(-1)"
                  >
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor">
                      <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" />
                    </svg>
                  </button>
                  <p class="font-bold text-slate-900">{{ monthTitle }}</p>
                  <button
                    type="button"
                    class="rounded-full p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Next month"
                    :disabled="!canGoNext"
                    @click="shiftMonth(1)"
                  >
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor">
                      <path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z" />
                    </svg>
                  </button>
                </div>

                <div class="mb-1 grid grid-cols-7 text-center text-xs font-bold text-slate-400">
                  <span
                    v-for="(w, i) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
                    :key="i"
                    class="py-2"
                    >{{ w }}</span
                  >
                </div>
                <div class="grid grid-cols-7 gap-y-1 text-center text-sm">
                  <template v-for="(d, i) in calCells" :key="i">
                    <span v-if="d === null"></span>
                    <button
                      v-else
                      type="button"
                      class="mx-auto h-10 w-10 rounded-full"
                      :class="
                        cellISO(d) === calTmp
                          ? 'bg-indigo-400 font-bold text-white'
                          : isDisabledDay(d)
                            ? 'cursor-default text-slate-300'
                            : 'text-slate-900 hover:bg-slate-100'
                      "
                      :disabled="isDisabledDay(d)"
                      @click="calTmp = cellISO(d)"
                    >
                      {{ d }}
                    </button>
                  </template>
                </div>
              </div>

              <div
                class="flex justify-end gap-8 px-6 py-4 text-sm font-semibold tracking-widest text-indigo-500"
              >
                <button type="button" @click="calCancel">CANCEL</button>
                <button type="button" @click="calOk">OK</button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>

    <!-- scope + tabs: one line, compact so it also fits a narrow panel -->
    <div class="flex flex-nowrap items-stretch justify-between border-b border-slate-200 pl-4 pr-1">
      <div
        class="flex min-w-0 items-center gap-3 whitespace-nowrap py-2 text-[13px] text-slate-600"
      >
        <span class="font-bold text-slate-700">Search {{ noun }}</span>
        <label class="flex cursor-pointer items-center gap-1.5">
          <input v-model="scope" type="radio" value="channel" class="h-4 w-4 accent-indigo-500" />
          in current channel
        </label>
        <label class="flex cursor-pointer items-center gap-1.5">
          <input v-model="scope" type="radio" value="all" class="h-4 w-4 accent-indigo-500" />
          over Whistle It
        </label>
      </div>

      <nav class="flex shrink-0 items-stretch">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="-mb-px flex items-center gap-1 whitespace-nowrap border-b-2 px-2.5 text-[13px] font-semibold tracking-wider"
          :class="
            tab === t.id
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-indigo-500'
          "
          @click="tab = t.id"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path :d="t.icon" />
          </svg>
          {{ t.label }}
        </button>
      </nav>
    </div>

    <!-- results -->
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <p v-if="error" class="text-center text-sm text-red-500">{{ error }}</p>
      <p v-else-if="loading" class="mt-16 text-center text-sm text-slate-500">Searching…</p>

      <div
        v-else-if="!items.length"
        class="flex flex-1 flex-col items-center justify-center px-4 text-center"
      >
        <template v-if="searched">
          <h3 class="text-xl font-bold text-slate-900">No {{ noun }} found</h3>
          <p class="mt-1 text-slate-700">Try a different word, or change the filters.</p>
        </template>
        <template v-else>
          <h3 class="text-xl font-bold text-slate-900">Search to find what's on your Whistle It</h3>
          <p class="mt-1 text-slate-900">
            Type and Search over Whistle It to get results from messages, companies, teams, channels
            and members
          </p>
        </template>
      </div>

      <!-- files grid -->
      <div v-else-if="tab === 'file'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="f in items"
          :key="f.id"
          class="overflow-hidden rounded border border-slate-200"
        >
          <div class="flex h-40 items-center justify-center bg-white text-6xl">
            {{ fileIcon[f.type] || '📄' }}
          </div>
          <audio v-if="f.type === 'audio'" controls :src="f.url" class="w-full"></audio>
          <div class="p-3 text-sm">
            <div v-if="f.type !== 'audio'" class="mb-1 flex items-center justify-between">
              <h4 class="truncate font-bold text-slate-900">{{ f.name }}</h4>
              <a :href="f.url" download class="text-indigo-500" aria-label="Download">⬇</a>
            </div>
            <p class="text-slate-700">Shared by {{ f.sharedBy }}</p>
            <p class="text-slate-600">
              {{ kindIcon[f.conversation.kind] }} {{ f.conversation.name }}
            </p>
          </div>
        </article>
      </div>

      <!-- text + link results -->
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="m in items" :key="m.id" class="py-3 text-sm">
          <p class="font-semibold text-slate-900">
            {{ m.sender }}
            <span class="ml-2 text-xs font-normal text-slate-500">{{ fmtDate(m.createdAt) }}</span>
          </p>
          <a
            v-if="tab === 'link'"
            :href="m.url"
            target="_blank"
            rel="noopener"
            class="break-all text-blue-600 underline"
            >{{ m.url }}</a
          >
          <p v-else class="text-slate-800">{{ m.text }}</p>
          <p class="mt-1 text-xs text-slate-500">
            {{ kindIcon[m.conversation.kind] }} {{ m.conversation.name }}
          </p>
        </li>
      </ul>
    </div>

    <!-- pagination -->
    <footer
      v-if="totalPages > 1"
      class="flex items-center justify-center gap-3 border-t border-slate-200 py-2 text-sm"
    >
      <button
        class="rounded bg-indigo-50 px-2 py-1 disabled:opacity-40"
        :disabled="page === 1"
        @click="page--"
      >
        ‹
      </button>
      <button
        v-for="n in totalPages"
        :key="n"
        class="rounded px-3 py-1 font-semibold"
        :class="n === page ? 'bg-slate-800 text-white' : 'text-slate-700'"
        @click="page = n"
      >
        {{ n }}
      </button>
      <button
        class="rounded bg-indigo-50 px-2 py-1 disabled:opacity-40"
        :disabled="page === totalPages"
        @click="page++"
      >
        ›
      </button>
    </footer>
  </section>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
</style>
