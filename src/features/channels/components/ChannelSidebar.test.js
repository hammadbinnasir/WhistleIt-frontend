import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'
import { useChannelsStore } from '../store/channels.store'
import ChannelSidebar from './ChannelSidebar.vue'
import ChannelListItem from './ChannelListItem.vue'

describe('ChannelSidebar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('switches from an open direct message to the selected channel', async () => {
    const channels = useChannelsStore()
    channels.channels = [
      {
        id: 'channel-1',
        name: 'Announcements',
        isDefault: true,
        isFavorite: false,
        isMember: true,
      },
    ]
    channels.loaded = true

    const dms = useDmStore()
    dms.activeId = 'conversation-1'
    const ui = useUiStore()

    const wrapper = shallowMount(ChannelSidebar)
    await nextTick()

    wrapper.findComponent(ChannelListItem).vm.$emit('select')
    await nextTick()

    expect(ui.selectedChannelId).toBe('channel-1')
    expect(dms.activeId).toBeNull()
  })

  it('closes the activity panel when a channel is selected', async () => {
    const channels = useChannelsStore()
    channels.channels = [
      {
        id: 'frontend',
        name: 'Frontend',
        isDefault: true,
        isFavorite: false,
        isMember: true,
      },
    ]
    channels.loaded = true
    const dms = useDmStore()
    const ui = useUiStore()
    ui.activePanel = 'activity'

    const wrapper = shallowMount(ChannelSidebar)
    wrapper.findComponent(ChannelListItem).vm.$emit('select')
    await nextTick()

    expect(ui.selectedChannelId).toBe('frontend')
    expect(ui.activePanel).toBeNull()
    expect(dms.activeId).toBeNull()
  })
})
