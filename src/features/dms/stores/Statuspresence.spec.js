import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'),
    presence: vi.fn(async () => ({})),
    updateUserStatus: vi.fn(async () => null),
    getUserStatus: vi.fn(async () => null),
  },
}))

import { dmApi } from '@/features/dms/dmApi'
import { usePresenceStore } from '@/features/dms/stores/presence'
import DmPresenceLabel from './DmPresenceLabel.vue'
import StatusMenu from './StatusMenu.vue'

describe('DmPresenceLabel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows Active / Away / Offline live', async () => {
    const presence = usePresenceStore()
    const wrapper = mount(DmPresenceLabel, { props: { userId: 'u2' } })
    expect(wrapper.text()).toBe('Offline')

    presence.presenceById = { u2: { state: 'online' } }
    await flushPromises()
    expect(wrapper.text()).toBe('Online')

    presence.presenceById = { u2: { state: 'away', status: { emoji: '🍔', text: 'Lunch' } } }
    await flushPromises()
    expect(wrapper.text().replace(/\s+/g, ' ')).toBe('Away · 🍔 Lunch')
  })
})

describe('StatusMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('saves Away with PUT and shows an error when it fails', async () => {
    dmApi.updateUserStatus.mockRejectedValueOnce(new Error('Failed to fetch'))
    const wrapper = mount(StatusMenu)
    await wrapper.get('button').trigger('click')

    await wrapper.findAll('button').find((b) => b.text() === 'Away').trigger('click')
    expect(dmApi.updateUserStatus).toHaveBeenCalledWith('u1', { mode: 'away' }, { keepalive: false })
    await flushPromises()
    expect(wrapper.text()).toContain('Status save nahi hua: Failed to fetch')
  })
})