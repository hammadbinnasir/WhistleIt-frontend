import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  getWorkspaces: vi.fn(),
  getWorkspaceTeams: vi.fn(),
  createWorkspace: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  joinTeam: vi.fn(),
}))

vi.mock('@/features/shell/api/workspacesApi', () => ({
  getWorkspaces: api.getWorkspaces,
  getWorkspaceTeams: api.getWorkspaceTeams,
  createWorkspace: api.createWorkspace,
}))

vi.mock('@/features/shell/api/teamsApi', () => ({
  createTeam: api.createTeam,
  updateTeam: api.updateTeam,
  deleteTeam: api.deleteTeam,
  joinTeam: api.joinTeam,
}))

import { useTeamsStore } from './teams'

const workspaces = [
  { id: 'workspace-1', name: 'WhistleIt', initials: 'WI' },
  { id: 'workspace-2', name: 'Design', initials: 'DE' },
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
    })
    api.getWorkspaces.mockResolvedValue(workspaces)
    api.getWorkspaceTeams.mockImplementation(async (workspaceId) => [
      ...(teamsByWorkspace[workspaceId] ?? []),
    ])
    api.createWorkspace.mockImplementation(async (payload) => ({
      id: 'workspace-3',
      initials: payload.initials,
      ...payload,
    }))
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
    api.joinTeam.mockImplementation(async (code) => {
      if (code === 'invalid') throw new Error('This invite code is invalid or has expired.')
      if (code === 'team-1') {
        return {
          team: teamsByWorkspace['workspace-1'][0],
          workspaceId: 'workspace-1',
          alreadyMember: true,
        }
      }
      return {
        team: { id: 'team-5', name: 'Backend Crew', workspaceId: 'workspace-2' },
        workspaceId: 'workspace-2',
        alreadyMember: false,
      }
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('starts with no active team', () => {
    const store = useTeamsStore()
    expect(store.teams).toEqual([])
    expect(store.activeTeamId).toBeNull()
    expect(store.activeTeam).toBeNull()
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
    store.selectTeam('team-2')
    await store.selectWorkspace('workspace-2')
    expect(store.activeTeamId).toBe('team-3')
    expect(store.teams.every((team) => team.workspaceId === 'workspace-2')).toBe(true)

    await store.selectWorkspace('workspace-1')
    expect(store.activeTeamId).toBe('team-2')
    expect(store.teams.every((team) => team.workspaceId === 'workspace-1')).toBe(true)
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

  it('creates a workspace and selects its empty team list', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    const workspace = await store.createWorkspace({ name: 'Research', initials: 'RE' })

    expect(store.activeWorkspace).toEqual(workspace)
    expect(store.activeTeamId).toBeNull()
    expect(store.teamsOfActiveWorkspace).toEqual([])
  })

  it('joins a team into the workspace returned by the mock API', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    const result = await store.joinTeam('invite-code')

    expect(result.team.id).toBe('team-5')
    expect(result.alreadyMember).toBe(false)
    expect(store.activeWorkspaceId).toBe('workspace-2')
    expect(store.activeTeamId).toBe('team-5')
    expect(store.teams.filter((team) => team.id === 'team-5')).toHaveLength(1)
  })

  it('selects an existing team without duplicating it', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    const result = await store.joinTeam('team-1')

    expect(result.alreadyMember).toBe(true)
    expect(store.activeTeamId).toBe('team-1')
    expect(store.teams.filter((team) => team.id === 'team-1')).toHaveLength(1)
  })

  it('rejects invalid invite codes and exposes a workspace error', async () => {
    const store = useTeamsStore()
    await expect(store.joinTeam('invalid')).rejects.toThrow('invalid or has expired')
    expect(store.error).toContain('invalid or has expired')
  })
})
