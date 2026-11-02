/**
 * Mock team data — mirrors the production UI screenshot.
 * Simulates a ~300ms network delay for realistic loading states.
 */

const MOCK_DATA_KEY = 'whistleit:shell-mock-data'

const initialWorkspaces = [
  { id: 'workspace-1', name: 'WhistleIt', initials: 'WI' },
  { id: 'workspace-2', name: 'Design', initials: 'DE' },
]

const initialUserTeams = [
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

const initialDiscoverableTeams = [
  ...initialUserTeams,
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

function loadMockData() {
  try {
    const stored = localStorage.getItem(MOCK_DATA_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        Array.isArray(parsed.workspaces) &&
        Array.isArray(parsed.userTeams) &&
        Array.isArray(parsed.discoverableTeams)
      ) {
        return parsed
      }
    }
  } catch (error) {
    console.warn('Could not load persisted shell mock data:', error)
  }

  return {
    workspaces: initialWorkspaces,
    userTeams: initialUserTeams,
    discoverableTeams: initialDiscoverableTeams,
  }
}

const mockData = loadMockData()
let _workspaces = mockData.workspaces
let _userTeams = mockData.userTeams
let _allTeams = mockData.discoverableTeams

function persistMockData() {
  try {
    localStorage.setItem(
      MOCK_DATA_KEY,
      JSON.stringify({
        workspaces: _workspaces,
        userTeams: _userTeams,
        discoverableTeams: _allTeams,
      }),
    )
  } catch (error) {
    console.warn('Could not persist shell mock data:', error)
  }
}

function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function mockTeams() {
  await delay()
  return [..._userTeams]
}

export async function mockWorkspaces() {
  await delay()
  return _workspaces.map((workspace) => ({ ...workspace }))
}

export async function mockWorkspaceTeams(workspaceId) {
  await delay()
  return _userTeams.filter((team) => team.workspaceId === workspaceId).map((team) => ({ ...team }))
}

export async function mockCreateTeam(payload) {
  await delay(400)
  const nextId =
    Math.max(100, ..._allTeams.map((team) => Number(String(team.id).replace('team-', '')) || 0)) + 1
  const id = `team-${nextId}`
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
  persistMockData()
  return team
}

export async function mockUpdateTeam(workspaceId, teamId, payload) {
  await delay(300)
  const team = _userTeams.find((item) => item.id === teamId && item.workspaceId === workspaceId)
  if (!team) throw new Error('The team could not be found.')
  Object.assign(team, payload, { workspaceId })
  persistMockData()
  return { ...team }
}

export async function mockDeleteTeam(workspaceId, teamId) {
  await delay(300)
  const team = _userTeams.find((item) => item.id === teamId && item.workspaceId === workspaceId)
  if (!team) throw new Error('The team could not be found.')
  _userTeams = _userTeams.filter((item) => item !== team)
  _allTeams = _allTeams.filter((item) => item.id !== teamId)
  persistMockData()
  return { success: true }
}

export async function mockCreateWorkspace(payload) {
  await delay(300)
  const nextId =
    Math.max(
      0,
      ..._workspaces.map(
        (workspace) => Number(String(workspace.id).replace('workspace-', '')) || 0,
      ),
    ) + 1
  const workspace = {
    id: `workspace-${nextId}`,
    name: payload.name,
    initials: payload.initials,
  }
  _workspaces.push(workspace)
  persistMockData()
  return { ...workspace }
}

export async function mockJoinTeam(inviteCode, workspaceIdOverride = null) {
  await delay(400)
  const code = String(inviteCode).trim()
  if (code.toLowerCase() === 'invalid' || code.length < 6) {
    throw new Error('This invite code is invalid or has expired.')
  }

  const foundTeam =
    _allTeams.find((item) => item.id === code) ??
    _allTeams.find((item) => item.inviteCode?.toLowerCase() === code.toLowerCase())

  let team = foundTeam
    ? { ...foundTeam, workspaceId: workspaceIdOverride ?? foundTeam.workspaceId }
    : null

  if (!team) {
    const workspaceId = workspaceIdOverride ?? _workspaces[1]?.id ?? _workspaces[0]?.id
    if (!workspaceId) throw new Error('No workspace is available for this invite.')
    team = {
      id: `invite-${encodeURIComponent(code.toLowerCase())}`,
      name: 'Joined Team',
      initials: 'JT',
      color: 'var(--color-indigo-500)',
      memberCount: 1,
      workspaceId,
      inviteCode: code,
    }
    _allTeams.push(team)
  }

  const alreadyMember = _userTeams.some((item) => item.id === team.id)
  if (!alreadyMember) _userTeams.push(team)
  persistMockData()
  return { team: { ...team }, workspaceId: team.workspaceId, alreadyMember }
}

export async function mockSearchTeams(query) {
  await delay(250)
  const q = query.toLowerCase()
  return _allTeams.filter((t) => t.name.toLowerCase().includes(q))
}
