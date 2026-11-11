import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
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
})
