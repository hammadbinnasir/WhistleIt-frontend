/**
 * Mock team data — mirrors the production UI screenshot.
 * Simulates a ~300ms network delay for realistic loading states.
 */

let _nextId = 100

const _userTeams = [
  {
    id: 'team-1',
    name: 'Programmers Force',
    initials: 'PF',
    color: '#7C3AED',
    memberCount: 24,
    workspaceId: 'workspace-1',
  },
  {
    id: 'team-2',
    name: 'CM Intern Program',
    initials: 'CI',
    color: '#2DD4BF',
    memberCount: 18,
    workspaceId: 'workspace-1',
  },
  {
    id: 'team-3',
    name: 'ThirdTeam',
    initials: 'TT',
    color: '#F97316',
    memberCount: 6,
    workspaceId: 'workspace-2',
  },
  {
    id: 'team-4',
    name: 'Design Guild',
    initials: 'DG',
    color: '#EC4899',
    memberCount: 12,
    workspaceId: 'workspace-2',
  },
]

const _allTeams = [
  ..._userTeams,
  {
    id: 'team-5',
    name: 'Backend Crew',
    initials: 'BC',
    color: '#3B82F6',
    memberCount: 9,
    workspaceId: 'workspace-2',
  },
  {
    id: 'team-6',
    name: 'QA Warriors',
    initials: 'QW',
    color: '#EAB308',
    memberCount: 7,
    workspaceId: 'workspace-2',
  },
]

function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function mockTeams() {
  await delay()
  return [..._userTeams]
}

export async function mockWorkspaces() {
  await delay()
  return [
    { id: 'workspace-1', name: 'WhistleIt', initials: 'WI' },
    { id: 'workspace-2', name: 'Design', initials: 'DE' },
  ]
}

export async function mockWorkspaceTeams(workspaceId) {
  await delay()
  return _userTeams.filter((team) => team.workspaceId === workspaceId).map((team) => ({ ...team }))
}

export async function mockCreateTeam(payload) {
  await delay(400)
  const id = `team-${++_nextId}`
  const initials = payload.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const team = {
    id,
    name: payload.name,
    initials,
    color: payload.color || '#7C3AED',
    memberCount: 1,
    workspaceId: payload.workspaceId,
  }
  _userTeams.push(team)
  _allTeams.push(team)
  return team
}

export async function mockJoinTeam(teamId) {
  await delay(400)
  const team = _allTeams.find((t) => t.id === teamId)
  if (!team) throw { status: 404, message: 'Team not found' }
  if (!_userTeams.find((t) => t.id === teamId)) {
    _userTeams.push(team)
  }
  return team
}

export async function mockSearchTeams(query) {
  await delay(250)
  const q = query.toLowerCase()
  return _allTeams.filter((t) => t.name.toLowerCase().includes(q))
}
