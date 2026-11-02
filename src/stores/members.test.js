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
    api.addMember.mockResolvedValue({ success: true })
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
    await store.fetchMembers('workspace-1', 'team-1')

    expect(store.members.length).toBeGreaterThan(0)
    expect(store.memberCount).toBe(store.members.length)
    expect(store.onlineMembers.every((m) => m.status === 'online')).toBe(true)
    expect(store.offlineMembers.every((m) => m.status !== 'online')).toBe(true)
  })

  it('adds and removes a member', async () => {
    const store = useMembersStore()
    await store.fetchMembers('workspace-1', 'team-2')
    const initialCount = store.members.length

    await store.addMember('workspace-1', 'team-2', ['u20'])
    expect(api.addMember).toHaveBeenCalledWith('workspace-1', 'team-2', ['u20'])
    expect(store.members.length).toBe(initialCount)

    await store.removeMember('workspace-1', 'team-2', 'u20')
    expect(api.removeMember).toHaveBeenCalledWith('workspace-1', 'team-2', 'u20')
    expect(api.getMembers).toHaveBeenCalledTimes(3)
  })

  it('clears members on team switch', async () => {
    const store = useMembersStore()
    await store.fetchMembers('workspace-1', 'team-1')
    expect(store.members.length).toBeGreaterThan(0)

    store.clearMembers()
    expect(store.members).toEqual([])
  })

  it('maps a forbidden write to a read-only permission state', async () => {
    const store = useMembersStore()
    api.removeMember.mockRejectedValue({ status: 403, message: 'forbidden' })

    await expect(store.removeMember('workspace-1', 'team-1', 'user-2')).rejects.toMatchObject({
      status: 403,
    })
    expect(store.permissionDenied).toBe(true)
    expect(store.error).toContain('do not have permission')
  })

  it('maps missing teams and invalid write payloads to actionable messages', async () => {
    const store = useMembersStore()
    api.removeMember.mockRejectedValueOnce({ status: 404, message: 'Not found' })
    await expect(store.removeMember('workspace-1', 'team-1', 'user-2')).rejects.toMatchObject({
      status: 404,
    })
    expect(store.error).toContain('could not be found')

    api.addMember.mockRejectedValueOnce({ status: 422, message: 'Select a valid user.' })
    await expect(store.addMember('workspace-1', 'team-1', ['invalid'])).rejects.toMatchObject({
      status: 422,
    })
    expect(store.error).toBe('Select a valid user.')
  })
})
