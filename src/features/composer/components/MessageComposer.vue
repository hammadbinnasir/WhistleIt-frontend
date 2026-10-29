<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
import MediaToolbar from '../../media/MediaToolbar.vue'

const emit = defineEmits(['send', 'schedule', 'attachment', 'video', 'microphone', 'gif'])

const editor = ref(null)
const scheduleTrigger = ref(null)
const scheduleMenu = ref(null)
const content = ref('')
const activeFormats = ref([])
const activeList = ref('')
const codeMode = ref(false)
const important = ref(false)
const scheduleOpen = ref(false)
const customScheduleOpen = ref(false)
const scheduleError = ref('')
const scheduledAt = ref('')
const customScheduleDate = ref('')
const customScheduleTime = ref('')
const scheduleClock = ref(new Date())
const pollOpen = ref(false)
const pollStep = ref(0)
const pollTitle = ref('')
const pollDescription = ref('')
const pollQuestions = ref([createPollQuestion()])
const pollQuestionFocused = ref([false])
const openPollQuestionType = ref(null)
const pollValidationErrors = ref({ title: false, questions: [], choices: [] })
const pollStepNames = ['Create', 'Configure', 'Schedule']
const attachments = ref([])
const messageIsReady = computed(() => content.value.trim().length > 0)
const scheduleIsReady = computed(() => messageIsReady.value || attachments.value.length > 0)
const scheduleTimeZone = 'Asia/Karachi'
let savedSelectionRange = null
let scheduleErrorTimer = null

function createPollQuestion() {
  return {
    text: '',
    type: 'choice',
    ratingType: '1-5',
    required: true,
    multiple: false,
    options: ['option 1', 'option 2', 'option 3'],
  }
}

const pollIsReady = computed(
  () =>
    Boolean(pollTitle.value.trim()) &&
    pollQuestions.value.every(
      (question) =>
        (!question.required || question.text.trim()) &&
        (!['choice', 'rating'].includes(question.type) ||
          question.options.filter((option) => option.trim()).length >= 2),
    ),
)

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
  if (event.key !== 'Escape') return
  if (scheduleOpen.value) scheduleOpen.value = false
  if (openPollQuestionType.value !== null) openPollQuestionType.value = null
}

