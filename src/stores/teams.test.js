import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  getWorkspaces: vi.fn(),
  getWorkspaceTeams: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
}))

vi.mock('@/features/shell/api/workspacesApi', () => ({
  getWorkspaces: api.getWorkspaces,
  getWorkspaceTeams: api.getWorkspaceTeams,
}))

vi.mock('@/features/shell/api/teamsApi', () => ({
  createTeam: api.createTeam,
  updateTeam: api.updateTeam,
  deleteTeam: api.deleteTeam,
}))

import { useTeamsStore } from './teams'

const workspaces = [
  { id: 'workspace-1', name: 'WhistleIt', initials: 'WI', role: 'admin', isAdmin: true },
  { id: 'workspace-2', name: 'Design', initials: 'DE', role: 'member', isAdmin: false },
]
const teamsByWorkspace = {
  'workspace-1': [
    { id: 'team-1', name: 'Programmers Force', workspaceId: 'workspace-1' },
    { id: 'team-2', name: 'CM Intern Program', workspaceId: 'workspace-1' },
  ],
  'workspace-2': [
    { id: 'team-3', name: 'ThirdTeam', workspaceId: 'workspace-2' },
    { id: 'team-4', name: 'Design Guild', workspaceId: 'workspace-2' },
  ],
}

describe('teams store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const rememberedTeams = new Map()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => rememberedTeams.get(key) ?? null),
      setItem: vi.fn((key, value) => rememberedTeams.set(key, value)),
      removeItem: vi.fn((key) => rememberedTeams.delete(key)),
    })
    api.getWorkspaces.mockResolvedValue(workspaces)
    api.getWorkspaceTeams.mockImplementation(async (workspaceId) => [
      ...(teamsByWorkspace[workspaceId] ?? []),
    ])
    api.createTeam.mockImplementation(async (payload) => ({
      id: 'team-new',
      name: payload.name,
      workspaceId: payload.workspaceId,
    }))
    api.updateTeam.mockImplementation(async (workspaceId, teamId, payload) => ({
      ...teamsByWorkspace[workspaceId].find((team) => team.id === teamId),
      ...payload,
      id: teamId,
      workspaceId,
    }))
    api.deleteTeam.mockResolvedValue({ success: true })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('starts with no active team', () => {
    const store = useTeamsStore()
    expect(store.teams).toEqual([])
    expect(store.activeTeamId).toBeNull()
    expect(store.activeTeam).toBeNull()
    expect(store.isAdmin).toBe(false)
  })

  it('fetches workspaces and teams and selects the first team', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()

    expect(store.workspaces).toEqual(workspaces)
    expect(store.activeTeamId).toBe('team-1')
    expect(store.activeTeam).toEqual(teamsByWorkspace['workspace-1'][0])
  })

  it('filters teams by search query', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()
    store.searchQuery = 'Programmers'
    expect(store.filteredTeams.map((team) => team.name)).toEqual(['Programmers Force'])
  })

  it('creates a new team in the active workspace and selects it', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()

    const team = await store.createTeam({ name: 'Alpha Squad' })

    expect(api.createTeam).toHaveBeenCalledWith({
      name: 'Alpha Squad',
      workspaceId: 'workspace-1',
    })
    expect(store.activeTeamId).toBe(team.id)
    expect(store.teams).toContainEqual(team)
  })

  it('updates and deletes teams from the active workspace', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()

    await store.updateTeam('team-1', { name: 'Updated team' })
    expect(store.teams[0].name).toBe('Updated team')
    expect(api.updateTeam).toHaveBeenCalledWith('workspace-1', 'team-1', {
      name: 'Updated team',
    })

    await store.deleteTeam('team-1')
    expect(store.teams.map((team) => team.id)).toEqual(['team-2'])
    expect(store.activeTeamId).toBe('team-2')
    expect(api.deleteTeam).toHaveBeenCalledWith('workspace-1', 'team-1')
  })

  it('switches workspaces, isolates teams, and remembers each active team', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    await store.selectWorkspace('workspace-1')
    expect(store.activeWorkspaceRole).toBe('admin')
    expect(store.isAdmin).toBe(true)
    store.selectTeam('team-2')
    await store.selectWorkspace('workspace-2')
    expect(store.activeTeamId).toBe('team-3')
    expect(store.activeWorkspaceRole).toBe('member')
    expect(store.isAdmin).toBe(false)
    expect(store.teams.every((team) => team.workspaceId === 'workspace-2')).toBe(true)

    await store.selectWorkspace('workspace-1')
    expect(store.activeTeamId).toBe('team-2')
    expect(store.teams.every((team) => team.workspaceId === 'workspace-1')).toBe(true)
  })

  it('treats a missing workspace role as non-admin', async () => {
    api.getWorkspaces.mockResolvedValue([{ id: 'workspace-unknown', name: 'Unknown Role' }])
    const store = useTeamsStore()

    await store.fetchWorkspaces()

    expect(store.activeWorkspaceRole).toBeNull()
    expect(store.isAdmin).toBe(false)
  })

  it('removes a departed team and remembers the next team in the workspace', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()
    store.selectTeam('team-1')

    expect(store.removeTeamFromWorkspace('team-1')).toBe('team-2')

    expect(store.teams.map((team) => team.id)).toEqual(['team-2'])
    expect(store.activeTeamId).toBe('team-2')
    expect(localStorage.getItem('whistleit:last-team:workspace-1')).toBe('team-2')
  })

  it('clears the last-team cache and active team when leaving the only team', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()
    store.teamsByWorkspaceId = {
      'workspace-1': [teamsByWorkspace['workspace-1'][0]],
      'workspace-2': teamsByWorkspace['workspace-2'],
    }
    store.selectTeam('team-1')

    expect(store.removeTeamFromWorkspace('team-1')).toBeNull()

    expect(store.teams).toEqual([])
    expect(store.activeTeamId).toBeNull()
    expect(localStorage.getItem('whistleit:last-team:workspace-1')).toBeNull()
  })

  it('ignores a stale team response after switching workspaces', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()
    const resolveRequest = {}
    api.getWorkspaceTeams.mockImplementation(
      (workspaceId) =>
        new Promise((resolve) => {
          resolveRequest[workspaceId] = resolve
        }),
    )

    const firstSelection = store.selectWorkspace('workspace-1')
    const secondSelection = store.selectWorkspace('workspace-2')
    resolveRequest['workspace-2'](teamsByWorkspace['workspace-2'])
    await secondSelection
    resolveRequest['workspace-1'](teamsByWorkspace['workspace-1'])
    await firstSelection

    expect(store.activeWorkspaceId).toBe('workspace-2')
    expect(store.teams).toEqual(teamsByWorkspace['workspace-2'])
    expect(store.activeTeamId).toBe('team-3')
  })
})
