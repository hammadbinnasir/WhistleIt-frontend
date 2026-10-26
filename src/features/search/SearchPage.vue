<script setup>
// Search page: Text / File / Link tabs, scope (current channel | over Whistle It),
// filter popover (user, date, webhooks) and a paginated file grid.
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useUiStore } from '@/stores/ui'
import { searchMessages, searchFiles, searchLinks, searchUsers } from './search'

const props = defineProps({ channelId: { type: String, default: '' } })
const ui = useUiStore()

const tabs = [
  { id: 'text', label: 'Text' },
  { id: 'file', label: 'File' },
  { id: 'link', label: 'Link' },
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
onMounted(run)
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

const kindIcon = { public: '🌐', private: '🔒', dm: '👤' }
const fileIcon = { pdf: '📕', doc: '📄', audio: '🎧', image: '🖼️' }
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
</script>

<template>
  <section class="flex h-full w-full flex-col bg-white">
    <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 class="text-lg text-slate-700">Search</h2>
      <button
        class="text-slate-600 hover:text-indigo-600"
        aria-label="Close search"
        @click="ui.closePanel()"
      >
        →
      </button>
    </header>

    <!-- search box + filter button -->
    <div class="relative flex items-center gap-3 px-4 pt-4">
      <div
        class="flex flex-1 items-center rounded border border-slate-300 px-3 py-2 focus-within:border-indigo-500"
      >
        <svg
          viewBox="0 0 24 24"
          class="mr-2 h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="q"
          type="text"
          placeholder="Type here..."
          class="w-full bg-transparent text-sm outline-none"
        />
      </div>
      <button
        class="relative text-slate-600 hover:text-indigo-600"
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
        class="absolute right-4 top-14 z-20 w-[min(28rem,calc(100vw-2rem))] rounded bg-white shadow-xl"
      >
        <div class="space-y-5 p-5 text-sm">
          <div>
            <p class="mb-1 text-slate-600">Filter by Users</p>
            <input
              v-model="userQuery"
              placeholder="Search"
              class="w-full rounded border border-slate-300 px-3 py-3 focus:border-indigo-500 focus:outline-none"
            />
            <ul class="mt-1 max-h-36 overflow-y-auto">
              <li v-for="u in userOptions" :key="u.id">
                <label class="flex cursor-pointer items-center gap-2 px-1 py-1 hover:bg-slate-50">
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
          <div>
            <p class="mb-1 text-slate-600">Filter by Date</p>
            <select
              v-model="draft.dateMode"
              class="mb-2 w-full rounded border border-slate-300 px-3 py-3 focus:border-indigo-500 focus:outline-none"
              aria-label="Date filter type"
            >
              <option value="on">On...</option>
              <option value="before">Before...</option>
              <option value="after">After...</option>
              <option value="range">Range...</option>
            </select>
            <input
              v-model="draft.date"
              type="date"
              :aria-label="draft.dateMode === 'range' ? 'Start date' : 'Select date'"
              class="w-full rounded border border-slate-300 px-3 py-3"
            />
            <input
              v-if="draft.dateMode === 'range'"
              v-model="draft.dateEnd"
              type="date"
              aria-label="End date"
              class="mt-2 w-full rounded border border-slate-300 px-3 py-3"
            />
          </div>
          <div>
            <p class="mb-1 text-slate-600">Additional Filter</p>
            <label class="flex cursor-pointer items-center gap-3 text-xs text-slate-700">
              <input v-model="draft.webhooks" type="checkbox" class="peer sr-only" />
              <span
                class="relative h-5 w-10 rounded-full bg-slate-200 transition peer-checked:bg-indigo-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
              ></span>
              Webhooks
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-200 p-3">
          <button class="px-3 py-2 text-sm font-semibold text-slate-600" @click="resetFilters">
            RESET
          </button>
          <button
            class="rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
            @click="applyFilters"
          >
            SEARCH
          </button>
        </div>
      </div>
    </div>

    <!-- scope + tabs -->
    <div class="flex items-center justify-between border-b border-slate-200 px-4">
      <div class="flex items-center gap-4 py-3 text-sm text-slate-600">
        <span class="font-semibold">Search {{ noun }}</span>
        <label class="flex cursor-pointer items-center gap-1"
          ><input v-model="scope" type="radio" value="channel" class="accent-indigo-500" /> in
          current channel</label
        >
        <label class="flex cursor-pointer items-center gap-1"
          ><input v-model="scope" type="radio" value="all" class="accent-indigo-500" /> over Whistle
          It</label
        >
      </div>
      <nav class="flex gap-5">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="border-b-2 py-3 text-sm font-semibold tracking-wide"
          :class="
            tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'
          "
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
    </div>

    <!-- results -->
    <div class="flex-1 overflow-y-auto p-4">
      <p v-if="error" class="text-center text-sm text-red-500">{{ error }}</p>
      <p v-else-if="loading" class="mt-16 text-center text-sm text-slate-500">Searching…</p>

      <div v-else-if="!items.length" class="mt-24 text-center">
        <template v-if="searched">
          <h3 class="text-lg font-bold text-slate-900">No {{ noun }} found</h3>
          <p class="text-slate-700">Try a different word, or change the filters.</p>
        </template>
        <template v-else>
          <h3 class="text-lg font-bold text-slate-900">Search to find what's on your Whistle It</h3>
          <p class="text-slate-800">
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
