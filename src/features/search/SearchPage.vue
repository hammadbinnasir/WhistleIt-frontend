<script setup>
import { computed, ref } from 'vue'
import { useSearchStore } from './search.store'

const props = defineProps({
  channelId: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const store = useSearchStore()
const query = ref('')
const scope = ref('current')
const kind = ref('text')
const filterOpen = ref(false)
const sortOpen = ref(false)
const selectedUser = ref('')
const dateMode = ref('')
const dateStart = ref('')
const dateEnd = ref('')
const appliedFilters = ref({ user: '', dateMode: '', dateStart: '', dateEnd: '' })
const sortOrder = ref('newest')
const page = ref(1)
const pageSize = 8
const dateModes = [
  { value: 'on', label: 'On...' },
  { value: 'before', label: 'Before...' },
  { value: 'after', label: 'After...' },
  { value: 'range', label: 'Range...' },
]
const sortOptions = [
  { value: 'newest', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'relevance', label: 'Most relevant' },
]

function dateKey(value) {
  const date = new Date(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

<<<<<<< Updated upstream
const allResults = computed(() => {
  const current = store.messages.filter(
    (message) => scope.value === 'all' || message.conversationId === props.channelId,
  )
  const searchText = query.value.trim().toLocaleLowerCase()
  const matches = current.flatMap((message) => {
    if (kind.value === 'file') {
      return (message.attachments || [])
        .filter((file) => !searchText || `${file.name} ${message.authorName}`.toLocaleLowerCase().includes(searchText))
        .map((file) => ({ ...file, message }))
    }
    if (kind.value === 'link') {
      return (message.links || [])
        .filter((link) => !searchText || `${link} ${message.text} ${message.authorName}`.toLocaleLowerCase().includes(searchText))
        .map((url) => ({ url, message }))
    }
    if (!searchText || `${message.text} ${message.authorName}`.toLocaleLowerCase().includes(searchText)) {
      return [{ message }]
    }
    return []
  })
=======
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
>>>>>>> Stashed changes

  const filtered = matches.filter(({ message }) => {
    if (appliedFilters.value.user && message.authorId !== appliedFilters.value.user) return false
    const { dateMode: mode, dateStart: start, dateEnd: end } = appliedFilters.value
    if (!mode || !start) return true
    const messageDate = dateKey(message.createdAt)
    if (mode === 'on') return messageDate === start
    if (mode === 'before') return messageDate < start
    if (mode === 'after') return messageDate > start
    if (mode === 'range' && end) return messageDate >= start && messageDate <= end
    return true
  })

  return filtered.sort((first, second) => {
    const difference = new Date(first.message.createdAt) - new Date(second.message.createdAt)
    if (sortOrder.value === 'oldest') return difference
    if (sortOrder.value === 'relevance' && searchText) {
      const firstMatch = first.message.text.toLocaleLowerCase().includes(searchText) ? 1 : 0
      const secondMatch = second.message.text.toLocaleLowerCase().includes(searchText) ? 1 : 0
      if (firstMatch !== secondMatch) return secondMatch - firstMatch
    }
    return -difference
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(allResults.value.length / pageSize)))
const pageResults = computed(() => {
  const start = (page.value - 1) * pageSize
  return allResults.value.slice(start, start + pageSize)
})
const activeFiltersCount = computed(
  () => Number(Boolean(appliedFilters.value.user)) + Number(Boolean(appliedFilters.value.dateMode)),
)

function applyFilters() {
  appliedFilters.value = {
    user: selectedUser.value,
    dateMode: dateMode.value,
    dateStart: dateStart.value,
    dateEnd: dateEnd.value,
  }
  filterOpen.value = false
  page.value = 1
}

function resetFilters() {
  selectedUser.value = ''
  dateMode.value = ''
  dateStart.value = ''
  dateEnd.value = ''
  appliedFilters.value = { user: '', dateMode: '', dateStart: '', dateEnd: '' }
  page.value = 1
}

function changeKind(value) {
  kind.value = value
  page.value = 1
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fileIcon(type) {
  if (type === 'image') return 'IMG'
  if (type === 'pdf') return 'PDF'
  return 'FILE'
}
</script>

<template>
  <section class="search-page" aria-label="Search">
    <header class="search-page__header">
      <h2>Search</h2>
      <button type="button" aria-label="Close search" @click="emit('close')">→</button>
    </header>

    <div class="search-page__controls">
      <div class="search-page__input-row">
        <label class="search-page__searchbox">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16 16 5 5" /></svg>
          <input v-model="query" type="search" placeholder="Type here..." @input="page = 1" />
        </label>
        <button
          class="search-page__filter-button"
          :class="{ 'search-page__filter-button--active': filterOpen || activeFiltersCount }"
          type="button"
          aria-label="Filter search"
          :aria-expanded="filterOpen"
          @click="filterOpen = !filterOpen; sortOpen = false"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" /><path d="M7 3v6m10-3v6m-6 0v9" /></svg>
          <span v-if="activeFiltersCount">{{ activeFiltersCount }}</span>
        </button>
      </div>

      <div class="search-page__toolbar">
        <strong>Search {{ kind === 'text' ? 'messages' : kind === 'file' ? 'files' : 'links' }}</strong>
        <label class="search-page__radio">
          <input v-model="scope" type="radio" value="current" @change="page = 1" />
          <span>in current {{ channelId.startsWith('dm-') ? 'conversation' : 'channel' }}</span>
        </label>
        <label class="search-page__radio">
          <input v-model="scope" type="radio" value="all" @change="page = 1" />
          <span>over WhistleIt</span>
        </label>
        <div class="search-page__tabs" role="tablist" aria-label="Search result type">
          <button :class="{ active: kind === 'text' }" role="tab" :aria-selected="kind === 'text'" @click="changeKind('text')">
            <span aria-hidden="true">▤</span> Text
          </button>
          <button :class="{ active: kind === 'file' }" role="tab" :aria-selected="kind === 'file'" @click="changeKind('file')">
            <span aria-hidden="true">▯</span> File
          </button>
          <button :class="{ active: kind === 'link' }" role="tab" :aria-selected="kind === 'link'" @click="changeKind('link')">
            <span aria-hidden="true">↗</span> Link
          </button>
        </div>
      </div>
    </div>

    <div v-if="filterOpen" class="search-popover" role="dialog" aria-label="Search filters">
      <label class="search-popover__label" for="filter-user">Filter by Users</label>
      <select id="filter-user" v-model="selectedUser">
        <option value="">Search all users</option>
        <option v-for="user in store.signedMembers" :key="user.id" :value="user.id">{{ user.name }}</option>
      </select>

      <label class="search-popover__label" for="filter-date-mode">Filter by Date</label>
      <select id="filter-date-mode" v-model="dateMode">
        <option value="">Select Date</option>
        <option v-for="mode in dateModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
      </select>
      <div v-if="dateMode" class="search-popover__dates">
        <label>
          {{ dateMode === 'before' ? 'Before' : dateMode === 'after' ? 'After' : dateMode === 'range' ? 'From' : 'Date' }}
          <input v-model="dateStart" type="date" />
        </label>
        <label v-if="dateMode === 'range'">
          To
          <input v-model="dateEnd" type="date" :min="dateStart" />
        </label>
      </div>
      <footer>
        <button type="button" @click="resetFilters">Reset</button>
        <button
          class="search-popover__apply"
          type="button"
          :disabled="Boolean(dateMode && (!dateStart || (dateMode === 'range' && !dateEnd)))"
          @click="applyFilters"
        >Search</button>
      </footer>
    </div>

    <div v-if="sortOpen" class="search-sort" role="menu" aria-label="Sort results">
      <button
        v-for="option in sortOptions"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="sortOrder === option.value"
        @click="sortOrder = option.value; sortOpen = false; page = 1"
      >
        <span>{{ option.label }}</span><span v-if="sortOrder === option.value">✓</span>
      </button>
    </div>

    <div class="search-page__results-heading">
      <p>{{ allResults.length }} {{ kind === 'text' ? 'messages' : kind === 'file' ? 'files' : 'links' }} found</p>
      <button type="button" :aria-expanded="sortOpen" @click="sortOpen = !sortOpen; filterOpen = false">
        Sort: {{ sortOptions.find((option) => option.value === sortOrder)?.label }} <span aria-hidden="true">⌄</span>
      </button>
    </div>

    <div v-if="pageResults.length" class="search-page__results" :class="`search-page__results--${kind}`">
      <article v-for="(result, index) in pageResults" :key="result.message.id + '-' + (result.id || result.url || index)" class="search-result">
        <template v-if="kind === 'text'">
          <div class="search-result__avatar">{{ result.message.authorName.slice(0, 1) }}</div>
          <div class="search-result__body">
            <div class="search-result__meta">
              <strong>{{ result.message.authorName }}</strong>
              <time>{{ formatDate(result.message.createdAt) }}</time>
              <span>in {{ result.message.conversationName }}</span>
            </div>
            <p>{{ result.message.text }}</p>
            <div v-if="result.message.attachments?.length" class="search-result__attachment-list">
              <span v-for="file in result.message.attachments" :key="file.id">{{ file.name }}</span>
            </div>
          </div>
        </template>
        <template v-else-if="kind === 'file'">
          <a class="file-card__preview" :href="result.url" target="_blank" rel="noreferrer" :aria-label="`Open ${result.name}`">
            <span class="file-card__type">{{ fileIcon(result.type) }}</span>
            <span v-if="result.type === 'image'" class="file-card__image-mark">Image preview</span>
          </a>
          <div class="file-card__info">
            <a :href="result.url" target="_blank" rel="noreferrer">{{ result.name }}</a>
            <span>Shared by {{ result.message.authorName }}</span>
            <span>in {{ result.message.conversationName }}</span>
            <time>{{ formatDate(result.message.createdAt) }}</time>
          </div>
        </template>
        <template v-else>
          <div class="search-result__link-icon">↗</div>
          <div class="search-result__body">
            <div class="search-result__meta">
              <strong>{{ result.message.authorName }}</strong>
              <time>{{ formatDate(result.message.createdAt) }}</time>
              <span>in {{ result.message.conversationName }}</span>
            </div>
            <a class="search-result__url" :href="result.url" target="_blank" rel="noreferrer">{{ result.url }}</a>
            <p>{{ result.message.text }}</p>
          </div>
        </template>
      </article>
    </div>
    <div v-else class="search-page__empty">
      <strong>{{ query ? 'Nothing turned up' : 'Search to find what’s on your Whistle It' }}</strong>
      <p>
        {{
          query
            ? 'Nothing found against the search. Try different keywords or adjust your filters.'
            : 'Type a name, phrase, file, or link to find matching conversations.'
        }}
      </p>
    </div>

    <footer v-if="allResults.length > pageSize" class="search-page__pagination">
      <button type="button" :disabled="page === 1" aria-label="Previous page" @click="page--">‹</button>
      <button
        v-for="pageNumber in pageCount"
        :key="pageNumber"
        type="button"
        :class="{ active: page === pageNumber }"
        :aria-current="page === pageNumber ? 'page' : undefined"
        @click="page = pageNumber"
      >
        {{ pageNumber }}
      </button>
      <button type="button" :disabled="page === pageCount" aria-label="Next page" @click="page++">›</button>
    </footer>
  </section>
</template>

<style scoped>
.search-page {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  color: #303044;
}
.search-page__header {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid #e7e7ec;
}
.search-page__header h2 {
  margin: 0;
  color: #41415a;
  font-size: 20px;
  font-weight: 500;
}
.search-page__header button {
  border: 0;
  background: transparent;
  color: #3e4058;
  font-size: 27px;
  cursor: pointer;
}
.search-page__controls {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid #e5e5eb;
}
.search-page__input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 6px;
}
.search-page__searchbox {
  display: flex;
  min-width: 0;
  height: 46px;
  flex: 1;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid #bfc0c8;
  border-radius: 6px;
}
.search-page__searchbox:focus-within {
  border: 2px solid #5b5cff;
}
.search-page__searchbox svg {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  fill: none;
  stroke: #8c8ca1;
  stroke-width: 2;
  stroke-linecap: round;
}
.search-page__searchbox input {
  width: 100%;
  border: 0;
  outline: 0;
  color: #333;
  font: inherit;
  font-size: 15px;
}
.search-page__searchbox input::placeholder {
  color: #9393a0;
}
.search-page__filter-button {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #666678;
  cursor: pointer;
}
.search-page__filter-button:hover,
.search-page__filter-button--active {
  background: #f0f0ff;
  color: #5b5cff;
}
.search-page__filter-button svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
.search-page__filter-button span {
  position: absolute;
  top: -2px;
  right: -2px;
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 50%;
  background: #5b5cff;
  color: #fff;
  font-size: 10px;
}
.search-page__toolbar {
  display: flex;
  min-height: 42px;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 0 16px;
  color: #5f5f6d;
  font-size: 13px;
}
.search-page__toolbar > strong {
  color: #666;
}
.search-page__radio {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  cursor: pointer;
}
.search-page__radio input {
  width: 15px;
  height: 15px;
  accent-color: #5b5cff;
}
.search-page__tabs {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  align-self: stretch;
  gap: 3px;
}
.search-page__tabs button {
  padding: 0 9px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #777783;
  font: inherit;
  cursor: pointer;
}
.search-page__tabs button.active {
  border-bottom-color: #5b5cff;
  color: #5b5cff;
  font-weight: 600;
}
.search-page__tabs button span {
  margin-right: 3px;
}
.search-popover,
.search-sort {
  position: absolute;
  z-index: 5;
  top: 62px;
  right: 12px;
  width: min(360px, calc(100% - 24px));
  padding: 18px;
  border: 1px solid #e3e3eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 28px rgb(20 20 40 / 20%);
}
.search-popover__label {
  display: block;
  margin: 2px 0 7px;
  color: #696975;
  font-size: 14px;
}
.search-popover select,
.search-popover__dates input {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  margin-bottom: 17px;
  padding: 0 10px;
  border: 1px solid #c5c5cd;
  border-radius: 5px;
  background: #fff;
  color: #41414d;
  font: inherit;
}
.search-popover select:focus,
.search-popover__dates input:focus {
  border-color: #5b5cff;
  outline: 1px solid #5b5cff;
}
.search-popover__dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.search-popover__dates label {
  color: #666;
  font-size: 12px;
}
.search-popover footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 0 -18px -18px;
  padding: 12px 18px;
  border-top: 1px solid #e7e7ec;
}
.search-popover footer button {
  padding: 8px 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #444;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
}
.search-popover footer .search-popover__apply {
  background: #5b5cff;
  color: #fff;
}
.search-popover footer .search-popover__apply:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.search-sort {
  top: 146px;
  width: 220px;
  padding: 6px;
}
.search-sort button {
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 11px 10px;
  border: 0;
  border-radius: 4px;
  background: #fff;
  color: #40404c;
  text-align: left;
  cursor: pointer;
}
.search-sort button:hover {
  background: #f2f2ff;
  color: #5555e5;
}
.search-page__results-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 16px;
  border-bottom: 1px solid #eeeef2;
  color: #777;
  font-size: 12px;
}
.search-page__results-heading p {
  margin: 0;
}
.search-page__results-heading button {
  padding: 5px;
  border: 0;
  background: transparent;
  color: #5555d8;
  font: inherit;
  cursor: pointer;
}
.search-page__results {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  padding: 6px 12px 14px;
}
.search-result {
  display: flex;
  gap: 11px;
  padding: 13px 4px;
  border-bottom: 1px solid #eeeeF2;
}
.search-result__avatar,
.search-result__link-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 50%;
  background: #7736c8;
  color: #fff;
  font-weight: 600;
}
.search-result__link-icon {
  background: #f0f0ff;
  color: #5b5cff;
  font-size: 20px;
}
.search-result__body {
  min-width: 0;
  flex: 1;
}
.search-result__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 9px;
  color: #888;
  font-size: 11px;
}
.search-result__meta strong {
  color: #303044;
  font-size: 13px;
}
.search-result__body p {
  margin: 6px 0 0;
  color: #3f3f4d;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.search-result__attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.search-result__attachment-list span {
  padding: 4px 7px;
  border: 1px solid #e4e4ed;
  border-radius: 4px;
  color: #5555d5;
  font-size: 11px;
}
.search-page__results--file {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  align-content: start;
  gap: 14px;
  padding: 14px;
}
.file-card__preview {
  position: relative;
  display: grid;
  min-height: 145px;
  place-items: center;
  border: 1px solid #e2e2e8;
  border-radius: 5px 5px 0 0;
  background: linear-gradient(180deg, #fff 0%, #fff 76%, #f5f5f8 76%, #f5f5f8 100%);
  color: #4a4a64;
  text-decoration: none;
}
.file-card__type {
  padding: 10px;
  border: 1px solid #d8d8e1;
  border-radius: 6px;
  color: #57577c;
  font-size: 14px;
  font-weight: 700;
}
.file-card__image-mark {
  position: absolute;
  right: 8px;
  bottom: 8px;
  color: #8a8a97;
  font-size: 10px;
}
.file-card__info {
  display: grid;
  gap: 6px;
  padding: 10px;
  border: 1px solid #e2e2e8;
  border-top: 0;
  border-radius: 0 0 5px 5px;
  color: #62626c;
  font-size: 11px;
}
.file-card__info a {
  color: #333345;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.file-card__info time {
  color: #888;
}
.search-result__url {
  display: block;
  margin-top: 7px;
  color: #4b70d8;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.search-page__empty {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #222;
  text-align: center;
}
.search-page__empty strong {
  font-size: 18px;
}
.search-page__empty p {
  margin: 9px 0 0;
  color: #555;
  font-size: 14px;
  line-height: 1.5;
}
.search-page__pagination {
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid #e9e9ef;
}
.search-page__pagination button {
  min-width: 30px;
  height: 28px;
  border: 0;
  border-radius: 5px;
  background: #f1f1f6;
  color: #424255;
  cursor: pointer;
}
.search-page__pagination button.active {
  background: #383458;
  color: #fff;
}
.search-page__pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}
@media (max-width: 620px) {
  .search-page__toolbar {
    gap: 5px 8px;
    padding-bottom: 6px;
  }
  .search-page__tabs {
    width: 100%;
    flex: 1 0 100%;
    justify-content: flex-end;
    height: 34px;
  }
  .search-page__results--file {
    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
  }
}
</style>
