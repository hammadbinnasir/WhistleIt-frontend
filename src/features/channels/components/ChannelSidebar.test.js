import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { useDmStore } from '@/features/dms/stores/dms'
import { useUiStore } from '@/stores/ui'
import { useChannelsStore } from '../store/channels.store'
import ChannelSidebar from './ChannelSidebar.vue'

describe('ChannelSidebar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps the channel unselected while a direct message is open', async () => {
    const channels = useChannelsStore()
    channels.channels = [
      { id: 'channel-1', name: 'Announcements', isDefault: true, isFavorite: false },
    ]
    channels.loaded = true

    const dms = useDmStore()
    await dms.init()
    const conversation = dms.startDm('u2')
    const ui = useUiStore()

    shallowMount(ChannelSidebar)
    await nextTick()

    expect(ui.selectedChannelId).toBeNull()

    dms.closeConversation(conversation.id)
    await nextTick()

    expect(ui.selectedChannelId).toBe('channel-1')
  })
})
