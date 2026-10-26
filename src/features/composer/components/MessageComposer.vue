<script setup>
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import MediaToolbar from '../../media/MediaToolbar.vue'

const emit = defineEmits(['send', 'schedule', 'attachment', 'video', 'microphone', 'gif'])

const editor = ref(null)
const scheduleTrigger = ref(null)
const scheduleMenu = ref(null)
const content = ref('')
const activeFormats = ref([])
const activeList = ref('')
const important = ref(false)
const scheduleOpen = ref(false)
const customScheduleOpen = ref(false)
const scheduleError = ref('')
const scheduledAt = ref('')
const customScheduleDate = ref('')
const customScheduleTime = ref('')
const scheduleClock = ref(new Date())
const attachments = ref([])
const messageIsReady = computed(() => content.value.trim().length > 0)
const scheduleIsReady = computed(() => messageIsReady.value || attachments.value.length > 0)
const scheduleTimeZone = 'Asia/Karachi'
let savedSelectionRange = null
let scheduleErrorTimer = null

onBeforeUnmount(() => clearTimeout(scheduleErrorTimer))

function handleSchedulePointerDown(event) {
  if (
    scheduleOpen.value &&
    !scheduleMenu.value?.contains(event.target) &&
    !scheduleTrigger.value?.contains(event.target)
  ) {
    scheduleOpen.value = false
  }
}

function handleScheduleKeydown(event) {
  if (event.key === 'Escape' && scheduleOpen.value) scheduleOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', handleSchedulePointerDown)
  document.addEventListener('keydown', handleScheduleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleSchedulePointerDown)
  document.removeEventListener('keydown', handleScheduleKeydown)
})

function showScheduleError() {
  scheduleError.value = 'Type some text or attach files to Schedule.'
  clearTimeout(scheduleErrorTimer)
  scheduleErrorTimer = setTimeout(() => {
    scheduleError.value = ''
  }, 4000)
}

function dismissScheduleError() {
  scheduleError.value = ''
  clearTimeout(scheduleErrorTimer)
}

const zonedDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: scheduleTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const minScheduleDate = computed(() => minScheduleTime.value.slice(0, 10))
const customScheduledAt = computed(() =>
  customScheduleDate.value && customScheduleTime.value
    ? `${customScheduleDate.value}T${customScheduleTime.value}`
    : '',
)
const customScheduleDateDisplay = computed(() => {
  if (customScheduleDate.value === minScheduleDate.value) return 'Today'
  if (!customScheduleDate.value) return ''
  const [year, month, day] = customScheduleDate.value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
})
const customScheduleTimeDisplay = computed(() => {
  if (!customScheduleTime.value) return ''
  const [hours, minutes] = customScheduleTime.value.split(':').map(Number)
  const period = hours >= 12 ? 'pm' : 'am'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
})
const customScheduleMinTime = computed(() =>
  customScheduleDate.value === minScheduleDate.value ? minScheduleTime.value.slice(11) : '00:00',
)
const customScheduleIsValid = computed(
  () => Boolean(customScheduledAt.value) && customScheduledAt.value >= minScheduleTime.value,
)

function dateTimeParts(date) {
  return Object.fromEntries(
    zonedDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map(({ type, value }) => [type, value]),
  )
}

function makeDateTimeValue(year, month, day, hour, minute) {
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function addCalendarDays(year, month, day, days) {
  const date = new Date(Date.UTC(year, Number(month) - 1, Number(day) + days))
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
  }
}

function presetDateTime(daysFromToday, hour, minute) {
  const now = dateTimeParts(new Date())
  const date = addCalendarDays(now.year, now.month, now.day, daysFromToday)
  return makeDateTimeValue(
    date.year,
    date.month,
    date.day,
    String(hour).padStart(2, '0'),
    String(minute).padStart(2, '0'),
  )
}

const minScheduleTime = computed(() => {
  const now = dateTimeParts(scheduleClock.value)
  return makeDateTimeValue(now.year, now.month, now.day, now.hour, now.minute)
})

