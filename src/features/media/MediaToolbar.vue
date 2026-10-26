<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'

const emit = defineEmits(['action', 'files-selected'])
const OPEN_GIF_CATALOG_URL =
  import.meta.env.VITE_OPEN_GIF_CATALOG_URL ||
  'https://raw.githubusercontent.com/bryanstedman/gifAPI/gh-pages/gifs.json'
const OPEN_GIF_ASSET_URL = 'https://raw.githubusercontent.com/bryanstedman/gifAPI/gh-pages'
const GIF_PAGE_SIZE = 24

const toolbar = ref(null)
const fileInput = ref(null)
const emojiPickerOpen = ref(false)
const activeTab = ref('emoji')
const activeCategory = ref('animals_nature')
const emojiQuery = ref('')
const gifQuery = ref('')
const gifs = ref([])
const gifLoading = ref(false)
const gifError = ref('')
const gifOffset = ref(0)
const gifHasMore = ref(true)
const categoryKeys = [
  'recent',
  'smileys_people',
  'animals_nature',
  'food_drink',
  'activities',
  'travel_places',
  'objects',
  'symbols',
  'flags',
]
let gifSearchTimer
let gifRequestId = 0
let initializedNatureCategory = false
let gifCatalogRequest

function blurSearchInput() {
  toolbar.value?.querySelector('.emoji-picker input')?.blur()
}

function toggleEmojiPicker() {
  emojiPickerOpen.value = !emojiPickerOpen.value
  if (emojiPickerOpen.value) {
    activeTab.value = 'emoji'
    emojiQuery.value = ''
  }
}

function showTab(tab) {
  blurSearchInput()
  activeTab.value = tab
  if (tab === 'emoji') emojiQuery.value = ''
  if (tab === 'gifs' && gifs.value.length === 0 && !gifError.value) {
    loadGifs({ reset: true })
  }
}

function selectEmoji(emoji) {
  emit('action', 'emoji', emoji.i)
  emojiPickerOpen.value = false
}

function handleEmojiSearch(event) {
  const searchInput = toolbar.value?.querySelector('.emoji-picker__library .v3-search input')
  const query = event.target.value

  event.currentTarget.closest('.emoji-picker').dataset.searching = String(Boolean(query.trim()))
  if (!searchInput || searchInput.value === query) return

  searchInput.value = query
  searchInput.dispatchEvent(new Event('input', { bubbles: true }))
}

async function loadGifs({ reset = false } = {}) {
  if (gifLoading.value || (!gifHasMore.value && !reset)) return

  if (reset) {
    gifs.value = []
    gifOffset.value = 0
    gifHasMore.value = true
  }

  const requestId = ++gifRequestId
  const query = gifQuery.value.trim()
  gifLoading.value = true
  gifError.value = ''

  try {
    if (!gifCatalogRequest) {
      gifCatalogRequest = fetch(OPEN_GIF_CATALOG_URL)
        .then((response) => {
          if (!response.ok) throw new Error(`Open GIF API returned ${response.status}.`)
          return response.json()
        })
        .then((result) => {
          if (!Array.isArray(result)) throw new Error('Open GIF API returned an invalid catalog.')
          return result
        })
        .catch((error) => {
          gifCatalogRequest = undefined
          throw error
        })
    }

    const catalog = await gifCatalogRequest
    if (requestId !== gifRequestId) return

    const normalizedQuery = query.toLocaleLowerCase()
    const matches = catalog
      .filter((gif) => {
        if (!gif || typeof gif.name !== 'string' || typeof gif.url !== 'string') return false
        if (!normalizedQuery) return true

        return [gif.name, ...(Array.isArray(gif.tags) ? gif.tags : [])].some(
          (value) =>
            typeof value === 'string' && value.toLocaleLowerCase().includes(normalizedQuery),
        )
      })
      .map((gif) => {
        const url = `${OPEN_GIF_ASSET_URL}/${encodeURIComponent(gif.name)}.gif`
        return {
          id: gif.name,
          title: gif.name.replace(/[-_]/g, ' '),
          preview: url,
          url,
        }
      })
    const items = matches.slice(gifOffset.value, gifOffset.value + GIF_PAGE_SIZE)

    gifs.value = reset ? items : [...gifs.value, ...items]
    gifOffset.value += items.length
    gifHasMore.value = gifOffset.value < matches.length
  } catch (error) {
    if (requestId === gifRequestId) {
      gifError.value =
        error instanceof Error
          ? `Could not load GIFs: ${error.message}`
          : 'Could not load GIFs from Open GIF API. Please try again.'
    }
  } finally {
    if (requestId === gifRequestId) gifLoading.value = false
  }
}

