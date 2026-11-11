<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'

const emit = defineEmits(['action', 'file-selected'])
const props = defineProps({
  recording: { type: Boolean, default: false },
  microphoneDisabled: { type: Boolean, default: false },
})

const toolbar = ref(null)
const fileInput = ref(null)
const emojiPickerOpen = ref(false)
const activeCategory = ref('animals_nature')
const emojiQuery = ref('')
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
let initializedNatureCategory = false

function blurSearchInput() {
  toolbar.value?.querySelector('.emoji-picker input')?.blur()
}

function toggleEmojiPicker() {
  emojiPickerOpen.value = !emojiPickerOpen.value
  if (emojiPickerOpen.value) emojiQuery.value = ''
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

function handleFileSelected(event) {
  emit('file-selected', event.target.files?.[0] ?? null)
  event.target.value = ''
}

onMounted(() => document.addEventListener('pointerdown', closePickerOutside))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closePickerOutside)
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
      aria-label="Microphone"
      :title="props.recording ? 'Stop recording' : 'Record voice message'"
      :aria-pressed="props.recording"
      :disabled="props.microphoneDisabled && !props.recording"
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
      aria-label="Choose a file to attach"
      @change="handleFileSelected"
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
      <input
        v-model="emojiQuery"
        class="emoji-picker__emoji-search"
        type="search"
        placeholder="Search ..."
        aria-label="Search emoji"
        @input="handleEmojiSearch"
        @mousedown.stop
      />
      <EmojiPicker
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
  top: 45px;
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