const scheduleChoices = computed(() => {
  const now = dateTimeParts(scheduleClock.value)
  const todayOnePm = presetDateTime(0, 13, 0)
  const todayChoice = todayOnePm > minScheduleTime.value ? todayOnePm : presetDateTime(1, 13, 0)
  const todayLabel =
    todayChoice.slice(0, 10) === minScheduleTime.value.slice(0, 10) ? 'Today' : 'Tomorrow'

  const weekday = new Date(
    Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day)),
  ).getUTCDay()
  let daysUntilMonday = (8 - weekday) % 7
  let mondayChoice = presetDateTime(daysUntilMonday, 9, 0)
  if (mondayChoice <= minScheduleTime.value) {
    daysUntilMonday += 7
    mondayChoice = presetDateTime(daysUntilMonday, 9, 0)
  }
  const mondayDate = new Date(`${mondayChoice.slice(0, 10)}T00:00:00Z`)
  const mondayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(mondayDate)

  return [
    { label: `${todayLabel} at 1:00 PM`, value: todayChoice },
    { label: `${mondayLabel} at 9:00 AM`, value: mondayChoice },
  ]
})

const scheduleIsValid = computed(
  () => Boolean(scheduledAt.value) && scheduledAt.value > minScheduleTime.value,
)

const formatActions = [
  { name: 'bold', label: 'Bold', icon: 'B', command: 'bold' },
  { name: 'italic', label: 'Italic', icon: 'I', command: 'italic' },
  { name: 'strikethrough', label: 'Strikethrough', icon: 'S', command: 'strikeThrough' },
  { name: 'underline', label: 'Underline', icon: 'U', command: 'underline' },
  { name: 'code', label: 'Code block', icon: '</>' },
]
const formatTags = {
  bold: ['strong', 'b'],
  italic: ['em', 'i'],
  strikethrough: ['s', 'del', 'strike'],
  underline: ['u'],
}

function nodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const element = node
  const tag = element.tagName.toLowerCase()
  if (tag === 'pre') return `\`\`\`\n${element.textContent.replace(/\n+$/, '')}\n\`\`\``
  const children = [...element.childNodes].map(nodeToMarkdown).join('')

  if (tag === 'br') return '\n'
  if (tag === 'strong' || tag === 'b') return `**${children}**`
  if (tag === 'em' || tag === 'i') return `*${children}*`
  if (tag === 's' || tag === 'del' || tag === 'strike') return `~~${children}~~`
  if (tag === 'u') return `<u>${children}</u>`
  if (tag === 'code') return `\`${children}\``
  if (tag === 'li') {
    const list = element.parentElement
    const siblings = [...(list?.children || [])]
    const index = siblings.indexOf(element)
    return `${list?.tagName === 'OL' ? `${index + 1}.` : '•'} ${children}`
  }
  if (tag === 'ul' || tag === 'ol') return [...element.children].map(nodeToMarkdown).join('\n')
  if (['div', 'p'].includes(tag)) return `${children}\n`
  return children
}

function syncContent() {
  if (!editor.value) return
  content.value = [...editor.value.childNodes].map(nodeToMarkdown).join('').replace(/\n+$/, '')
  saveSelection(true)
}

function saveSelection(preservePendingFormats = false) {
  const selection = document.getSelection()
  if (selection?.rangeCount && editor.value?.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0)
    savedSelectionRange = range.cloneRange()
    if (range.collapsed && preservePendingFormats) return
    const node =
      selection.anchorNode.nodeType === Node.ELEMENT_NODE
        ? selection.anchorNode
        : selection.anchorNode.parentElement
    const list = node?.closest('ol, ul')
    activeList.value = list?.tagName === 'OL' ? 'numbered' : list ? 'bulleted' : ''
    activeFormats.value = formatActions
      .filter((action) => {
        if (action.name === 'code') return Boolean(node?.closest('pre'))
        return Boolean(node?.closest(formatTags[action.name]?.join(', ')))
      })
      .map((action) => action.name)
  }
}

function getSelectionRange() {
  const selection = document.getSelection()
  if (selection?.rangeCount && editor.value?.contains(selection.anchorNode)) {
    return selection.getRangeAt(0).cloneRange()
  }
  return savedSelectionRange?.cloneRange() || null
}

function updateActiveFormats() {
  saveSelection()
}

function unwrapFormat(fragment, name) {
  const selector = formatTags[name].join(', ')
  for (const element of [...fragment.querySelectorAll(selector)]) {
    element.replaceWith(...element.childNodes)
  }
}

