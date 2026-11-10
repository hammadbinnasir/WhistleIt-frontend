import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useChannelsStore } from '../store/channels.store'
import ChannelView from './ChannelView.vue'

const mockRoute = { params: {} }

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ replace: vi.fn() }),
}))

describe('ChannelView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRoute.params = { channelId: 'private' }
  })

  it('shows an access message when a channel is unavailable to the current user', async () => {
    const store = useChannelsStore()
    store.channels = []
    store.loaded = true
    store.loading = false
    store.error = null

    const wrapper = shallowMount(ChannelView)

    expect(wrapper.text()).toContain('You do not have access to this channel.')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