function handleGifScroll(event) {
  const element = event.currentTarget
  if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) {
    loadGifs()
  }
}

function selectGif(gif) {
  emit('action', 'gif', { url: gif.url, title: gif.title })
  emojiPickerOpen.value = false
}

watch(gifQuery, () => {
  clearTimeout(gifSearchTimer)
  gifRequestId += 1
  gifLoading.value = false
  gifHasMore.value = true
  gifError.value = ''
  gifSearchTimer = setTimeout(() => loadGifs({ reset: true }), 350)
})

watch(emojiPickerOpen, async (isOpen) => {
  if (!isOpen || initializedNatureCategory) return

  await nextTick()
  const natureCategory = toolbar.value?.querySelector(
    '.emoji-picker__library .v3-header .v3-groups > .v3-group:nth-child(3)',
  )
  if (natureCategory) {
    natureCategory.click()
    initializedNatureCategory = true
  }
})

function selectCategory(event) {
  const button = event.target.closest('.v3-header .v3-groups > .v3-group')
  if (!button) return

  blurSearchInput()
  const index = [...button.parentElement.children].indexOf(button)
  activeCategory.value = categoryKeys[index] || activeCategory.value
}

function closeEmojiPicker(event) {
  if (event.key === 'Escape') emojiPickerOpen.value = false
}

function closePickerOutside(event) {
  if (emojiPickerOpen.value && !toolbar.value?.contains(event.target)) {
    emojiPickerOpen.value = false
  }
}

function handleAction(action) {
  if (action === 'emoji') {
    toggleEmojiPicker()
    return
  }

  if (action === 'document' || action === 'attachment') {
    fileInput.value?.click()
    return
  }

  emit('action', action)
}

function handleFilesSelected(event) {
  emit('files-selected', [...(event.target.files || [])])
  event.target.value = ''
}

onMounted(() => document.addEventListener('pointerdown', closePickerOutside))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closePickerOutside)
  clearTimeout(gifSearchTimer)
  gifRequestId += 1
})
</script>