function insertAtSelection(text) {
  const selection = document.getSelection()
  if (!editor.value || !selection) return

  const range = getSelectionRange()
  editor.value.focus()
  if (range) {
    selection.removeAllRanges()
    selection.addRange(range)
    const insertionRange = selection.getRangeAt(0)
    insertionRange.deleteContents()
    const textNode = document.createTextNode(text)
    insertionRange.insertNode(textNode)
    insertionRange.setStartAfter(textNode)
    insertionRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(insertionRange)
  } else {
    editor.value.append(document.createTextNode(text))
  }
  syncContent()
}

function applyFormat(action) {
  if (!editor.value) return
  const selection = document.getSelection()
  const range = getSelectionRange()
  editor.value.focus()
  if (range && selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
  if (!selection) return

  if (action.name === 'code') {
    const existingBlock = range?.commonAncestorContainer.parentElement?.closest('pre')
    if (existingBlock) {
      const text = document.createTextNode(existingBlock.textContent)
      existingBlock.replaceWith(text)
      const caret = document.createRange()
      caret.setStartAfter(text)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
      activeFormats.value = activeFormats.value.filter((format) => format !== 'code')
    } else {
      const codeRange = range || document.createRange()
      if (!range) {
        codeRange.selectNodeContents(editor.value)
        codeRange.collapse(false)
      }
      const codeBlock = document.createElement('pre')
      const code = document.createElement('code')
      if (range && !range.collapsed) code.append(codeRange.extractContents())
      if (!code.hasChildNodes()) code.append(document.createElement('br'))
      codeBlock.append(code)
      codeRange.deleteContents()
      codeRange.insertNode(codeBlock)
      codeRange.selectNodeContents(code)
      codeRange.collapse(false)
      selection.removeAllRanges()
      selection.addRange(codeRange)
      activeFormats.value = [...new Set([...activeFormats.value, 'code'])]
    }
  } else if (!range || range.collapsed) {
    const isActive = activeFormats.value.includes(action.name)
    activeFormats.value = isActive
      ? activeFormats.value.filter((format) => format !== action.name)
      : [...activeFormats.value, action.name]
  } else {
    const isActive = activeFormats.value.includes(action.name)
    const tagSelector = formatTags[action.name].join(', ')
    const startNode =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement
    const endNode =
      range.endContainer.nodeType === Node.ELEMENT_NODE
        ? range.endContainer
        : range.endContainer.parentElement
    const startFormat = startNode?.closest(tagSelector)
    const endFormat = endNode?.closest(tagSelector)

    if (isActive && startFormat && startFormat === endFormat) {
      const formatRange = document.createRange()
      formatRange.selectNodeContents(startFormat)
      if (
        range.compareBoundaryPoints(Range.START_TO_START, formatRange) === 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, formatRange) === 0
      ) {
        const children = [...startFormat.childNodes]
        startFormat.replaceWith(...children)
        if (children.length) {
          range.setStartBefore(children[0])
          range.setEndAfter(children[children.length - 1])
        }
        selection.removeAllRanges()
        selection.addRange(range)
        activeFormats.value = activeFormats.value.filter((format) => format !== action.name)
        syncContent()
        return
      }
    }

    const fragment = range.extractContents()
    if (isActive) {
      unwrapFormat(fragment, action.name)
      const first = fragment.firstChild
      const last = fragment.lastChild
      range.insertNode(fragment)
      if (first && last) {
        range.setStartBefore(first)
        range.setEndAfter(last)
      }
    } else {
      const wrapper = document.createElement(
        { bold: 'strong', italic: 'em', strikethrough: 's', underline: 'u' }[action.name],
      )
      wrapper.append(fragment)
      range.insertNode(wrapper)
      range.selectNodeContents(wrapper)
    }
    selection.removeAllRanges()
    selection.addRange(range)
    activeFormats.value = isActive
      ? activeFormats.value.filter((format) => format !== action.name)
      : [...new Set([...activeFormats.value, action.name])]
  }
  syncContent()
}