function handlePollQuestionTypePointerDown(event) {
  const target = event.target instanceof Element ? event.target : event.target.parentElement
  if (
    openPollQuestionType.value !== null &&
    !target?.closest('.message-composer__poll-type-select')
  ) {
    openPollQuestionType.value = null
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleSchedulePointerDown)
  document.addEventListener('keydown', handleScheduleKeydown)
  document.addEventListener('pointerdown', handlePollQuestionTypePointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleSchedulePointerDown)
  document.removeEventListener('keydown', handleScheduleKeydown)
  document.removeEventListener('pointerdown', handlePollQuestionTypePointerDown)
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
        if (action.name === 'code') return false
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
  if (action.name === 'code') {
    codeMode.value = !codeMode.value
    return
  }

  const selection = document.getSelection()
  const range = getSelectionRange()
  editor.value.focus()
  if (range && selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
  if (!selection) return

  if (!range || range.collapsed) {
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
  let node = document.createTextNode(event.data)

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
  let range = getSelectionRange()
  if (!range) {
    range = document.createRange()
    range.selectNodeContents(editor.value)
    range.collapse(false)
  }

  editor.value.focus()
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }

  let startNode =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement
  if (startNode === editor.value) {
    const childIndex = Math.min(range.startOffset, editor.value.childNodes.length) - 1
    startNode = editor.value.childNodes[childIndex] || editor.value
  }
  const caretNode = startNode
  while (
    startNode &&
    startNode !== editor.value &&
    startNode.parentElement &&
    startNode.parentElement !== editor.value
  ) {
    startNode = startNode.parentElement
  }

  const selectionElement =
    caretNode?.nodeType === Node.ELEMENT_NODE ? caretNode : caretNode?.parentElement
  const requestedTag = ordered ? 'OL' : 'UL'
  const currentList = selectionElement?.closest('ol, ul')
  let caretTarget

  if (currentList?.tagName === requestedTag) {
    const lines = [...currentList.children].map((item) => {
      const line = document.createElement('div')
      while (item.firstChild) line.append(item.firstChild)
      if (!line.hasChildNodes()) line.append(document.createElement('br'))
      return line
    })
    const currentItem =
      caretNode?.nodeType === Node.ELEMENT_NODE
        ? caretNode.closest('li')
        : caretNode?.parentElement?.closest('li')
    const caretIndex = Math.max(0, [...currentList.children].indexOf(currentItem))
    currentList.replaceWith(...lines)
    caretTarget = lines[Math.min(caretIndex, lines.length - 1)]
  } else if (currentList) {
    const replacement = document.createElement(ordered ? 'ol' : 'ul')
    while (currentList.firstChild) replacement.append(currentList.firstChild)
    currentList.replaceWith(replacement)
    caretTarget =
      (caretNode?.nodeType === Node.ELEMENT_NODE
        ? caretNode.closest('li')
        : caretNode?.parentElement?.closest('li')) || replacement.querySelector('li')
  } else {
    const list = document.createElement(ordered ? 'ol' : 'ul')
    const item = document.createElement('li')
    const target = startNode && startNode !== editor.value ? startNode : null

    if (target) {
      target.replaceWith(list)
      item.append(target)
      if (!item.hasChildNodes()) item.append(document.createElement('br'))
    } else {
      item.append(document.createElement('br'))
      editor.value.append(list)
    }

    if (!list.contains(item)) list.append(item)
    caretTarget = item
  }

  if (caretTarget && selection) {
    const caret = document.createRange()
    caret.selectNodeContents(caretTarget)
    caret.collapse(false)
    selection.removeAllRanges()
    selection.addRange(caret)
    savedSelectionRange = caret.cloneRange()
  }

  const activeListElement = caretTarget?.closest('ol, ul')
  activeList.value =
    activeListElement?.tagName === 'OL'
      ? 'numbered'
      : activeListElement?.tagName === 'UL'
        ? 'bulleted'
        : ''
  activeFormats.value = []
  codeMode.value = false

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
  codeMode.value = false
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
  codeMode.value = false
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

function openPoll() {
  pollTitle.value = ''
  pollDescription.value = ''
  pollQuestions.value = [createPollQuestion()]
  pollQuestionFocused.value = [false]
  openPollQuestionType.value = null
  pollStep.value = 0
  pollValidationErrors.value = { title: false, questions: [true], choices: [false] }
  pollOpen.value = true
}

function closePoll() {
  pollOpen.value = false
}

function goToPollStep(step) {
  if (step > pollStep.value && !pollIsReady.value) {
    pollValidationErrors.value = {
      title: !pollTitle.value.trim(),
      questions: pollQuestions.value.map((question) => question.required && !question.text.trim()),
      choices: pollQuestions.value.map(
        (question) =>
          ['choice', 'rating'].includes(question.type) &&
          question.options.filter((option) => option.trim()).length < 2,
      ),
    }
    return
  }
  if (step > pollStep.value) {
    pollValidationErrors.value = { title: false, questions: [], choices: [] }
  }
  pollStep.value = step
}

function addPollQuestion() {
  pollQuestions.value.push(createPollQuestion())
  pollQuestionFocused.value.push(false)
}

function pollQuestionTypeLabel(type) {
  return {
    openEnded: 'Open Ended',
    choice: 'Choice',
    rating: 'Rating',
  }[type]
}

function setPollQuestionType(question, type, questionIndex) {
  question.type = type
  question.options =
    type === 'rating'
      ? Array.from({ length: Number(question.ratingType.split('-')[1]) }, (_, index) =>
          String(index + 1),
        )
      : type === 'choice'
        ? ['option 1', 'option 2', 'option 3']
        : []
  question.multiple = false
  openPollQuestionType.value = null
  if (pollValidationErrors.value.choices[questionIndex]) {
    pollValidationErrors.value.choices[questionIndex] =
      (type === 'choice' || type === 'rating') && question.options.length < 2
  }
  nextTick(() => document.getElementById(`poll-type-${questionIndex}`)?.focus())
}

function updatePollRatingType(question, questionIndex) {
  question.options = Array.from({ length: Number(question.ratingType.split('-')[1]) }, (_, index) =>
    String(index + 1),
  )
  if (pollValidationErrors.value.choices[questionIndex]) {
    pollValidationErrors.value.choices[questionIndex] = question.options.length < 2
  }
}

function addPollChoice(question) {
  question.options.push(`option ${question.options.length + 1}`)
}

function removePollChoice(question, index) {
  if (question.options.length > 2) question.options.splice(index, 1)
}

function createPollDraft() {
  if (!pollIsReady.value) {
    pollValidationErrors.value = {
      title: !pollTitle.value.trim(),
      questions: pollQuestions.value.map((question) => question.required && !question.text.trim()),
      choices: pollQuestions.value.map(
        (question) =>
          ['choice', 'rating'].includes(question.type) &&
          question.options.filter((option) => option.trim()).length < 2,
      ),
    }
    pollStep.value = 0
    return
  }
  const questionText = pollQuestions.value
    .map((question) => {
      const options =
        question.type === 'choice' || question.type === 'rating'
          ? question.options
              .map((option) => option.trim())
              .filter(Boolean)
              .map((option) => `• ${option}`)
          : []
      const questionLabel =
        question.type === 'rating'
          ? `${question.text.trim()} (Rating: ${question.ratingType})`
          : question.type === 'openEnded'
            ? `${question.text.trim()} (Open Ended)`
            : question.text.trim()
      return [questionLabel, ...options].join('\n')
    })
    .join('\n\n')
  const pollText = [`Poll: ${pollTitle.value.trim()}`, pollDescription.value.trim(), questionText]
    .filter(Boolean)
    .join('\n\n')
  const prefix = content.value.trim() ? '\n\n' : ''
  insertAtSelection(`${prefix}${pollText}`)
  closePoll()
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
  if (event.key === 'Enter' && !event.shiftKey) {
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
          :class="{ 'message-composer__input--code': codeMode }"
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
          :class="{
            'is-active': action.name === 'code' ? codeMode : activeFormats.includes(action.name),
          }"
          :aria-pressed="action.name === 'code' ? codeMode : activeFormats.includes(action.name)"
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
          <svg class="message-composer__list-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="3.5" cy="5" r="1.1" />
            <circle cx="3.5" cy="12" r="1.1" />
            <circle cx="3.5" cy="19" r="1.1" />
            <path d="M8.5 5h13M8.5 12h13M8.5 19h13" />
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
          <svg
            class="message-composer__list-icon message-composer__numbered-list-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M2.5 3.5h2v3.5h-2m0 0h3m-3 3.5h3v1.5l-3 1.5h3m-3 3.5h3v3h-3m3-1.5h-2M9 5h12.5M9 12h12.5M9 19h12.5"
            />
          </svg>
        </button>
        <button
          class="message-composer__format-button"
          type="button"
          aria-label="Insert poll"
          title="Insert poll"
          @mousedown.prevent="saveSelection(true)"
          @click="openPoll"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2.5" y="2.5" width="15" height="15" rx="1" />
            <path d="M5.5 14.5V10h2.5v4.5M9 14.5V6.5h2.5v8M12.5 14.5V8.5H15v6" />
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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="3.5" width="20" height="15" rx="1.5" />
            <path d="m3 4.5 9 7 9-7M3 17l6-4.5" />
            <circle cx="19.5" cy="17.5" r="4" class="message-composer__important-badge" />
            <path d="M19.5 15.5v2.5m0 1.25v.1" class="message-composer__important-badge-mark" />
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
  <Teleport to="body">
    <div
      v-if="pollOpen"
      class="message-composer__poll-backdrop"
      @mousedown.self="closePoll"
      @keydown.esc="closePoll"
    >
      <section
        class="message-composer__poll-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-poll-title"
      >
        <header class="message-composer__poll-header">
          <h2 id="message-poll-title">Create Poll</h2>
          <button
            class="message-composer__poll-close"
            type="button"
            aria-label="Close poll dialog"
            @click="closePoll"
          >
            &times;
          </button>
        </header>
        <nav class="message-composer__poll-steps" aria-label="Poll creation steps">
          <button
            v-for="(step, index) in pollStepNames"
            :key="step"
            type="button"
            :class="{ 'is-active': pollStep === index, 'is-complete': pollStep > index }"
            :aria-current="pollStep === index ? 'step' : undefined"
            @click="goToPollStep(index)"
          >
            <span class="message-composer__poll-step-icon" aria-hidden="true">
              <svg v-if="index === 0" viewBox="0 0 24 24">
                <path d="M12 20H4V4h11M14 4h6v6M10 14l9-9 2 2-9 9-4 1z" />
              </svg>
              <svg v-else-if="index === 1" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v3m0 16v3M1 12h3m16 0h3" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            {{ step }}
          </button>
        </nav>

        <div class="message-composer__poll-content">
          <template v-if="pollStep === 0">
            <label class="message-composer__poll-field-label" for="poll-title-input">Title</label>
            <input
              id="poll-title-input"
              v-model="pollTitle"
              class="message-composer__poll-title-input"
              :class="{ 'is-invalid': pollValidationErrors.title }"
              :aria-invalid="pollValidationErrors.title"
              type="text"
              placeholder="Enter Poll Title"
            />
            <p v-if="pollValidationErrors.title" class="message-composer__poll-validation-error">
              This is a required field
            </p>
            <label class="sr-only" for="poll-description-input">Description (Optional)</label>
            <textarea
              id="poll-description-input"
              v-model="pollDescription"
              class="message-composer__poll-description"
              placeholder="Description (Optional)"
              rows="4"
            ></textarea>
            <p class="message-composer__poll-hint">* What's the purpose of this Poll?</p>

            <section
              v-for="(question, questionIndex) in pollQuestions"
              :key="questionIndex"
              class="message-composer__poll-question"
            >
              <h3>
                <span>Question {{ questionIndex + 1 }}</span>
              </h3>
              <div class="message-composer__poll-question-types">
                <div class="message-composer__poll-question-type">
                  <label :id="`poll-type-label-${questionIndex}`">Question Type</label>
                  <div class="message-composer__poll-type-select">
                    <button
                      :id="`poll-type-${questionIndex}`"
                      class="message-composer__poll-type-trigger"
                      type="button"
                      role="combobox"
                      aria-haspopup="listbox"
                      :aria-expanded="openPollQuestionType === questionIndex"
                      :aria-labelledby="`poll-type-label-${questionIndex}`"
                      @click="
                        openPollQuestionType =
                          openPollQuestionType === questionIndex ? null : questionIndex
                      "
                    >
                      {{ pollQuestionTypeLabel(question.type) }}
                      <span class="message-composer__poll-select-arrow" aria-hidden="true"></span>
                    </button>
                    <div
                      v-if="openPollQuestionType === questionIndex"
                      class="message-composer__poll-type-menu"
                      role="listbox"
                      :aria-labelledby="`poll-type-label-${questionIndex}`"
                    >
                      <button
                        v-for="type in ['openEnded', 'choice', 'rating']"
                        :key="type"
                        type="button"
                        role="option"
                        class="message-composer__poll-type-option"
                        :class="{ 'is-selected': question.type === type }"
                        :aria-selected="question.type === type"
                        @click="setPollQuestionType(question, type, questionIndex)"
                      >
                        {{ pollQuestionTypeLabel(type) }}
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="question.type === 'rating'" class="message-composer__poll-question-type">
                  <label :for="`poll-rating-type-${questionIndex}`">Rating Type</label>
                  <div class="message-composer__poll-rating-select">
                    <select
                      :id="`poll-rating-type-${questionIndex}`"
                      v-model="question.ratingType"
                      @change="updatePollRatingType(question, questionIndex)"
                    >
                      <option value="1-5">1-5</option>
                      <option value="1-10">1-10</option>
                    </select>
                    <span class="message-composer__poll-select-arrow" aria-hidden="true"></span>
                  </div>
                </div>
              </div>
              <label :for="`poll-question-${questionIndex}`">Type your question here</label>
              <div
                class="message-composer__poll-question-field"
                :class="{
                  'is-invalid': pollValidationErrors.questions[questionIndex],
                  'has-value': question.text,
                }"
              >
                <label
                  v-if="pollQuestionFocused[questionIndex] || question.text"
                  :for="`poll-question-${questionIndex}`"
                  class="message-composer__poll-question-floating-label"
                  :class="{
                    'is-invalid': pollValidationErrors.questions[questionIndex],
                  }"
                >
                  Type your question
                </label>
                <input
                  :id="`poll-question-${questionIndex}`"
                  v-model="question.text"
                  :class="{
                    'is-invalid': pollValidationErrors.questions[questionIndex],
                  }"
                  :aria-invalid="Boolean(pollValidationErrors.questions[questionIndex])"
                  type="text"
                  :placeholder="
                    pollQuestionFocused[questionIndex] || question.text
                      ? 'Write here'
                      : 'Type your question'
                  "
                  @focus="pollQuestionFocused[questionIndex] = true"
                  @blur="pollQuestionFocused[questionIndex] = Boolean(question.text)"
                />
              </div>
              <p
                v-if="pollValidationErrors.questions[questionIndex]"
                class="message-composer__poll-validation-error"
              >
                This is a required field
              </p>
              <div class="message-composer__poll-toggles">
                <label>
                  <input v-model="question.required" type="checkbox" />
                  <span
                    ><strong>Required*</strong
                    ><small>Uncheck if you want this question optional</small></span
                  >
                </label>
                <label v-if="question.type === 'choice'">
                  <input v-model="question.multiple" type="checkbox" />
                  <span>Multiple select</span>
                </label>
              </div>
              <div
                v-if="question.type === 'choice' || question.type === 'rating'"
                class="message-composer__poll-options"
              >
                <div
                  v-for="(option, optionIndex) in question.options"
                  :key="optionIndex"
                  class="message-composer__poll-option"
                >
                  <input
                    v-model="question.options[optionIndex]"
                    :class="{
                      'is-invalid':
                        pollValidationErrors.choices[questionIndex] &&
                        !question.options[optionIndex].trim(),
                    }"
                    type="text"
                    :aria-label="`Question ${questionIndex + 1} option ${optionIndex + 1}`"
                  />
                  <button
                    type="button"
                    :aria-label="`Remove option ${optionIndex + 1}`"
                    :disabled="question.options.filter((option) => option.trim()).length <= 2"
                    @click="removePollChoice(question, optionIndex)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
                <button
                  v-if="question.type === 'choice'"
                  class="message-composer__poll-add-choice"
                  type="button"
                  @click="addPollChoice(question)"
                >
                  + Add Choice
                </button>
                <p
                  v-if="pollValidationErrors.choices[questionIndex]"
                  class="message-composer__poll-validation-error"
                >
                  Add at least two choices
                </p>
              </div>
            </section>
            <button
              class="message-composer__poll-add-question"
              type="button"
              @click="addPollQuestion"
            >
              Add Another Question
            </button>
          </template>
          <div v-else-if="pollStep === 1" class="message-composer__poll-placeholder">
            <h3>Configure your poll</h3>
            <p>Review your questions and choices before creating the poll.</p>
            <ul>
              <li v-for="(question, index) in pollQuestions" :key="index">
                {{
                  question.text
                    ? `${question.text} (${question.type === 'openEnded' ? 'Open Ended' : question.type === 'rating' ? `Rating ${question.ratingType}` : 'Choice'})`
                    : `Question ${index + 1}`
                }}
              </li>
            </ul>
          </div>
          <div v-else class="message-composer__poll-placeholder">
            <h3>Schedule your poll</h3>
            <p>Your poll will be added to the message composer as a draft.</p>
          </div>
        </div>
        <footer class="message-composer__poll-footer">
          <button
            type="button"
            class="message-composer__poll-previous"
            :disabled="pollStep === 0"
            @click="goToPollStep(Math.max(0, pollStep - 1))"
          >
            Previous
          </button>
          <button
            v-if="pollStep < pollStepNames.length - 1"
            type="button"
            class="message-composer__poll-next"
            @click="goToPollStep(pollStep + 1)"
          >
            Next
          </button>
          <button
            v-else
            type="button"
            class="message-composer__poll-next"
            :disabled="!pollIsReady"
            @click="createPollDraft"
          >
            Create Poll
          </button>
        </footer>
      </section>
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
  min-height: 42px;
}