<template>
  <div ref="toolbar" class="media-toolbar" role="toolbar" aria-label="Media attachments">
    <button
      class="media-toolbar__button"
      type="button"
      aria-label="Emoji"
      title="Emoji"
      :aria-expanded="emojiPickerOpen"
      aria-haspopup="dialog"
      @click="handleAction('emoji')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M7.2 11.5c.7 1.1 1.6 1.7 2.8 1.7s2.1-.6 2.8-1.7" />
        <path d="M7.5 7.5h.01M12.5 7.5h.01" />
      </svg>
    </button>
    <button
      class="media-toolbar__button"
      type="button"
      aria-label="Document"
      title="Attach document"
      @click="handleAction('document')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 2.5h6l4 4v11H5z" />
        <path d="M11 2.5v4h4M7.5 10h5M7.5 13h5" />
      </svg>
    </button>
    <button
      class="media-toolbar__button"
      type="button"
      aria-label="Attachment"
      title="Attach file"
      @click="handleAction('attachment')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m7.5 10.8 5.1-5.1a3 3 0 0 1 4.2 4.2l-7 7a4.5 4.5 0 0 1-6.4-6.4l7-7" />
      </svg>
    </button>
    <button
      class="media-toolbar__button"
      type="button"
      aria-label="Video"
      title="Video"
      @click="handleAction('video')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="5" width="10.5" height="10" rx="1.5" />
        <path d="m13 8 4.5-2v8L13 12" />
      </svg>
    </button>
    <button
      class="media-toolbar__button"
      type="button"
      aria-label="Microphone"
      title="Microphone"
      @click="handleAction('microphone')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="7" y="2.5" width="6" height="10" rx="3" />
        <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7.5 18h5" />
      </svg>
    </button>
    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      multiple
      aria-label="Choose files to attach"
      @change="handleFilesSelected"
    />
    <section
      v-if="emojiPickerOpen"
      class="emoji-picker picker"
      :data-active-category="activeCategory"
      :data-searching="Boolean(emojiQuery.trim())"
      role="dialog"
      aria-label="Choose an emoji"
      @click.capture="selectCategory"
      @keydown="closeEmojiPicker"
    >
      <div class="emoji-picker__tabs" role="tablist" aria-label="Media type">
        <button
          class="emoji-picker__tab"
          :class="{ 'emoji-picker__tab--active': activeTab === 'emoji' }"
          type="button"
          role="tab"
          aria-label="Emoji"
          :aria-selected="activeTab === 'emoji'"
          @click="showTab('emoji')"
        >
          <svg class="emoji-picker__tab-icon" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.2" />
            <path d="M7.1 11.4c.7 1 1.6 1.6 2.9 1.6s2.2-.6 2.9-1.6" />
            <path d="M7.3 7.5h.1m5.2 0h.1" />
          </svg>
          Emoji
        </button>
        <button
          class="emoji-picker__tab"
          :class="{ 'emoji-picker__tab--active': activeTab === 'gifs' }"
          type="button"
          role="tab"
          aria-label="GIFs"
          :aria-selected="activeTab === 'gifs'"
          @click="showTab('gifs')"
        >
          <span class="emoji-picker__gif-badge" aria-hidden="true">GIF</span>
          GIFs
        </button>
      </div>
      <input
        v-if="activeTab === 'emoji'"
        v-model="emojiQuery"
        class="emoji-picker__emoji-search"
        type="search"
        placeholder="Search ..."
        aria-label="Search emoji"
        @input="handleEmojiSearch"
        @mousedown.stop
      />
      <EmojiPicker
        v-if="activeTab === 'emoji'"
        class="emoji-picker__library"
        :native="false"
        :hide-search="false"
        :hide-group-names="true"
        :disable-sticky-group-names="true"
        :disable-skin-tones="true"
        :display-recent="true"
        :group-order="categoryKeys"
        :static-texts="{ placeholder: 'Search ...' }"
        @select="selectEmoji"
      />
      <div v-else class="emoji-picker__gifs">
        <input
          v-model="gifQuery"
          class="emoji-picker__gif-search"
          type="search"
          placeholder="Search GIFs ..."
          aria-label="Search GIFs"
          @mousedown.stop
        />
        <div class="emoji-picker__gif-scroll" @scroll.passive="handleGifScroll">
          <div v-if="gifs.length" class="emoji-picker__gif-grid">
            <button
              v-for="gif in gifs"
              :key="gif.id"
              class="emoji-picker__gif"
              type="button"
              :aria-label="`Send GIF: ${gif.title}`"
              :title="gif.title"
              @click="selectGif(gif)"
            >
              <img :src="gif.preview" :alt="gif.title" loading="lazy" />
            </button>
          </div>
          <p v-if="gifLoading" class="emoji-picker__gif-status" role="status">Loading GIFs…</p>
          <div
            v-else-if="gifError"
            class="emoji-picker__gif-status emoji-picker__gif-status--error"
          >
            <p>{{ gifError }}</p>
            <button type="button" @click="loadGifs({ reset: true })">Try again</button>
          </div>
          <p v-else-if="!gifs.length" class="emoji-picker__gif-status">
            No GIFs found. Try another search.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.media-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.media-toolbar__button {
  display: grid;
  width: 28px;
  height: 30px;
  padding: 5px;
  place-items: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #34364b;
  cursor: pointer;
}