function handleBeforeInput(event) {
  if (event.inputType !== 'insertText' || !event.data || !activeFormats.value.length) return

  const selection = document.getSelection()
  if (!selection?.rangeCount || !editor.value?.contains(selection.anchorNode)) return

  const range = selection.getRangeAt(0)
  const codeMode = activeFormats.value.includes('code')
  let node = document.createTextNode(event.data)

  if (codeMode) {
    const codeBlock =
      range.commonAncestorContainer.parentElement?.closest('pre') ||
      range.startContainer.parentElement?.closest('pre')
    if (codeBlock) {
      range.deleteContents()
      range.insertNode(node)
    } else {
      const block = document.createElement('pre')
      const code = document.createElement('code')
      code.append(node)
      block.append(code)
      range.deleteContents()
      range.insertNode(block)
    }
  } else {
    for (const format of [...activeFormats.value].reverse()) {
      const tag = {
        bold: 'strong',
        italic: 'em',
        strikethrough: 's',
        underline: 'u',
      }[format]
      if (!tag) continue
      const wrapper = document.createElement(tag)
      wrapper.append(node)
      node = wrapper
    }
    range.deleteContents()
    range.insertNode(node)
  }

  const previousNode = node.previousSibling
  if (
    previousNode &&
    node.nodeType === Node.ELEMENT_NODE &&
    previousNode.nodeName === node.nodeName
  ) {
    mergeAdjacentContents(previousNode, node)
    node.remove()
    node = previousNode
  }
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  event.preventDefault()
  syncContent()
}

function mergeAdjacentContents(target, source) {
  while (source.firstChild) {
    const sourceChild = source.firstChild
    const targetChild = target.lastChild
    if (
      targetChild?.nodeType === Node.ELEMENT_NODE &&
      sourceChild.nodeType === Node.ELEMENT_NODE &&
      targetChild.nodeName === sourceChild.nodeName
    ) {
      mergeAdjacentContents(targetChild, sourceChild)
      sourceChild.remove()
    } else if (
      targetChild?.nodeType === Node.TEXT_NODE &&
      sourceChild.nodeType === Node.TEXT_NODE
    ) {
      targetChild.appendData(sourceChild.data)
      sourceChild.remove()
    } else {
      target.append(sourceChild)
    }
  }
}

