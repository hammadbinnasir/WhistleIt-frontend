// Mock search API. Replace each function body with the real call, e.g.
// return api.get('/search/files', { params })  (central client in lib/api).
// Keep the return shape: { items, totalPages }.

const FILES = [
  {
    id: 'f1',
    name: 'voice-note.mp3',
    type: 'audio',
    url: '#',
    sharedBy: 'Waqar Khaliq Sial',
    userId: 'u7',
    conversation: { id: 'frontend', name: 'Frontend & Backend Team Cmi 2', kind: 'private' },
    createdAt: '2026-10-19T10:00:00Z',
  },
  {
    id: 'f2',
    name: 'LOM my.pdf',
    type: 'pdf',
    url: '#',
    sharedBy: 'Salman Zahoor',
    userId: 'u9',
    conversation: { id: 'general', name: 'Muhammad Abdullah Tariq', kind: 'dm' },
    createdAt: '2026-10-20T09:00:00Z',
  },
  {
    id: 'f3',
    name: 'Team member.docx',
    type: 'doc',
    url: '#',
    sharedBy: 'Muhammad Ahmad Imran',
    userId: 'u4',
    conversation: { id: 'frontend', name: 'Frontend Discussion', kind: 'public' },
    createdAt: '2026-10-20T12:00:00Z',
  },
]
const MESSAGES = [
  {
    id: 'm1',
    text: 'Please finish the search page today',
    sender: 'Hammad Bin Nasir',
    userId: 'u3',
    conversation: { id: 'frontend', name: 'Frontend Discussion', kind: 'public' },
    createdAt: '2026-10-21T08:30:00Z',
    webhook: false,
  },
]
const LINKS = [
  {
    id: 'l1',
    url: 'https://app.whistleit.io',
    sender: 'Ansar Fareed',
    userId: 'u1',
    conversation: { id: 'frontend', name: 'Frontend Discussion', kind: 'public' },
    createdAt: '2026-10-20T08:00:00Z',
    webhook: false,
  },
]
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// Lets the composer / upload code make a sent file show up in File search (mock mode only).
export function addMockFile(file) {
  FILES.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...file })
}

export function addMockMessage(message) {
  MESSAGES.unshift({
    id: message.id || crypto.randomUUID(),
    webhook: false,
    createdAt: new Date().toISOString(),
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
  { q, userIds = [], date, dateEnd, dateMode = 'on', webhooks, channelId },
  textKey,
) {
  const needle = (q || '').toLowerCase()
  return list.filter(
    (i) =>
      (!needle || String(i[textKey]).toLowerCase().includes(needle)) &&
      (!userIds.length || userIds.includes(i.userId)) &&
      (!date ||
        (dateMode === 'before' && i.createdAt.slice(0, 10) < date) ||
        (dateMode === 'after' && i.createdAt.slice(0, 10) > date) ||
        (dateMode === 'range' &&
          i.createdAt.slice(0, 10) >= date &&
          (!dateEnd || i.createdAt.slice(0, 10) <= dateEnd)) ||
        (dateMode === 'on' && i.createdAt.slice(0, 10) === date)) &&
      (!webhooks || i.webhook) &&
      (!channelId || i.conversation?.id === channelId),
  )
}

export async function searchMessages(p) {
  await wait()
  return { items: applyFilters(MESSAGES, p, 'text'), totalPages: 1 }
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
  await wait(100)
  const users = [
    { id: 'u1', name: 'Ansar Fareed' },
    { id: 'u3', name: 'Hammad Bin Nasir' },
    { id: 'u4', name: 'Muhammad Ahmad Imran' },
    { id: 'u5', name: 'Aiman Iqbal' },
    { id: 'u7', name: 'Waqar Khaliq Sial' },
    { id: 'u9', name: 'Salman Zahoor' },
  ]
  return users.filter((u) => u.name.toLowerCase().includes((q || '').toLowerCase()))
}
