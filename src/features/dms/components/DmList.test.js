import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { useUserStore } from '@/features/account/composables/useUserStore'
import { useUiStore } from '@/stores/ui'
import { setupDmsTestState } from '@/features/dms/test-utils'
import DmList from './DmList.vue'
import DmListItem from './DmListItem.vue'

describe('DmList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setupDmsTestState()
  })

  it('closes the activity panel and clears channel selection when a DM is selected', async () => {
    const dms = useDmStore()
    dms.conversations = [
      {
        id: 'c1',
        type: 'dm',
        members: [dms.meId, 'u2'],
        messages: [],
        unreadCount: 0,
      },
    ]
    vi.spyOn(dms, 'init').mockResolvedValue()
    vi.spyOn(dms, 'loadCustomStatuses').mockResolvedValue()
    const ui = useUiStore()
    ui.selectChannel('general')
    ui.activePanel = 'activity'

    const wrapper = shallowMount(DmList)
    wrapper.findComponent(DmListItem).vm.$emit('select', 'c1')

    expect(dms.activeId).toBe('c1')
    expect(ui.selectedChannelId).toBeNull()
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('shows the request error alongside saved messages when the API is unreachable', async () => {
    const dms = useDmStore()
    dms.error = 'Failed to fetch'
    dms.offline = true
    vi.spyOn(dms, 'init').mockResolvedValue()
    vi.spyOn(dms, 'loadCustomStatuses').mockResolvedValue()
    vi.spyOn(usePresenceStore(), 'init').mockResolvedValue()

    const wrapper = shallowMount(DmList)

    expect(wrapper.text()).toContain('Offline: showing saved messages.')
    expect(wrapper.text()).toContain('Failed to fetch')
    wrapper.unmount()
  })

  it('refreshes other users custom statuses periodically', async () => {
    vi.useFakeTimers()
    const dms = useDmStore()
    dms.conversations = [
      {
        id: 'c1',
        type: 'dm',
        members: [dms.meId, 'u2'],
        messages: [],
        unreadCount: 0,
      },
    ]
    dms.usersById.u2 = {
      customStatus: { emoji: '📅', text: 'In a meeting' },
      customStatusLoaded: true,
    }
    const loadStatuses = vi.spyOn(dms, 'loadCustomStatuses').mockResolvedValue()
    vi.spyOn(dms, 'init').mockResolvedValue()
    vi.spyOn(dms, 'loadCompanyMembers').mockResolvedValue()
    vi.spyOn(dms, 'startPolling').mockImplementation(() => {})
    const presence = usePresenceStore()
    vi.spyOn(presence, 'init').mockResolvedValue()
    vi.spyOn(presence, 'goOffline').mockImplementation(() => {})
    vi.spyOn(presence, 'stopPolling').mockImplementation(() => {})
    vi.spyOn(dms, 'stopPolling').mockImplementation(() => {})

    const wrapper = shallowMount(DmList)
    await wrapper.vm.$nextTick()
    loadStatuses.mockClear()

    await vi.advanceTimersByTimeAsync(15_000)

    expect(loadStatuses).toHaveBeenCalledWith(['u2'], { force: true })
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('adds the current user to the top of DMs when they set a custom status', async () => {
    const dms = useDmStore()
    vi.spyOn(dms, 'init').mockResolvedValue()
    vi.spyOn(dms, 'loadCustomStatuses').mockResolvedValue()
    const wrapper = shallowMount(DmList)

    expect(
      wrapper.findAllComponents(DmListItem).some((item) => item.props('statusOnly')),
    ).toBe(false)

    useUserStore().hydrate({
      profile: { fullName: 'Muhammad Abdullah Tariq' },
      customStatus: { emoji: '🚌', text: 'Commuting' },
      customStatusExpiresAt: Date.now() + 60_000,
    })
    await wrapper.vm.$nextTick()

    const myStatusItem = wrapper
      .findAllComponents(DmListItem)
      .find((item) => item.props('statusOnly'))
    expect(myStatusItem).toBeTruthy()
    expect(myStatusItem.props('conversation')).toMatchObject({
      name: 'Muhammad Abdullah Tariq',
      members: [dms.meId],
      customStatus: {
        emoji: '🚌',
        text: 'Commuting',
      },
    })

    useUserStore().hydrate({
      customStatus: {
        emoji: useUserStore().state.customStatusEmoji,
        text: useUserStore().state.customStatus,
        expiresAt: useUserStore().state.customStatusExpiresAt,
      },
    })
    await wrapper.vm.$nextTick()
    expect(useUserStore().state.customStatusEmoji).toBe('🚌')
    expect(
      wrapper.findAllComponents(DmListItem).find((item) => item.props('statusOnly'))
        .props('conversation').customStatus.emoji,
    ).toBe('🚌')
    wrapper.unmount()
  })
})