function applyList(ordered) {
  if (!editor.value) return
  const selection = document.getSelection()
  const range = getSelectionRange()
  editor.value.focus()
  if (range && selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
  const currentList = range?.commonAncestorContainer.parentElement?.closest('ol, ul')
  const sameListType = currentList?.tagName === (ordered ? 'OL' : 'UL')
  const requestedList = ordered ? 'numbered' : 'bulleted'
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList')
  activeList.value = sameListType || activeList.value === requestedList ? '' : requestedList
  syncContent()
}

function toggleImportant() {
  important.value = !important.value
}

function toggleScheduleMenu() {
  scheduleClock.value = new Date()
  scheduleOpen.value = !scheduleOpen.value
  customScheduleOpen.value = false
  scheduledAt.value = ''
}

function openCustomSchedule() {
  if (!scheduleIsReady.value) {
    showScheduleError()
    return
  }
  const now = dateTimeParts(new Date())
  scheduleClock.value = new Date()
  customScheduleDate.value = makeDateTimeValue(
    now.year,
    now.month,
    now.day,
    now.hour,
    now.minute,
  ).slice(0, 10)
  customScheduleTime.value = `${now.hour}:${now.minute}`
  scheduledAt.value = ''
  customScheduleOpen.value = true
  scheduleOpen.value = false
}

function closeCustomSchedule() {
  customScheduleOpen.value = false
}

function saveCustomSchedule() {
  if (!customScheduleIsValid.value) return
  scheduledAt.value = customScheduledAt.value
  scheduleMessage()
}

function sendMessage() {
  if (!messageIsReady.value) return

  emit('send', {
    content: content.value.trim(),
    attachments: [...attachments.value],
    ...(important.value ? { important: true } : {}),
  })
  content.value = ''
  editor.value.innerHTML = ''
  activeFormats.value = []
  activeList.value = ''
  important.value = false
  savedSelectionRange = null
  attachments.value = []
}

function scheduleMessage() {
  if (!scheduleIsReady.value) {
    showScheduleError()
    return
  }
  if (!scheduleIsValid.value) return

  emit('schedule', {
    content: content.value.trim(),
    scheduledAt: scheduledAt.value,
    timeZone: scheduleTimeZone,
    attachments: [...attachments.value],
    ...(important.value ? { important: true } : {}),
  })
  content.value = ''
  editor.value.innerHTML = ''
  activeFormats.value = []
  activeList.value = ''
  important.value = false
  savedSelectionRange = null
  attachments.value = []
  scheduleOpen.value = false
  customScheduleOpen.value = false
  scheduledAt.value = ''
  customScheduleDate.value = ''
  customScheduleTime.value = ''
}

function scheduleAt(value) {
  if (!scheduleIsReady.value) {
    showScheduleError()
    return
  }
  scheduledAt.value = value
  scheduleMessage()
}

function handleFilesSelected(files) {
  if (files.length) {
    attachments.value = [...attachments.value, ...files]
    emit('attachment', files)
  }
}

function removeAttachment(index) {
  attachments.value = attachments.value.filter((_, fileIndex) => fileIndex !== index)
}

function handleMediaAction(action, payload) {
  if (action === 'emoji') {
    insertAtSelection(payload)
  } else if (action === 'gif') {
    emit('gif', payload)
  } else {
    emit(action)
  }
}

function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <form class="message-composer" aria-label="Message composer" @submit.prevent="sendMessage">
    <div class="message-composer__input-row">
      <div class="message-composer__editor-area">
        <span v-if="important" class="message-composer__important">IMPORTANT!</span>
        <label class="sr-only" for="message-composer-input">Message</label>
        <div
          id="message-composer-input"
          ref="editor"
          class="message-composer__input"
          role="textbox"
          aria-multiline="true"
          contenteditable="true"
          data-placeholder="Type your message here ..."
          @input="syncContent"
          @beforeinput="handleBeforeInput"
          @keydown="handleKeydown"
          @mouseup="updateActiveFormats"
        ></div>
      </div>

      <div class="message-composer__primary-actions">
        <button
          ref="scheduleTrigger"
          class="message-composer__icon-button message-composer__schedule-trigger"
          type="button"
          aria-label="Schedule message"
          title="Schedule message"
          :aria-expanded="scheduleOpen"
          aria-haspopup="dialog"
          @click="toggleScheduleMenu"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 10h18M16 14v3l2 1" />
            <circle cx="16" cy="16" r="4" />
          </svg>
        </button>
        <button
          class="message-composer__icon-button"
          type="submit"
          aria-label="Send message"
          title="Send message"
          :disabled="!messageIsReady"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>

    <div
      v-if="scheduleOpen"
      ref="scheduleMenu"
      class="message-composer__schedule"
      role="dialog"
      aria-label="Schedule message"
    >
      <div class="message-composer__schedule-heading">
        <strong>Schedule Message</strong>
        <span> - TZ: {{ scheduleTimeZone }}</span>
      </div>
      <button
        v-for="choice in scheduleChoices"
        :key="choice.value"
        class="message-composer__schedule-choice"
        type="button"
        @click="scheduleAt(choice.value)"
      >
        {{ choice.label }}
      </button>
      <button
        class="message-composer__schedule-choice message-composer__custom-choice"
        type="button"
        aria-haspopup="dialog"
        @click="openCustomSchedule"
      >
        Custom time
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="customScheduleOpen"
        class="message-composer__schedule-backdrop"
        @mousedown.self="closeCustomSchedule"
        @keydown.esc="closeCustomSchedule"
      >
        <section
          class="message-composer__schedule-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-schedule-title"
        >
          <button
            class="message-composer__schedule-close"
            type="button"
            aria-label="Close schedule dialog"
            @click="closeCustomSchedule"
          >
            &times;
          </button>
          <h2 id="message-schedule-title">Schedule Message</h2>
          <div class="message-composer__schedule-fields">
            <div class="message-composer__schedule-field">
              <label for="message-scheduled-date">Select date</label>
              <div class="message-composer__schedule-input-wrap">
                <span aria-hidden="true">{{ customScheduleDateDisplay }}</span>
                <input
                  id="message-scheduled-date"
                  v-model="customScheduleDate"
                  type="date"
                  :min="minScheduleDate"
                  aria-label="Select date"
                />
              </div>
            </div>
            <div class="message-composer__schedule-field">
              <label for="message-scheduled-time">Select time</label>
              <div class="message-composer__schedule-input-wrap">
                <span aria-hidden="true">{{ customScheduleTimeDisplay }}</span>
                <input
                  id="message-scheduled-time"
                  v-model="customScheduleTime"
                  type="time"
                  :min="customScheduleMinTime"
                  step="60"
                  aria-label="Select time"
                />
              </div>
            </div>
          </div>
          <p
            v-if="customScheduledAt && !customScheduleIsValid"
            class="message-composer__schedule-error"
          >
            Choose the current or a future date and time.
          </p>
          <div class="message-composer__schedule-modal-actions">
            <button type="button" class="is-secondary" @click="closeCustomSchedule">Cancel</button>
            <button
              type="button"
              class="is-primary"
              :disabled="!scheduleIsReady || !customScheduleIsValid"
              @click="saveCustomSchedule"
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <div v-if="attachments.length" class="message-composer__attachments" aria-label="Attachments">
      <span v-for="(file, index) in attachments" :key="`${file.name}-${index}`">
        {{ file.name }}
        <button type="button" :aria-label="`Remove ${file.name}`" @click="removeAttachment(index)">
          &times;
        </button>
      </span>
    </div>

    <div class="message-composer__toolbar-row">
      <div class="message-composer__formatting" role="toolbar" aria-label="Text formatting">
        <button
          v-for="action in formatActions"
          :key="action.name"
          class="message-composer__format-button"
          type="button"
          :aria-label="action.label"
          :title="action.label"
          :class="{ 'is-active': activeFormats.includes(action.name) }"
          :aria-pressed="activeFormats.includes(action.name)"
          @mousedown.prevent="saveSelection(true)"
          @click="applyFormat(action)"
        >
          <strong v-if="action.name === 'bold'">{{ action.icon }}</strong>
          <em v-else-if="action.name === 'italic'">{{ action.icon }}</em>
          <s v-else-if="action.name === 'strikethrough'">{{ action.icon }}</s>
          <u v-else-if="action.name === 'underline'">{{ action.icon }}</u>
          <span v-else>{{ action.icon }}</span>
        </button>
        <button
          class="message-composer__format-button"
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          :class="{ 'is-active': activeList === 'bulleted' }"
          :aria-pressed="activeList === 'bulleted'"
          @mousedown.prevent="saveSelection(true)"
          @click="applyList(false)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="3" cy="5" r="1" />
            <circle cx="3" cy="10" r="1" />
            <circle cx="3" cy="15" r="1" />
            <path d="M7 5h10M7 10h10M7 15h10" />
          </svg>
        </button>
        <button
          class="message-composer__format-button"
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          :class="{ 'is-active': activeList === 'numbered' }"
          :aria-pressed="activeList === 'numbered'"
          @mousedown.prevent="saveSelection(true)"
          @click="applyList(true)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 5h10M7 10h10M7 15h10M2 4h2v3M2 10h2v3H2M2 15h2v2H2" />
          </svg>
        </button>
        <button
          class="message-composer__format-button"
          type="button"
          aria-label="Insert poll"
          title="Insert poll"
          @mousedown.prevent="saveSelection(true)"
          @click="insertAtSelection('\nPoll:\n• Option 1\n• Option 2\n')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 17V9h3v8M8.5 17V4h3v13M14 17V7h3v10M2 18h16" />
          </svg>
        </button>
        <button
          class="message-composer__format-button"
          type="button"
          aria-label="Important message"
          title="Important message"
          :class="{ 'is-active': important }"
          :aria-pressed="important"
          @mousedown.prevent="saveSelection(true)"
          @click="toggleImportant"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2" y="4" width="16" height="12" rx="1" />
            <path d="m3 5 7 6 7-6" />
            <circle cx="15.5" cy="14.5" r="3" class="message-composer__clock" />
            <path d="M15.5 12.8v1.9l1.2.8" class="message-composer__clock-hand" />
          </svg>
        </button>
      </div>

      <MediaToolbar
        class="message-composer__media"
        @mousedown.prevent="saveSelection(true)"
        @action="handleMediaAction"
        @files-selected="handleFilesSelected"
      />
    </div>
  </form>
  <Teleport to="body">
    <div
      v-if="scheduleError"
      class="message-composer__schedule-toast"
      role="alert"
      aria-live="assertive"
    >
      <span class="message-composer__schedule-toast-icon" aria-hidden="true">!</span>
      <span><strong>Error!</strong> {{ scheduleError }}</span>
      <button type="button" aria-label="Dismiss notification" @click="dismissScheduleError">
        &times;
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.message-composer {
  position: relative;
  margin: 12px;
  border: 1px solid #e0e1e8;
  background: #fff;
}

.message-composer__input-row {
  display: flex;
  min-height: 48px;
}

.message-composer__editor-area {
  flex: 1;
  min-width: 0;
  padding: 4px 0;
}

.message-composer__input {
  min-width: 0;
  min-height: 32px;
  max-height: 180px;
  padding: 8px 14px;
  overflow-y: scroll;
  scrollbar-gutter: stable;
  scrollbar-color: #8d93a8 #e6e8f0;
  scrollbar-width: auto;
  border: 0;
  outline: 0;
  background: #fff;
  color: #25263a;
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.message-composer__important {
  display: block;
  width: fit-content;
  margin: 0 0 2px 8px;
  padding: 1px 10px;
  border-radius: 999px;
  background: #f04444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
}

.message-composer__input:empty::before {
  color: #777b8e;
  content: attr(data-placeholder);
  pointer-events: none;
}

.message-composer__input code {
  display: block;
  min-height: 20px;
  padding: 4px 6px;
  border-radius: 3px;
  background: #222;
  color: #fff;
  font-family: monospace;
}

.message-composer__input pre {
  margin: 0;
  white-space: pre-wrap;
}

.message-composer__input::-webkit-scrollbar {
  width: 14px;
}

.message-composer__input::-webkit-scrollbar-track {
  border-left: 1px solid #e0e2eb;
  background: #e6e8f0;
}

.message-composer__input::-webkit-scrollbar-thumb {
  min-height: 24px;
  border: 3px solid #e6e8f0;
  border-radius: 8px;
  background: #8d93a8;
}

.message-composer__input::-webkit-scrollbar-thumb:hover {
  background: #70778f;
}

.message-composer__primary-actions {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 5px 7px;
}

.message-composer__icon-button {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 5px;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #52566a;
  cursor: pointer;
}

.message-composer__icon-button:hover:not(:disabled) {
  background: #f0f0f6;
}

.message-composer__icon-button.message-composer__schedule-trigger:hover:not(:disabled),
.message-composer__icon-button.message-composer__schedule-trigger:active,
.message-composer__icon-button.message-composer__schedule-trigger:focus,
.message-composer__icon-button.message-composer__schedule-trigger:focus-visible {
  border: 0;
  outline: none;
  background: transparent;
  box-shadow: none;
}

.message-composer__icon-button:disabled {
  color: #a2a4b0;
  cursor: not-allowed;
}

.message-composer__icon-button svg {
  width: 21px;
  height: 21px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.message-composer__toolbar-row {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 8px;
  background: #f0f0f6;
}

.message-composer__formatting {
  display: flex;
  align-items: center;
  gap: 4px;
}

.message-composer__format-button {
  display: grid;
  min-width: 28px;
  height: 30px;
  padding: 4px 5px;
  place-items: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #34364b;
  font: inherit;
  cursor: pointer;
}

.message-composer__format-button:hover {
  background: #e1e2ec;
}

.message-composer__format-button.is-active {
  border-radius: 50%;
  background: #d0d0d4;
}

.message-composer__format-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.message-composer__format-button svg circle:not(.message-composer__clock) {
  fill: currentColor;
}

.message-composer__format-button .message-composer__clock {
  fill: #f0f0f6;
}

.message-composer__format-button .message-composer__clock-hand {
  stroke-width: 1;
}

.message-composer__format-button:focus-visible,
.message-composer__icon-button:focus-visible {
  outline: 2px solid #5962ff;
  outline-offset: 1px;
}

.message-composer__schedule {
  position: absolute;
  z-index: 5;
  bottom: calc(100% + 8px);
  right: 16px;
  display: flex;
  width: min(250px, calc(100vw - 48px));
  max-height: min(320px, calc(100vh - 32px));
  flex-direction: column;
  overflow-y: auto;
  padding: 8px 0;
  border: 1px solid #e0e1e8;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 5px 16px rgb(24 25 38 / 22%);
  color: #34364b;
  font-size: 13px;
}

.message-composer__schedule-heading {
  padding: 5px 14px 8px;
  color: #111827;
  font-size: 12px;
}

.message-composer__schedule-heading span {
  color: #85899a;
  font-weight: 400;
}

.message-composer__schedule-choice {
  min-height: 40px;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  color: #34364b;
  text-align: left;
  cursor: pointer;
}

.message-composer__schedule-choice:hover:not(:disabled) {
  background: #f2f3f8;
}

.message-composer__schedule-choice:disabled {
  color: #a2a4b0;
  cursor: not-allowed;
}

.message-composer__custom-choice {
  border-top: 1px solid #e0e1e8;
}

.message-composer__schedule-backdrop {
  position: fixed;
  z-index: 2000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(20 16 40 / 50%);
}

.message-composer__schedule-modal {
  position: relative;
  width: min(470px, 100%);
  padding: 27px 0 16px;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 12px 40px rgb(0 0 0 / 28%);
  color: #292929;
}

.message-composer__schedule-modal h2 {
  margin: 0 40px 31px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}

.message-composer__schedule-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 21px;
  height: 21px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #f0f0f6;
  color: #34364b;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.message-composer__schedule-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 48px;
  padding: 0 42px 36px;
}

.message-composer__schedule-field {
  min-width: 0;
}

.message-composer__schedule-field label {
  display: block;
  margin-bottom: 2px;
  color: #777;
  font-size: 12px;
}

.message-composer__schedule-field:nth-child(2) label {
  color: #5962ff;
}

.message-composer__schedule-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  height: 31px;
  border-bottom: 1px solid #999;
  color: #292929;
  font-size: 14px;
}

.message-composer__schedule-field:nth-child(2) .message-composer__schedule-input-wrap {
  border-bottom-color: #5962ff;
}

.message-composer__schedule-input-wrap span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-composer__schedule-input-wrap input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0 27px 0 0;
  border: 0;
  background: transparent;
  color: transparent;
  font: inherit;
  cursor: pointer;
  caret-color: transparent;
}

