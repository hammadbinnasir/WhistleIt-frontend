import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { useChannelsStore } from '../store/channels.store'
import { usePresenceStore } from '@/features/dms/stores/presence'
import ChannelHeader from './ChannelHeader.vue'

const getUser = vi.hoisted(() => vi.fn())
vi.mock('@/features/account/api', () => ({ getUser }))

vi.mock('../api', () => ({
  default: {
    listMembers: vi.fn(),
  },
}))

describe('ChannelHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.listMembers.mockReset()
    getUser.mockReset()
    getUser.mockResolvedValue({ success: true, data: { status_mode: 'online' } })
  })

  afterEach(() => {
    vi.useRealTimers()
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

    const firstMemberAvatar = wrapper.find('.ch-stack__avatar')
    expect(firstMemberAvatar.attributes('title')).toBe('channel-one member')
    await firstMemberAvatar.trigger('mouseenter')
    await wrapper.get('button.ch-stack__preview-action--secondary').trigger('click')
    expect(wrapper.emitted('profile')[0][0].id).toBe('channel-one-member')

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

  it('refreshes channel member status modes and updates their avatars live', async () => {
    vi.useFakeTimers()
    api.listMembers.mockResolvedValue({
      items: [
        { id: 'member-1', name: 'Member One', status: 'online' },
        { id: 'member-2', name: 'Member Two', status: 'offline' },
      ],
      total: 2,
    })
    getUser.mockImplementation(async (memberId) => ({
      success: true,
      data: { status_mode: memberId === 'member-1' ? 'away' : 'online' },
    }))
    const channels = useChannelsStore()
    channels.upsertChannel({ id: 'channel-one', name: 'Channel one' })
    const wrapper = mount(ChannelHeader, {
      props: { channelId: 'channel-one' },
    })

    await flushPromises()

    const avatars = wrapper.findAll('.ch-stack__avatar')
    expect(avatars[0].find('.ch-stack__dot').classes()).toContain('ch-stack__dot--away')
    expect(avatars[1].find('.ch-stack__dot').classes()).toContain('ch-stack__dot--online')
    await avatars[0].trigger('mouseenter')
    expect(wrapper.find('.ch-stack__preview-status').text()).toBe('Away')

    getUser.mockResolvedValue({ success: true, data: { status_mode: 'dnd' } })
    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()
    expect(avatars[0].find('.ch-stack__dot').classes()).toContain('ch-stack__dot--dnd')
    await avatars[0].trigger('mouseenter')
    expect(wrapper.find('.ch-stack__preview-status').text()).toBe('Do not disturb')
    expect(usePresenceStore().stateOf('member-1')).toBe('dnd')
    wrapper.unmount()
  })
})