.media-toolbar__button:hover {
  background: #e1e2ec;
}

.media-toolbar__button:focus-visible {
  outline: 2px solid #5962ff;
  outline-offset: 1px;
}

.media-toolbar__button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.emoji-picker {
  position: absolute;
  z-index: 20;
  bottom: calc(100% + 8px);
  right: 0;
  display: flex;
  box-sizing: border-box;
  width: min(328px, calc(100vw - 10px));
  height: min(470px, calc(100vh - 40px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #d2d2d2;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 2px 8px rgb(24 25 38 / 12%);
  color: #34364b;
}

.emoji-picker__emoji-search {
  position: absolute;
  z-index: 2;
  top: 87px;
  right: 12px;
  left: 12px;
  box-sizing: border-box;
  width: calc(100% - 24px);
  height: 35px;
  padding: 0 10px;
  border: 1px solid #dedee4;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #34364b;
  font: inherit;
  font-size: 13px;
}

.emoji-picker__emoji-search:focus {
  border: 2px solid #111;
}

.emoji-picker__tabs {
  display: flex;
  width: 100%;
  height: 42px;
  flex: 0 0 auto;
  border-bottom: 1px solid #e2e2e8;
}

.emoji-picker__tab {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 0;
  background: #fff;
  color: #777;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
}

.emoji-picker__tab:first-child {
  width: 102px;
  flex: 0 0 102px;
}

.emoji-picker__tab:last-child {
  width: 101px;
  flex: 0 0 101px;
}

.emoji-picker__tab--active {
  color: #741cff;
}

.emoji-picker__tab--active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: #741cff;
  content: '';
}

.emoji-picker__tab-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.emoji-picker__gif-badge {
  display: grid;
  width: 19px;
  height: 17px;
  place-items: center;
  border-radius: 2px;
  background: #b5b5b8;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}

.emoji-picker__tab--active .emoji-picker__gif-badge {
  background: #741cff;
}

.emoji-picker__gifs {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 8px 8px 0;
}

.emoji-picker__gif-search {
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  flex: 0 0 auto;
  padding: 0 12px;
  border: 1px solid #dedee4;
  border-radius: 8px;
  outline: none;
  color: #34364b;
  font: inherit;
  font-size: 14px;
}

.emoji-picker__gif-search:focus {
  border: 2px solid #111;
}

.emoji-picker__gif-scroll {
  min-height: 0;
  flex: 1;
  margin-top: 10px;
  overflow-y: auto;
}

.emoji-picker__gif-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.emoji-picker__gif {
  display: block;
  min-height: 86px;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: #eeeef4;
  cursor: pointer;
}

.emoji-picker__gif img {
  display: block;
  width: 100%;
  height: auto;
}

.emoji-picker__gif:focus-visible {
  outline: 2px solid #741cff;
  outline-offset: -2px;
}

.emoji-picker__gif-status {
  padding: 14px 6px;
  color: #777b8e;
  font-size: 13px;
  text-align: center;
}

.emoji-picker__gif-status--error {
  color: #b42318;
}

.emoji-picker__gif-status p {
  margin: 0;
}

.emoji-picker__gif-status button {
  margin-top: 8px;
  padding: 4px 10px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: #fff;
  color: inherit;
  cursor: pointer;
}

.emoji-picker__library {
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.emoji-picker__library :deep(.v3-emoji-picker) {
  box-sizing: border-box;
  width: 100% !important;
  min-width: 100%;
  max-width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  --v3-picker-bg: #ffffff;
  --v3-picker-fg: #34364b;
  --v3-picker-border: #e2e2e8;
  --v3-picker-input-bg: #f8f8f9;
  --v3-picker-input-border: #dedee4;
  --v3-picker-input-focus-border: #741cff;
  --v3-picker-emoji-hover: #eeeef4;
}

.emoji-picker__library :deep(.v3-header) {
  padding: 0;
  border-bottom: 0;
  background: #fff;
}

.emoji-picker__library :deep(.v3-header .v3-groups) {
  height: 38px;
  min-height: 38px;
  align-items: center;
  padding: 0 8px;
  border-bottom: 1px solid #e2e2e8;
  background: #f5f5f5;
}

.emoji-picker__library :deep(.v3-spacing) {
  height: 7px;
}

.emoji-picker__library :deep(.v3-search) {
  padding: 0 12px;
  background: #fff;
}

.emoji-picker__library :deep(.v3-header .v3-groups .v3-group) {
  position: relative;
  min-width: 32px;
  padding: 0 5px 5px;
  color: #73737d;
  font-size: 18px;
}

.emoji-picker__library :deep(.v3-header .v3-groups) {
  align-items: center;
  height: 38px;
  min-height: 38px;
}

.emoji-picker[data-active-category='recent']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(1)::after),
.emoji-picker[data-active-category='smileys_people']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(2)::after),
.emoji-picker[data-active-category='animals_nature']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(3)::after),
.emoji-picker[data-active-category='food_drink']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(4)::after),
.emoji-picker[data-active-category='activities']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(5)::after),
.emoji-picker[data-active-category='travel_places']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(6)::after),
.emoji-picker[data-active-category='objects']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(7)::after),
.emoji-picker[data-active-category='symbols']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(8)::after),
.emoji-picker[data-active-category='flags']
  .emoji-picker__library
  :deep(.v3-header .v3-groups > .v3-group:nth-child(9)::after) {
  position: absolute;
  right: 0;
  bottom: -7px;
  left: 0;
  height: 3px;
  background: #00c99a;
  content: '';
}