.message-composer__editor-area {
  flex: 1;
  min-width: 0;
  padding: 4px 0 4px 4px;
}

.message-composer__input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 26px;
  max-height: 180px;
  padding: 4px 8px;
  overflow-y: scroll;
  scrollbar-gutter: stable;
  scrollbar-color: #8d93a8 #e6e8f0;
  scrollbar-width: auto;
  border: 0;
  border-radius: 4px;
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

.message-composer__input :deep(ul),
.message-composer__input :deep(ol) {
  margin-block: 0;
  padding-inline-start: 24px;
}

.message-composer__input :deep(ul) {
  list-style-type: disc;
}

.message-composer__input :deep(ol) {
  list-style-type: decimal;
}

.message-composer__input--code {
  background: #222;
  color: #fff;
}

.message-composer__input--code:empty::before {
  color: #c4c4c4;
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
  align-items: center;
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
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 8px;
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

.message-composer__format-button[aria-label='Important message'] {
  color: #000;
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

.message-composer__format-button .message-composer__list-icon {
  width: 22px;
  height: 22px;
}

.message-composer__format-button .message-composer__numbered-list-icon {
  stroke-width: 1.3;
}

.message-composer__format-button svg circle:not(.message-composer__important-badge) {
  fill: currentColor;
}

.message-composer__format-button .message-composer__important-badge {
  fill: currentColor;
  stroke: none;
}

.message-composer__format-button .message-composer__important-badge-mark {
  stroke: #fff;
  stroke-width: 1.5;
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

.message-composer__poll-backdrop {
  position: fixed;
  z-index: 2100;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: rgb(20 16 40 / 50%);
}

.message-composer__poll-modal {
  position: relative;
  display: flex;
  width: min(570px, 100%);
  max-height: min(88vh, 620px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 12px 40px rgb(0 0 0 / 28%);
  color: #292929;
  font-family: inherit;
}

.message-composer__poll-header {
  display: flex;
  min-height: 64px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 31px;
}

.message-composer__poll-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.message-composer__poll-close {
  display: grid;
  width: 21px;
  height: 21px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #f0f0f6;
  color: #34364b;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.message-composer__poll-steps {
  display: grid;
  min-height: 50px;
  flex: 0 0 auto;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid #e4e4e4;
}

.message-composer__poll-steps button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 8px 4px;
  border: 0;
  border-bottom: 5px solid transparent;
  background: #fff;
  color: #bcbec7;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.message-composer__poll-steps button.is-active,
.message-composer__poll-steps button.is-complete {
  border-bottom-color: #5962ff;
  color: #5962ff;
}

.message-composer__poll-step-icon {
  display: inline-flex;
  width: 21px;
  height: 21px;
}

.message-composer__poll-step-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.message-composer__poll-content {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 20px 36px 14px;
  scrollbar-color: #8d93a8 #e6e8f0;
}

.message-composer__poll-field-label {
  display: block;
  position: relative;
  z-index: 1;
  width: fit-content;
  margin: 0 0 -8px 10px;
  padding: 0 4px;
  background: #fff;
  color: #5962ff;
  font-size: 12px;
}

.message-composer__poll-title-input,
.message-composer__poll-question input[type='text'],
.message-composer__poll-question select,
.message-composer__poll-description {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #a6a6a6;
  border-radius: 0;
  background: #fff;
  color: #34364b;
  font: inherit;
  font-size: 14px;
}

.message-composer__poll-title-input {
  height: 41px;
  margin-bottom: 30px;
  padding: 8px 11px;
  border: 2px solid #5962ff;
}

.message-composer__poll-title-input:focus {
  border-color: #5962ff;
  outline: none;
}

.message-composer__poll-title-input::placeholder,
.message-composer__poll-description::placeholder,
.message-composer__poll-question input::placeholder {
  color: #7d7f89;
  opacity: 1;
}

.message-composer__poll-description {
  min-height: 126px;
  padding: 10px;
  resize: vertical;
}

.message-composer__poll-title-input.is-invalid {
  border-color: #ff2e3b;
  color: #b42318;
}

.message-composer__poll-question input.is-invalid {
  border-color: #ff2e3b;
}

.message-composer__poll-question-field {
  position: relative;
  margin-bottom: 22px;
}

.message-composer__poll-question-field.is-invalid {
  margin-bottom: 0;
}

.message-composer__poll-question-floating-label {
  position: absolute;
  z-index: 1;
  top: -7px;
  left: 10px;
  padding: 0 4px;
  background: #fff;
  color: #5962ff;
  font-size: 12px;
  line-height: 1;
}

.message-composer__poll-question-floating-label.is-invalid {
  color: #ff2e3b;
}

.message-composer__poll-question input.is-invalid::placeholder {
  color: #7d7f89;
  opacity: 1;
}

.message-composer__poll-question input.is-invalid:focus {
  border-color: #ff2e3b;
  outline: none;
  box-shadow: none;
}

.message-composer__poll-question-field input {
  height: 40px;
  padding: 8px 11px;
}

.message-composer__poll-validation-error {
  margin: 3px 0 0;
  color: #ff2e3b;
  font-size: 12px;
}

.message-composer__poll-question-field + .message-composer__poll-validation-error {
  margin: 3px 0 8px;
}

.message-composer__poll-title-input + .message-composer__poll-validation-error {
  margin: -25px 0 14px 6px;
}

.message-composer__poll-title-input.is-invalid {
  margin-bottom: 27px;
}

.message-composer__poll-hint {
  margin: 5px 0 36px;
  color: #34364b;
  font-size: 11px;
}

.message-composer__poll-question {
  margin-bottom: 12px;
}

.message-composer__poll-question h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.message-composer__poll-question h3::before,
.message-composer__poll-question h3::after {
  height: 1px;
  flex: 1;
  background: #dedede;
  content: '';
}

.message-composer__poll-question > label {
  display: block;
  margin: 0 0 8px;
  color: #171717;
  font-size: 14px;
  font-weight: 600;
}

.message-composer__poll-question-types {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.message-composer__poll-question-type {
  min-width: 0;
}

.message-composer__poll-question-type label {
  display: block;
  margin-bottom: 8px;
  color: #171717;
  font-size: 14px;
  font-weight: 600;
}

.message-composer__poll-type-select,
.message-composer__poll-rating-select {
  position: relative;
}

.message-composer__poll-type-trigger,
.message-composer__poll-rating-select select {
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 11px;
  border: 1px solid #a6a6a6;
  border-radius: 0;
  background: #fff;
  color: #34364b;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.message-composer__poll-type-trigger:focus,
.message-composer__poll-rating-select select:focus {
  border: 2px solid #5962ff;
  outline: none;
}

.message-composer__poll-type-trigger[aria-expanded='true'] {
  border: 2px solid #5962ff;
}

.message-composer__poll-select-arrow {
  width: 0;
  height: 0;
  flex: 0 0 auto;
  border-top: 5px solid #5962ff;
  border-right: 5px solid transparent;
  border-left: 5px solid transparent;
}

.message-composer__poll-type-trigger[aria-expanded='true'] .message-composer__poll-select-arrow {
  transform: rotate(180deg);
}

.message-composer__poll-rating-select select {
  padding-right: 32px;
  appearance: none;
  cursor: pointer;
}

.message-composer__poll-rating-select .message-composer__poll-select-arrow {
  position: absolute;
  top: 18px;
  right: 12px;
  pointer-events: none;
}

.message-composer__poll-type-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 1px);
  right: 0;
  left: 0;
  overflow: hidden;
  border-radius: 0 0 4px 4px;
  background: #fff;
  box-shadow: 0 4px 12px rgb(0 0 0 / 24%);
}

.message-composer__poll-type-option {
  display: block;
  width: 100%;
  min-height: 39px;
  padding: 9px 16px;
  border: 0;
  background: #fff;
  color: #292929;
  font: inherit;
  font-size: 14px;
  text-align: left;
  text-transform: lowercase;
  cursor: pointer;
}

.message-composer__poll-type-option:hover,
.message-composer__poll-type-option.is-selected {
  background: #e8e9ff;
  color: #5962ff;
}

.message-composer__poll-type-option:focus-visible {
  outline: 2px solid #5962ff;
  outline-offset: -2px;
}

.message-composer__poll-question-type select {
  margin: 0 0 22px;
}

.message-composer__poll-rating-select {
  margin-bottom: 22px;
}

.message-composer__poll-rating-select select {
  margin-bottom: 0;
}

.message-composer__poll-question-type > select {
  width: 100%;
  height: 40px;
  margin: 0 0 22px;
  padding: 8px 11px;
}

.message-composer__poll-toggles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 22px;
  margin-bottom: 16px;
}

.message-composer__poll-toggles label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #34364b;
  font-size: 14px;
}

.message-composer__poll-toggles input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: #5962ff;
}

.message-composer__poll-toggles span {
  display: flex;
  flex-direction: column;
}

.message-composer__poll-toggles small {
  color: #7d7f89;
  font-size: 11px;
}

.message-composer__poll-options {
  padding: 20px 20px 10px;
  border-left: 5px solid #1717ff;
  background: #f8f8fc;
}

.message-composer__poll-option {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 18px;
}

.message-composer__poll-option input {
  height: 33px;
  padding: 6px 8px;
}

.message-composer__poll-option button {
  display: grid;
  width: 37px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  background: #eeeeff;
  color: #5962ff;
  cursor: pointer;
}

.message-composer__poll-option button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.message-composer__poll-option button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.message-composer__poll-add-choice,
.message-composer__poll-add-question {
  width: 100%;
  min-height: 39px;
  border: 0;
  background: transparent;
  color: #1717ff;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.message-composer__poll-add-question {
  margin-top: 0;
  border: 1px solid #1717ff;
  border-radius: 4px;
}

.message-composer__poll-placeholder {
  min-height: 220px;
  color: #34364b;
}

.message-composer__poll-placeholder h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.message-composer__poll-placeholder p,
.message-composer__poll-placeholder li {
  font-size: 14px;
}

.message-composer__poll-footer {
  display: flex;
  min-height: 58px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 18px;
  border-top: 1px solid #e1e1e1;
}

.message-composer__poll-footer button {
  min-width: 65px;
  min-height: 36px;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  color: #bcbec7;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.message-composer__poll-footer button:disabled {
  cursor: not-allowed;
}

.message-composer__poll-footer .message-composer__poll-next {
  background: #5962ff;
  color: #fff;
}

.message-composer__poll-footer .message-composer__poll-next:disabled {
  opacity: 0.6;
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

  .message-composer__poll-content {
    padding: 20px 18px;
  }

  .message-composer__poll-modal {
    max-height: min(92vh, 620px);
  }

  .message-composer__poll-header {
    padding: 0 18px;
  }

  .message-composer__poll-option {
    gap: 8px;
  }

  .message-composer__poll-options {
    padding: 14px 10px 8px;
  }

  .message-composer__poll-question-types {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
