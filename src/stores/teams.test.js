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
})
