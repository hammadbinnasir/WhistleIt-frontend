// In-memory fake backend so you can build and test the UI before the real APIs exist.
// Enabled with VITE_CHANNELS_USE_MOCK=true. Same function signatures as channels.api.js.
import { ApiError } from './http'
import { normalizeChannel, normalizeMember } from './normalizers'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

const mk = (id, name, extra = {}) => ({
  id: String(id),
  name,
  description: '',
  isPrivate: false,
  isDefault: false,
  isArchived: false,
  isMember: true,
  isFavorite: false,
  isMuted: false,
  isUnread: false,
  unreadCount: 0,
  memberCount: 232,
  canManage: false,
  ...extra,
})

let nextId = 100
const db = [
  mk(1, 'Announcements', {
    description: 'This is a default channel. All team members will be added to this channel.',
    isDefault: true,
    canManage: false,
  }),
  mk(2, 'Cmit Batch 2 Daily Updates', { unreadCount: 3 }),
  mk(3, 'Frontend & Backend Sync', { isPrivate: true, memberCount: 18 }),
  mk(4, 'Frontend Discussion', { memberCount: 40 }),
  mk(5, 'Frontend Team Cmi 2', { memberCount: 9 }),
  mk(6, "Intern's B2 Connect", { memberCount: 60 }),
  mk(7, 'Design Reviews', { isMember: false, description: 'Share designs for feedback.' }),
  mk(8, 'Random', { isMember: false, description: 'Off-topic chat.' }),
  mk(9, 'Backend APIs', { isMember: false, description: 'API questions and contracts.' }),
]

const find = (id) => {
  const channel = db.find((c) => c.id === String(id))
  if (!channel) throw new ApiError('Channel not found.', { status: 404 })
  return channel
}

const FIRST = [
  'Ahmad',
  'Ali',
  'Areeba',
  'Hamza',
  'Sara',
  'Usman',
  'Ayesha',
  'Bilal',
  'Zainab',
  'Omar',
]
const LAST = ['Imran', 'Khan', 'Raza', 'Malik', 'Sheikh', 'Butt', 'Qureshi', 'Ahmed']

export async function listMyChannels() {
  await delay()
  return db.filter((c) => c.isMember && !c.isArchived).map(normalizeChannel)
}

export async function getChannel(id) {
  await delay()
  return normalizeChannel(find(id))
}

export async function browseChannels(query = '') {
  await delay(200)
  const q = query.toLowerCase()
  return db
    .filter((c) => !c.isArchived && (!c.isPrivate || c.isMember))
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .map(normalizeChannel)
}

export async function createChannel({ name, description, isPrivate, type }) {
  await delay()
  if (db.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError('A channel with this name already exists.', { status: 409 })
  }
  const channel = mk(nextId++, name, {
    description,
    isPrivate: isPrivate ?? type === 'private',
    memberCount: 1,
    canManage: true,
  })
  db.push(channel)
  return normalizeChannel(channel)
}

export async function updateChannel(id, { name, description, messagePermission }) {
  await delay()
  const channel = find(id)
  if (db.some((c) => c.id !== channel.id && c.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError('A channel with this name already exists.', { status: 409 })
  }
  Object.assign(channel, {
    name,
    description,
    ...(messagePermission ? { messagePermission } : {}),
  })
  return normalizeChannel(channel)
}

export async function joinChannel(id) {
  await delay()
  const channel = find(id)
  channel.isMember = true
  channel.memberCount += 1
  return normalizeChannel(channel)
}

export async function leaveChannel(id) {
  await delay()
  const channel = find(id)
  if (channel.isDefault) throw new ApiError('You cannot leave a default channel.', { status: 403 })
  channel.isMember = false
  channel.memberCount = Math.max(0, channel.memberCount - 1)
}

export async function deleteChannel(id) {
  await delay()
  const channel = find(id)
  if (channel.isDefault) throw new ApiError('A default channel cannot be deleted.', { status: 403 })
  db.splice(db.indexOf(channel), 1)
}

export async function listMembers(id, { limit = 10 } = {}) {
  await delay(150)
  const total = find(id).memberCount
  const items = Array.from({ length: Math.min(limit, total) }, (_, i) =>
    normalizeMember({
      id: i + 1,
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
      status: i % 3 === 0 ? 'online' : i % 3 === 1 ? 'away' : 'offline',
    }),
  )
  return { items, total }
}

export async function addChannelMember(id, targetUser) {
  await delay()
  if (targetUser == null || String(targetUser).trim() === '') {
    throw new ApiError('A user ID is required to add a channel member.', { status: 400 })
  }
  const channel = find(id)
  channel.memberCount += 1
  return { user_id: String(targetUser) }
}

export async function removeChannelMember(id, targetUser) {
  await delay()
  if (targetUser == null || String(targetUser).trim() === '') {
    throw new ApiError('A user ID is required to remove a channel member.', { status: 400 })
  }
  const channel = find(id)
  channel.memberCount = Math.max(0, channel.memberCount - 1)
}