.emoji-picker:not([data-searching='true'])[data-active-category='recent']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#recent)),
.emoji-picker:not([data-searching='true'])[data-active-category='smileys_people']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#smileys_people)),
.emoji-picker:not([data-searching='true'])[data-active-category='animals_nature']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#animals_nature)),
.emoji-picker:not([data-searching='true'])[data-active-category='food_drink']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#food_drink)),
.emoji-picker:not([data-searching='true'])[data-active-category='activities']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#activities)),
.emoji-picker:not([data-searching='true'])[data-active-category='travel_places']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#travel_places)),
.emoji-picker:not([data-searching='true'])[data-active-category='objects']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#objects)),
.emoji-picker:not([data-searching='true'])[data-active-category='symbols']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#symbols)),
.emoji-picker:not([data-searching='true'])[data-active-category='flags']
  .emoji-picker__library
  :deep(.v3-body-inner > .v3-group:not(#flags)) {
  display: none;
}

.emoji-picker__library :deep(.v3-search input) {
  box-sizing: border-box;
  width: 100%;
  height: 35px;
  padding: 0 10px;
  border: 1px solid #dedee4;
  border-radius: 8px;
  outline: none;
  font: inherit;
  font-size: 13px;
  visibility: hidden;
}

.emoji-picker__library :deep(.v3-search input:focus) {
  border: 2px solid #111;
}

.emoji-picker__library :deep(.v3-body) {
  min-height: 0;
  padding: 0 8px 8px 12px;
  overflow: hidden;
}

.emoji-picker__library :deep(.v3-body-inner) {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}

.emoji-picker__library :deep(.v3-body-inner::-webkit-scrollbar) {
  display: none;
}

.emoji-picker__library :deep(.v3-footer) {
  display: none !important;
}

.emoji-picker__library :deep(.v3-body-inner .v3-group .v3-emojis button) {
  flex-basis: 20%;
  max-width: 20%;
  font-size: 28px;
}

.emoji-picker__library :deep(.v3-body-inner .v3-group .v3-emojis button img) {
  padding: 3px;
}
</style>
