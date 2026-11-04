import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { useChannelsStore } from '../store/channels.store'
import ChannelHeader from './ChannelHeader.vue'

vi.mock('../api', () => ({
  default: {
    listMembers: vi.fn(),
  },
}))

describe('ChannelHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.listMembers.mockReset()
  })

  it('shows only members belonging to the current channel', async () => {
    api.listMembers.mockImplementation(async (channelId) => ({
      items: [
        {
          id: `${channelId}-member`,
          name: `${channelId} member`,
          email: `${channelId}@example.com`,
          avatarUrl: '',
          status: 'offline',
        },
      ],
      total: 1,
    }))

    const channels = useChannelsStore()
    channels.upsertChannel({ id: 'channel-one', name: 'Channel one', memberCount: 1 })
    channels.upsertChannel({ id: 'channel-two', name: 'Channel two', memberCount: 1 })
    const wrapper = mount(ChannelHeader, {
      props: { channelId: 'channel-one' },
    })
    await flushPromises()

    expect(wrapper.find('.ch-stack__avatar').attributes('title')).toBe('channel-one member')

    await wrapper.setProps({ channelId: 'channel-two' })
    await flushPromises()

    expect(wrapper.find('.ch-stack__avatar').attributes('title')).toBe('channel-two member')
    expect(api.listMembers).toHaveBeenNthCalledWith(1, 'channel-one', { limit: 10 })
    expect(api.listMembers).toHaveBeenNthCalledWith(2, 'channel-two', { limit: 10 })
    wrapper.unmount()
  })

  it('toggles the channel favorite state from the header star', async () => {
    const channels = useChannelsStore()
    channels.upsertChannel({
      id: 'channel-one',
      name: 'Channel one',
      isFavorite: false,
    })
    const wrapper = mount(ChannelHeader, {
      props: { channelId: 'channel-one' },
    })
    const favoriteButton = wrapper.get('button[aria-label="Add channel to favorites"]')

    expect(favoriteButton.attributes('aria-pressed')).toBe('false')
    await favoriteButton.trigger('click')
    expect(
      wrapper.get('button[aria-label="Remove channel from favorites"]').attributes('aria-pressed'),
    ).toBe('true')
    expect(channels.getById('channel-one').isFavorite).toBe(true)

    await wrapper.get('button[aria-label="Remove channel from favorites"]').trigger('click')
    expect(
      wrapper.get('button[aria-label="Add channel to favorites"]').attributes('aria-pressed'),
    ).toBe('false')
    expect(channels.getById('channel-one').isFavorite).toBe(false)
    wrapper.unmount()
  })
})
