import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePresenceStore } from './presence'

describe('presence store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads presence and updates the current user status', async () => {
    const presence = usePresenceStore()

    await presence.init()

    expect(presence.stateOf('u1')).toBe('online')
    expect(presence.customOf('u1')).toEqual({ emoji: '', text: '' })

    presence.setMyState('away')
    presence.setMyStatus('🎧', 'Focused')
    expect(presence.stateOf('u1')).toBe('away')
    expect(presence.labelOf('u1')).toContain('Focused')

    presence.clearMyStatus()
    expect(presence.customOf('u1')).toEqual({ emoji: '', text: '' })
  })
})
