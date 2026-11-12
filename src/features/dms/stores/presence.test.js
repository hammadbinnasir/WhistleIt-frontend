import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Store ab asli API chalata hai (PUT /v1/users/{user}/status), isliye test mein mock
vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'),
    presence: vi.fn(async () => ({})),
    updateUserStatus: vi.fn(async () => null),
    getUserStatus: vi.fn(async () => null),
  },
}))

import { dmApi } from '@/features/dms/dmApi'
import { usePresenceStore } from './presence'
import { setupDmsTestState } from '@/features/dms/test-utils'
import { useMembersStore } from '@/stores/members'

describe('presence store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setupDmsTestState()
    const members = useMembersStore()
    members.fetchMembers = vi.fn(async () => members.members)
  })

  it('loads presence and updates the current user status', async () => {
    const presence = usePresenceStore()

    await presence.init()

    expect(presence.stateOf('u1')).toBe('online')
    expect(presence.customOf('u1')).toEqual({ emoji: '', text: '' })

    presence.setMyState('away')
    presence.setMyStatus('🎧', 'Focused')
    expect(presence.stateOf('u1')).toBe('away')
    expect(presence.labelOf('u1')).toContain('Focused')
    // server ko bhi gaya
    expect(dmApi.updateUserStatus).toHaveBeenLastCalledWith(
      'u1',
      { mode: 'away', custom_status: { emoji: '🎧', text: 'Focused' } },
      { keepalive: false },
    )

    presence.clearMyStatus()
    expect(presence.customOf('u1')).toEqual({ emoji: '', text: '' })
    presence.stopPolling()
  })
})