.message-composer__schedule-input-wrap input:focus-visible {
  outline: none;
}

.message-composer__schedule-input-wrap input::-webkit-calendar-picker-indicator {
  width: 20px;
  height: 20px;
  margin: 0;
  opacity: 1;
  cursor: pointer;
  filter: invert(40%) sepia(94%) saturate(2708%) hue-rotate(224deg) brightness(101%) contrast(102%);
}

.message-composer__schedule-modal > .message-composer__schedule-error {
  margin: -24px 42px 16px;
  color: #b42318;
  font-size: 12px;
}

.message-composer__schedule-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 8px 0;
  border-top: 1px solid #dedede;
}

.message-composer__schedule-modal-actions button {
  min-width: 112px;
  min-height: 36px;
  padding: 8px 14px;
  border: 0;
  border-radius: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.message-composer__schedule-modal-actions .is-secondary {
  background: transparent;
  color: #292929;
}

.message-composer__schedule-modal-actions .is-primary {
  background: #5962ff;
  color: #fff;
}

.message-composer__schedule-modal-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message-composer__schedule-toast {
  position: fixed;
  z-index: 3000;
  top: 96px;
  right: 8px;
  display: flex;
  width: min(404px, calc(100vw - 16px));
  min-height: 54px;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 5px solid #ff4058;
  border-radius: 4px 4px 0 0;
  background: #fff;
  box-shadow: 0 5px 16px rgb(24 25 38 / 22%);
  color: #6b6b6b;
  font-size: 13px;
}

.message-composer__schedule-toast-icon {
  display: grid;
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: #ff4058;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.message-composer__schedule-toast button {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #858585;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.message-composer__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid #e0e1e8;
}

.message-composer__attachments span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border-radius: 3px;
  background: #f0f0f6;
  color: #34364b;
  font-size: 12px;
}

.message-composer__attachments button {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}

@media (max-width: 620px) {
  .message-composer__toolbar-row {
    flex-wrap: wrap;
  }

  .message-composer__formatting {
    flex-wrap: wrap;
  }

  .message-composer__media {
    margin-left: auto;
  }
}
</style>