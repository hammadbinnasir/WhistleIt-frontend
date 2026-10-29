import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  getMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}))

vi.mock('@/features/shell/api/membersApi', () => ({
  getMembers: api.getMembers,
  addMember: api.addMember,
  removeMember: api.removeMember,
}))

import { useMembersStore } from './members'

describe('members store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.getMembers.mockResolvedValue([
      { id: 'm1', name: 'Member One', status: 'online', role: 'admin' },
      { id: 'm2', name: 'Member Two', status: 'offline', role: 'member' },
    ])
    api.addMember.mockImplementation(async (teamId, userId) => ({
      id: `${teamId}-${userId}`,
      name: 'Added Member',
      status: 'offline',
      role: 'member',
    }))
    api.removeMember.mockResolvedValue({ success: true })
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
