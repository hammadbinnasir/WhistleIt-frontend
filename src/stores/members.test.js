import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMembersStore } from './members'

describe('members store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with empty members and zero count', () => {
    const store = useMembersStore()
    expect(store.members).toEqual([])
    expect(store.memberCount).toBe(0)
    expect(store.onlineMembers).toEqual([])
  })

  it('fetches members for a team and calculates online/offline', async () => {
    const store = useMembersStore()
    await store.fetchMembers('team-1')

    expect(store.members.length).toBeGreaterThan(0)
    expect(store.memberCount).toBe(store.members.length)
    expect(store.onlineMembers.every((m) => m.status === 'online')).toBe(true)
    expect(store.offlineMembers.every((m) => m.status !== 'online')).toBe(true)
  })

  it('adds and removes a member', async () => {
    const store = useMembersStore()
    await store.fetchMembers('team-2')
    const initialCount = store.members.length

    // Add member
    const added = await store.addMember('team-2', 'u20')
    expect(store.members.length).toBe(initialCount + 1)
    expect(store.members.some((m) => m.id === added.id)).toBe(true)

    // Remove member
    await store.removeMember('team-2', added.id)
    expect(store.members.length).toBe(initialCount)
    expect(store.members.some((m) => m.id === added.id)).toBe(false)
  })

  it('clears members on team switch', async () => {
    const store = useMembersStore()
    await store.fetchMembers('team-1')
    expect(store.members.length).toBeGreaterThan(0)

    store.clearMembers()
    expect(store.members).toEqual([])
  })
})
