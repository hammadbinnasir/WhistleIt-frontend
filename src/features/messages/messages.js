import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'whistleit.messages.v1'
const PAGE_SIZE = 5
export const CURRENT_USER_NAME = 'Muniba'
const LEGACY_CURRENT_USER_NAME = 'Jamie'

function timestamp(daysAgo, hour, minute) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function makeMessage(id, author, content, daysAgo, hour, minute, extra = {}) {
  return {
    id,
    author,
    ...(author === CURRENT_USER_NAME ? { authorId: 'current-user' } : {}),
    content,
    createdAt: timestamp(daysAgo, hour, minute),
    reactions: {},
    pinned: false,
    ...extra,
  }
}

function createSeedMessages() {
  return {
    general: [
      makeMessage(
        'g-1',
        'Mahmal',
        'Welcome to the team chat! Use this channel for general updates.',
        1,
        9,
        12,
      ),
      makeMessage('g-2', 'Ayeza', 'I added a quick guide for getting started with Vue.', 1, 9, 24, {
        content:
          'I added a quick guide for getting started with Vue: https://vuejs.org/guide/introduction.html',
      }),
      makeMessage('g-3', 'Muniba', 'Thanks! I will take a look this morning.', 1, 9, 35),
      makeMessage(
        'g-4',
        'Asma',
        'The new designs are ready for review. Feedback welcome!',
        0,
        9,
        8,
      ),
      makeMessage('g-5', 'Aima', 'Here is the staging build: https://vite.dev/guide/', 0, 9, 20),
      makeMessage('g-6', 'Sara', 'Nice, the page loads much faster now.', 0, 9, 34),
      makeMessage(
        'g-7',
        'Alex',
        'Could someone review the message actions before we ship?',
        0,
        10,
        3,
      ),
      makeMessage('g-8', 'Muniba', 'I am on it. Reply here if you spot anything else.', 0, 10, 12),
    ],
    random: [
      makeMessage('r-1', 'Mahmal', 'What is everyone working on this week?', 0, 9, 45),
      makeMessage('r-2', 'Muniba', 'Finishing up the chat experience today.', 0, 10, 5),
    ],
    frontend: [
      makeMessage('f-1', 'Alex', 'Frontend sync notes are ready for the team.', 0, 9, 30),
      makeMessage('f-2', 'Ayeza', 'Remember to include mobile layouts in reviews.', 0, 9, 42),
    ],
  }
}

function readSavedMessages() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return null

  try {
    const parsed = JSON.parse(saved)
    if (!parsed || typeof parsed.messagesByChannel !== 'object') {
      throw new Error('Saved message data has an invalid shape.')
    }
    return parsed
  } catch (error) {
    throw new Error(`Unable to load saved messages: ${error.message}`, { cause: error })
  }
}

export const useMessagesStore = defineStore('messages', () => {
  const saved = readSavedMessages()
  const previousUserName = saved?.currentUserName ?? LEGACY_CURRENT_USER_NAME
  for (const channelMessages of Object.values(saved?.messagesByChannel ?? {})) {
    if (!Array.isArray(channelMessages)) continue
    for (const message of channelMessages) {
      if (
        message.authorId === 'current-user' ||
        message.author === CURRENT_USER_NAME ||
        (previousUserName !== CURRENT_USER_NAME && message.author === previousUserName)
      ) {
        message.authorId = 'current-user'
        message.author = CURRENT_USER_NAME
      }
      if (previousUserName !== CURRENT_USER_NAME) {
        for (const people of Object.values(message.reactions ?? {})) {
          const previousNameIndex = people.indexOf(previousUserName)
          if (previousNameIndex !== -1) people[previousNameIndex] = CURRENT_USER_NAME
        }
      }
    }
  }
  const messagesByChannel = ref(saved?.messagesByChannel ?? createSeedMessages())
  const visibleCounts = ref(saved?.visibleCounts ?? {})

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentUserName: CURRENT_USER_NAME,
        messagesByChannel: messagesByChannel.value,
        visibleCounts: visibleCounts.value,
      }),
    )
  }

  function messagesFor(channelId) {
    return messagesByChannel.value[channelId] ?? []
  }

  function visibleMessagesFor(channelId) {
    const messages = messagesFor(channelId)
    const count = visibleCounts.value[channelId] ?? PAGE_SIZE
    return messages.slice(Math.max(0, messages.length - count))
  }

  function hasOlderMessages(channelId) {
    return (visibleCounts.value[channelId] ?? PAGE_SIZE) < messagesFor(channelId).length
  }

  function loadOlder(channelId) {
    visibleCounts.value[channelId] = (visibleCounts.value[channelId] ?? PAGE_SIZE) + PAGE_SIZE
  }

  function sendMessage(channelId, content, replyTo = null) {
    const message = {
      id:
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author: CURRENT_USER_NAME,
      authorId: 'current-user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
      reactions: {},
      pinned: false,
      replyTo,
    }
    if (!message.content) return
    messagesByChannel.value[channelId] = [...messagesFor(channelId), message]
    visibleCounts.value[channelId] = Math.max(
      visibleCounts.value[channelId] ?? PAGE_SIZE,
      messagesByChannel.value[channelId].length,
    )
    persist()
  }

  function editMessage(channelId, messageId, content) {
    const message = messagesFor(channelId).find(({ id }) => id === messageId)
    if (!message || !content.trim()) return
    message.content = content.trim()
    message.editedAt = new Date().toISOString()
    persist()
  }

  function deleteMessage(channelId, messageId) {
    messagesByChannel.value[channelId] = messagesFor(channelId).filter(({ id }) => id !== messageId)
    persist()
  }

  function toggleReaction(channelId, messageId, emoji) {
    const message = messagesFor(channelId).find(({ id }) => id === messageId)
    if (!message) return
    const reactions = (message.reactions ??= {})
    const people = (reactions[emoji] ??= [])
    const index = people.indexOf(CURRENT_USER_NAME)
    if (index === -1) people.push(CURRENT_USER_NAME)
    else people.splice(index, 1)
    if (people.length === 0) delete reactions[emoji]
    persist()
  }

  function togglePin(channelId, messageId) {
    const message = messagesFor(channelId).find(({ id }) => id === messageId)
    if (!message) return
    message.pinned = !message.pinned
    persist()
  }

  function setReminder(channelId, messageId, reminderAt, reminderTitle) {
    const message = messagesFor(channelId).find(({ id }) => id === messageId)
    if (!message) return
    message.reminderAt = reminderAt
    message.reminderTitle = reminderTitle.trim()
    persist()
  }

  return {
    currentUserName: CURRENT_USER_NAME,
    messagesByChannel,
    visibleCounts,
    pageSize: PAGE_SIZE,
    messagesFor,
    visibleMessagesFor,
    hasOlderMessages,
    loadOlder,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePin,
    setReminder,
  }
})
