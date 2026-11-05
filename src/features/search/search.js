// Mock search API. Replace each function body with the real call, e.g.
// return api.get('/search/files', { params })  (central client in lib/api).
// Keep the return shape: { items, totalPages }.

const FILES = []
const MESSAGES = []
const LINKS = []
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const CHANNEL_MESSAGES_STORAGE_KEY = 'whistleit:channel-messages'

function readStoredChannelMessages() {
  if (typeof localStorage === 'undefined') return []

  try {
    const stored = JSON.parse(localStorage.getItem(CHANNEL_MESSAGES_STORAGE_KEY) || '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return []

    return Object.entries(stored).flatMap(([channelId, messages]) =>
      (Array.isArray(messages) ? messages : [])
        .filter((message) => !message.scheduled && !message.deleted)
        .map((message) => ({
          id: message.id,
          webhook: false,
          createdAt: message.createdAt || '',
          sender: message.author || 'Unknown user',
          userId: String(message.authorId || ''),
          text: message.content ?? message.text ?? '',
          conversation: {
            id: String(channelId),
            name: String(channelId),
            kind: 'public',
          },
        })),
    )
  } catch (error) {
    console.error('Unable to load channel messages for search:', error)
    return []
  }
}

// Lets the composer / upload code make a sent file show up in File search (mock mode only).
export function addMockFile(file) {
  FILES.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...file })
}

export function addMockMessage(message) {
  MESSAGES.unshift({
    id: message.id || crypto.randomUUID(),
    webhook: false,
    createdAt: message.createdAt || new Date().toISOString(),
    sender: message.sender || 'You',
    userId: message.userId || 'current-user',
    text: message.text || message.content || '',
    conversation: message.conversation || { id: 'general', name: 'General', kind: 'public' },
  })
}

export function updateMockMessage(id, text) {
  const message = MESSAGES.find((item) => String(item.id) === String(id))
  if (message) message.text = text
}

export function removeMockMessage(id) {
  const index = MESSAGES.findIndex((item) => String(item.id) === String(id))
  if (index !== -1) MESSAGES.splice(index, 1)
}

function applyFilters(
  list,
  { q, userIds = [], date, dateEnd, dateMode = 'on', webhooks, channelId, dmConversationId },
  textKey,
) {
  const needle = (q || '').toLowerCase()
  return list.filter(
    (i) =>
      (!needle || String(i[textKey]).toLowerCase().includes(needle)) &&
      (!userIds.length ||
        userIds.map(String).includes(String(i.userId))) &&
      (!date ||
        (dateMode === 'before' && i.createdAt.slice(0, 10) < date) ||
        (dateMode === 'after' && i.createdAt.slice(0, 10) > date) ||
        (dateMode === 'range' &&
          i.createdAt.slice(0, 10) >= date &&
          (!dateEnd || i.createdAt.slice(0, 10) <= dateEnd)) ||
        (dateMode === 'on' && i.createdAt.slice(0, 10) === date)) &&
      (!webhooks || i.webhook) &&
      (!channelId || i.conversation?.id === channelId) &&
      (!dmConversationId ||
        i.conversation?.kind !== 'dm' ||
        i.conversation?.id === dmConversationId),
  )
}

export async function searchMessages(p) {
  await wait()
  const dmMessages = Array.isArray(p.dmMessages) ? p.dmMessages : []
  const combined = [...MESSAGES, ...readStoredChannelMessages(), ...dmMessages].filter(
    (message, index, messages) =>
      messages.findIndex((candidate) => String(candidate.id) === String(message.id)) === index,
  )
  const filtered = applyFilters(combined, p, 'text')
  const page = p.page || 1
  const pageSize = p.pageSize || filtered.length || 1
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    total: filtered.length,
  }
}
export async function searchLinks(p) {
  await wait()
  return { items: applyFilters(LINKS, p, 'url'), totalPages: 1 }
}
export async function searchFiles(p) {
  await wait()
  const all = applyFilters(FILES, p, 'name')
  const size = p.pageSize || 6
  const page = p.page || 1
  return {
    items: all.slice((page - 1) * size, page * size),
    totalPages: Math.max(1, Math.ceil(all.length / size)),
  }
}
export async function searchUsers(q) {
  return []
}
