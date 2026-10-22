/**
 * Mock member data — matches the production user list.
 * Simulates a ~300ms network delay for realistic loading states.
 */

let _nextMemberId = 200

const _teamMembers = {
  'team-1': [
    { id: 'u1', name: 'Hammad Bin Nasir', email: 'hammad@pf.com', status: 'online', role: 'admin', avatar: null },
    { id: 'u2', name: 'Taha Jawad', email: 'taha@pf.com', status: 'online', role: 'member', avatar: null },
    { id: 'u3', name: 'Muhammad Abdul...', email: 'mabdul@pf.com', status: 'online', role: 'member', avatar: null },
    { id: 'u4', name: 'Muhammad Hum...', email: 'mhum@pf.com', status: 'online', role: 'member', avatar: null },
    { id: 'u5', name: 'Syed Mukarram Ali', email: 'mukarram@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u6', name: 'Muhammad Abdul...', email: 'mabdul2@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u7', name: 'Ali Raza Akram', email: 'ali@pf.com', status: 'online', role: 'member', avatar: null },
    { id: 'u8', name: 'Waqas Khaliq Sail', email: 'waqas@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u9', name: 'Salman Zahoor', email: 'salman@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u10', name: 'Anil Watcher', email: 'anil@pf.com', status: 'online', role: 'member', avatar: null },
    { id: 'u11', name: 'Ali Umais', email: 'umais@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u12', name: 'Moesha Naseer', email: 'moesha@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u13', name: 'Ameer Iqbal', email: 'ameer@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u14', name: 'Syed Mukarram Ali', email: 'mukarram2@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u15', name: 'Hafiz Muhammad...', email: 'hafiz@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u16', name: 'Kumeil Raza Haider', email: 'kumeil@pf.com', status: 'offline', role: 'member', avatar: null },
    { id: 'u17', name: 'Muhammad Ansar...', email: 'ansar@pf.com', status: 'offline', role: 'member', avatar: null },
  ],
  'team-2': [
    { id: 'u1', name: 'Hammad Bin Nasir', email: 'hammad@pf.com', status: 'online', role: 'admin', avatar: null },
    { id: 'u2', name: 'Taha Jawad', email: 'taha@pf.com', status: 'online', role: 'member', avatar: null },
    { id: 'u7', name: 'Ali Raza Akram', email: 'ali@pf.com', status: 'offline', role: 'member', avatar: null },
  ],
  'team-3': [
    { id: 'u1', name: 'Hammad Bin Nasir', email: 'hammad@pf.com', status: 'online', role: 'admin', avatar: null },
    { id: 'u10', name: 'Anil Watcher', email: 'anil@pf.com', status: 'online', role: 'member', avatar: null },
  ],
}

// Users available for adding to teams (not already members)
const _allUsers = [
  { id: 'u20', name: 'Sarah Khan', email: 'sarah@pf.com' },
  { id: 'u21', name: 'Ahmed Malik', email: 'ahmed@pf.com' },
  { id: 'u22', name: 'Fatima Zahra', email: 'fatima@pf.com' },
  { id: 'u23', name: 'Usman Ghani', email: 'usman@pf.com' },
  { id: 'u24', name: 'Ayesha Siddiqui', email: 'ayesha@pf.com' },
]

function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function mockGetMembers(teamId) {
  await delay()
  return [...(_teamMembers[teamId] ?? [])]
}

export async function mockAddMember(teamId, userId) {
  await delay(400)
  // Check if it's an existing user from _allUsers
  const existing = _allUsers.find((u) => u.id === userId)
  const member = existing
    ? { ...existing, status: 'offline', role: 'member', avatar: null }
    : {
        id: `u${++_nextMemberId}`,
        name: `User ${_nextMemberId}`,
        email: `user${_nextMemberId}@pf.com`,
        status: 'offline',
        role: 'member',
        avatar: null,
      }
  if (!_teamMembers[teamId]) _teamMembers[teamId] = []
  _teamMembers[teamId].push(member)
  return member
}

export async function mockRemoveMember(teamId, userId) {
  await delay(300)
  if (_teamMembers[teamId]) {
    _teamMembers[teamId] = _teamMembers[teamId].filter((m) => m.id !== userId)
  }
  return { success: true }
}

/** Helper: search users available for adding. */
export async function mockSearchUsers(query) {
  await delay(200)
  const q = query.toLowerCase()
  return _allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  )
}
