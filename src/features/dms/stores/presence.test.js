import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePresenceStore } from './presence'

describe('presence store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem('whistleit:my-presence')
  })
  afterEach(() => vi.useRealTimers())

  it('loads presence and updates the current user status', async () => {
    const presence = usePresenceStore()

    await presence.init()

    expect(presence.stateOf('u1')).toBe('online')
    expect(presence.customOf('u1')).toEqual({ emoji: '', text: '' })

    presence.setMyState('away')
    presence.setMyStatus('🎧', 'Focused')
    expect(presence.stateOf('u1')).toBe('away')
    expect(presence.labelOf('u1')).toBe('Away')

    presence.clearMyStatus()
    expect(presence.customOf('u1')).toMatchObject({ emoji: '', text: '', expiresAt: null })
  })

  it('hides a status after its selected duration expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const presence = usePresenceStore()

    presence.setMyStatus('🎧', 'Focused', '30m')
    expect(presence.customOf('u1').expiresAt).toBe('2026-10-30T10:30:00.000Z')
    expect(presence.labelOf('u1')).toBe('Online')

    vi.setSystemTime(new Date('2026-10-30T10:30:00.001Z'))
    expect(presence.customOf('u1')).toEqual({ emoji: '', text: '' })
    expect(presence.labelOf('u1')).toBe('Online')
  })

  it('loads persisted state and status over the API presence', async () => {
    const initial = usePresenceStore()
    initial.setMyState('away')
    initial.setMyStatus('🌴', 'On leave')
    setActivePinia(createPinia())

    const presence = usePresenceStore()
    await presence.init()

    expect(presence.stateOf('u1')).toBe('away')
    expect(presence.customOf('u1')).toMatchObject({ emoji: '🌴', text: 'On leave' })
    expect(presence.labelOf('u1')).toBe('Away')
  })
})
