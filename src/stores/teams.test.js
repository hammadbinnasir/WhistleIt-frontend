import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTeamsStore } from './teams'

describe('teams store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with empty teams and no active team', () => {
    const store = useTeamsStore()
    expect(store.teams).toEqual([])
    expect(store.activeTeamId).toBeNull()
    expect(store.activeTeam).toBeNull()
  })

  it('fetches teams and auto-selects the first one', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()

    expect(store.teams.length).toBeGreaterThan(0)
    expect(store.activeTeamId).toBe(store.teams[0].id)
    expect(store.activeTeam).toEqual(store.teams[0])
  })

  it('switches active team', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()

    if (store.teams.length > 1) {
      const secondTeam = store.teams[1]
      store.switchTeam(secondTeam.id)
      expect(store.activeTeamId).toBe(secondTeam.id)
      expect(store.activeTeam.name).toBe(secondTeam.name)
    }
  })

  it('filters teams by search query', async () => {
    const store = useTeamsStore()
    await store.fetchTeams()

    store.searchQuery = 'Programmers'
    expect(store.filteredTeams.every((t) => t.name.toLowerCase().includes('programmers'))).toBe(
      true,
    )

    store.searchQuery = 'NonExistentXYZ'
    expect(store.filteredTeams).toEqual([])
  })

  it('creates a new team', async () => {
    const store = useTeamsStore()
    const newTeam = await store.createTeam({ name: 'Alpha Squad', color: '#10B981' })

    expect(newTeam.name).toBe('Alpha Squad')
    expect(store.teams.some((t) => t.id === newTeam.id)).toBe(true)
    expect(store.activeTeamId).toBe(newTeam.id)
  })

  it('switches workspaces and restores each workspace remembered team', async () => {
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

  it('creates a workspace and selects its empty team list', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    const workspace = await store.createWorkspace({ name: 'Research', initials: 'RE' })

    expect(store.activeWorkspace).toEqual(workspace)
    expect(store.activeTeamId).toBeNull()
    expect(store.teamsOfActiveWorkspace).toEqual([])
  })

  it('joins a team from an invite code in the workspace returned by the API', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    const result = await store.joinTeam('team-5')

    expect(result.team.id).toBe('team-5')
    expect(result.alreadyMember).toBe(false)
    expect(store.activeWorkspaceId).toBe('workspace-2')
    expect(store.activeTeamId).toBe('team-5')
    expect(store.teams.filter((team) => team.id === 'team-5')).toHaveLength(1)
  })

  it('rejects invalid invite codes', async () => {
    const store = useTeamsStore()

    await expect(store.joinTeam('invalid')).rejects.toThrow('invalid or has expired')
    expect(store.error).toBeNull()
  })

  it('selects an existing team without duplicating it', async () => {
    const store = useTeamsStore()
    await store.fetchWorkspaces()

    const result = await store.joinTeam('team-1')

    expect(result.alreadyMember).toBe(true)
    expect(store.activeTeamId).toBe('team-1')
    expect(store.teams.filter((team) => team.id === 'team-1')).toHaveLength(1)
  })
})
