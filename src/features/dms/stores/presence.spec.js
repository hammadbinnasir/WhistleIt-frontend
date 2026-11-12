import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'),
    presence: vi.fn(),
    updateUserStatus: vi.fn(),
    getUserStatus: vi.fn(),
  },
}))

import { dmApi } from '@/features/dms/dmApi'
import { useTeamsStore } from '@/stores/teams'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMembersStore } from '@/stores/members'
import { usePresenceStore } from './presence'

describe('presence store (live)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.presence.mockResolvedValue({ u2: { state: 'online' }, u3: { state: 'offline' } })
    dmApi.updateUserStatus.mockResolvedValue(null)
    dmApi.getUserStatus.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
  })

  it('loads who is online for the active company', async () => {
    const presence = usePresenceStore()
    await presence.init()

    expect(dmApi.presence).toHaveBeenCalledWith('company-1')
    expect(presence.stateOf('u2')).toBe('online')
    expect(presence.stateOf('u3')).toBe('offline')
    expect(presence.stateOf('unknown')).toBe('offline')
    expect(presence.stateOf('u1')).toBe('online') // main khud
    presence.stopPolling()
  })

  it('updates online/offline live by polling', async () => {
    vi.useFakeTimers()
    try {
      const presence = usePresenceStore()
      await presence.init()
      expect(presence.stateOf('u2')).toBe('online')

      dmApi.presence.mockResolvedValue({ u2: { state: 'offline' } })
      await vi.advanceTimersByTimeAsync(15_000)
      expect(presence.stateOf('u2')).toBe('offline')

      presence.stopPolling()
      dmApi.presence.mockClear()
      await vi.advanceTimersByTimeAsync(30_000)
      expect(dmApi.presence).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps my own chosen state and does not show a polling error', async () => {
    const presence = usePresenceStore()
    await presence.init()
    presence.setMyState('away')

    dmApi.presence.mockRejectedValue(new Error('Failed to fetch'))
    await presence.load({ silent: true })
    expect(presence.error).toBe('')

    dmApi.presence.mockResolvedValue({ u1: { state: 'online' } })
    await presence.load({ silent: true })
    expect(presence.stateOf('u1')).toBe('away')
    presence.stopPolling()
  })

  it('updates the shared mode locally without sending a duplicate status request', () => {
    const presence = usePresenceStore()

    presence.setMyState('away', { persist: false })
    expect(presence.stateOf('u1')).toBe('away')
    expect(dmApi.updateUserStatus).not.toHaveBeenCalled()

    presence.setMyState('dnd', { persist: false })
    expect(presence.stateOf('u1')).toBe('dnd')
    expect(presence.labelOf('u1')).toBe('Do not disturb')
    expect(dmApi.updateUserStatus).not.toHaveBeenCalled()
  })

  // ---------------- PUT /v1/users/{user}/status ----------------

  it('tells the server I am online when the app starts', async () => {
    const presence = usePresenceStore()
    await presence.init()

    expect(dmApi.updateUserStatus).toHaveBeenCalledWith('u1', { mode: 'online' }, { keepalive: false })
    presence.stopPolling()
  })

  it('sends my chosen state and custom status with PUT', async () => {
    const presence = usePresenceStore()
    await presence.init()
    dmApi.updateUserStatus.mockClear()

    presence.setMyState('away')
    expect(presence.stateOf('u1')).toBe('away')
    expect(dmApi.updateUserStatus).toHaveBeenLastCalledWith('u1', { mode: 'away' }, { keepalive: false })

    presence.setMyStatus('🎧', 'Focused')
    expect(presence.labelOf('u1')).toBe('Away · 🎧 Focused')
    expect(dmApi.updateUserStatus).toHaveBeenLastCalledWith(
      'u1',
      { mode: 'away', custom_status: { emoji: '🎧', text: 'Focused' } },
      { keepalive: false },
    )
    presence.stopPolling()
  })

  it('keeps my state on screen when the PUT fails and shows the error', async () => {
    dmApi.updateUserStatus.mockRejectedValue(new Error('Failed to fetch'))
    const presence = usePresenceStore()
    await presence.init()

    presence.setMyState('away')
    await vi.waitFor(() => expect(presence.statusError).toBe('Failed to fetch'))
    expect(presence.stateOf('u1')).toBe('away')
    presence.stopPolling()
  })

  it('goes away by itself when idle and comes back online on activity', async () => {
    vi.useFakeTimers()
    try {
      const presence = usePresenceStore()
      await presence.init()

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 30_000)
      expect(presence.stateOf('u1')).toBe('away')
      expect(dmApi.updateUserStatus).toHaveBeenLastCalledWith('u1', { mode: 'away' }, { keepalive: false })

      window.dispatchEvent(new Event('mousemove'))
      expect(presence.stateOf('u1')).toBe('online')
      expect(dmApi.updateUserStatus).toHaveBeenLastCalledWith('u1', { mode: 'online' }, { keepalive: false })
      presence.stopPolling()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not switch a manual "Away" back to online on activity', async () => {
    const presence = usePresenceStore()
    await presence.init()
    presence.setMyState('away')

    window.dispatchEvent(new Event('mousemove'))

    expect(presence.stateOf('u1')).toBe('away')
    presence.stopPolling()
  })

  it('sends a heartbeat every minute and "offline" when the page closes', async () => {
    vi.useFakeTimers()
    try {
      const presence = usePresenceStore()
      await presence.init()
      dmApi.updateUserStatus.mockClear()

      await vi.advanceTimersByTimeAsync(60_000)
      expect(dmApi.updateUserStatus).toHaveBeenCalledWith('u1', { mode: 'online' }, { keepalive: false })

      window.dispatchEvent(new Event('pagehide'))
      expect(dmApi.updateUserStatus).toHaveBeenLastCalledWith('u1', { mode: 'offline' }, { keepalive: true })
      presence.stopPolling()
    } finally {
      vi.useRealTimers()
    }
  })

  // ---------------- GET /v1/users/{user}/status ----------------

  it('reads DM partners status with GET and updates it live', async () => {
    dmApi.presence.mockResolvedValue({})
    dmApi.getUserStatus.mockResolvedValue({ state: 'online', status: { emoji: '', text: '' } })
    useDmStore().conversations = [{ id: 'c1', type: 'dm', members: ['u1', 'u2'], messages: [] }]
    const presence = usePresenceStore()
    await presence.init()

    expect(dmApi.getUserStatus).toHaveBeenCalledWith('u2')
    expect(presence.stateOf('u2')).toBe('online')

    dmApi.getUserStatus.mockResolvedValue({ state: 'offline', status: { emoji: '', text: '' } })
    await presence.load({ silent: true })
    expect(presence.stateOf('u2')).toBe('offline')
    presence.stopPolling()
  })

  it('stops calling GET status when the backend does not have it (404)', async () => {
    useDmStore().conversations = [{ id: 'c1', type: 'dm', members: ['u1', 'u2'], messages: [] }]
    const presence = usePresenceStore()
    await presence.init()
    expect(dmApi.getUserStatus).toHaveBeenCalledTimes(1)

    await presence.load({ silent: true })
    expect(dmApi.getUserStatus).toHaveBeenCalledTimes(1)
    expect(presence.stateOf('u2')).toBe('online') // members list wala status
    presence.stopPolling()
  })

  it('keeps showing online/offline (no error) when the members list request fails', async () => {
    dmApi.presence.mockRejectedValue(new Error('Forbidden'))
    dmApi.getUserStatus.mockResolvedValue({ state: 'online', status: { emoji: '', text: '' } })
    useDmStore().conversations = [{ id: 'c1', type: 'dm', members: ['u1', 'u2'], messages: [] }]
    const presence = usePresenceStore()

    await presence.init()

    // HomeView header: v-if="... && !presence.loading && !presence.error"
    expect(presence.loading).toBe(false)
    expect(presence.error).toBe('')
    expect(presence.membersError).toBe('Forbidden')
    expect(presence.stateOf('u2')).toBe('online')
    presence.stopPolling()
  })

  it('shows team members online/offline from the members store (and refreshes it)', async () => {
    dmApi.presence.mockResolvedValue({})
    const members = useMembersStore()
    members.members = [
      { id: 'm-2', user: { id: 'u2' }, status: 'online' },
      { id: 'u3', name: 'Afia', status: 'offline' },
      { id: 'u4', name: 'Taha', is_online: true },
    ]
    members.fetchMembers = vi.fn(async () => members.members)
    useTeamsStore().activeTeamId = 'team-1'
    const presence = usePresenceStore()

    await presence.init()

    expect(members.fetchMembers).toHaveBeenCalledWith('team-1')
    expect(presence.stateOf('u2')).toBe('online')
    expect(presence.stateOf('u3')).toBe('offline')
    expect(presence.stateOf('u4')).toBe('online')

    // live: agle poll par badla hua status
    members.members = [{ id: 'm-2', user: { id: 'u2' }, status: 'offline' }]
    await presence.load({ silent: true })
    expect(presence.stateOf('u2')).toBe('offline')
    presence.stopPolling()
  })

  it('sends my status again as soon as the internet comes back', async () => {
    const presence = usePresenceStore()
    await presence.init()
    dmApi.updateUserStatus.mockClear()

    window.dispatchEvent(new Event('online'))

    expect(dmApi.updateUserStatus).toHaveBeenCalledWith('u1', { mode: 'online' }, { keepalive: false })
    presence.stopPolling()
  })

  it('shows DM partners online/offline from status_mode in the DM list data', async () => {
    dmApi.presence.mockResolvedValue({})
    const dms = useDmStore()
    dms.usersById = { u2: { name: 'Muniba', presence: 'online' }, u3: { name: 'Ahmad', presence: 'offline' } }
    const presence = usePresenceStore()

    await presence.init()

    expect(presence.stateOf('u2')).toBe('online')
    expect(presence.stateOf('u3')).toBe('offline')

    dms.usersById = { ...dms.usersById, u2: { name: 'Muniba', presence: 'offline' } }
    await presence.load({ silent: true })
    expect(presence.stateOf('u2')).toBe('offline')
    presence.stopPolling()
  })

  it('shows a user offline when their "online" is stale (tab closed, heartbeat stopped)', async () => {
    let t = 0
    dmApi.updateUserStatus.mockImplementation(async (_id, payload) => ({
      state: payload.mode,
      changedAt: new Date(Date.UTC(2026, 10, 6, 10, 0, t++)).toISOString(), // har PUT par naya waqt
    }))
    dmApi.presence.mockResolvedValue({})
    const dms = useDmStore()
    const fresh = new Date(Date.now() - 30_000).toISOString()
    const stale = new Date(Date.now() - 10 * 60_000).toISOString()
    dms.usersById = {
      u2: { name: 'Muniba', presence: 'online', statusChangedAt: stale },
      u3: { name: 'Ahmad', presence: 'online', statusChangedAt: fresh },
    }
    const presence = usePresenceStore()
    await presence.init()
    expect(presence.stateOf('u2')).toBe('online') // abhi pata nahi ke backend heartbeat par waqt badalta hai

    presence.setMyState('online') // doosra PUT: waqt badla -> heartbeat ka waqt hai
    await vi.waitFor(() => expect(dmApi.updateUserStatus).toHaveBeenCalledTimes(2))
    await Promise.resolve()

    expect(presence.stateOf('u2')).toBe('offline') // 10 min purana "online"
    expect(presence.stateOf('u3')).toBe('online')
    presence.stopPolling()
  })
})