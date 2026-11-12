import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChannelSettingsModal from './ChannelSettingsModal.vue'

const membersApi = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listAvailableMembers: vi.fn(),
  addMember: vi.fn(),
  getWebhookUrl: vi.fn(),
}))
vi.mock('./members', () => membersApi)

describe('channel settings message permissions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    membersApi.listMembers.mockReset().mockResolvedValue([])
    membersApi.listAvailableMembers.mockReset().mockResolvedValue([])
    membersApi.addMember.mockReset().mockResolvedValue(undefined)
    membersApi.getWebhookUrl.mockReset().mockResolvedValue('')
  })

  it('only shows message permissions to the channel creator', async () => {
    const wrapper = mount(ChannelSettingsModal, {
      props: {
        channel: {
          id: 'channel-1',
          name: 'General',
          canManage: true,
          isCreator: false,
          createdById: 'creator-1',
          muted: false,
          favourite: false,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Message Permissions')
    expect(wrapper.text()).toContain('History')
    expect(wrapper.get('[aria-label="Mute channel"]').exists()).toBe(true)
    expect(wrapper.get('[aria-label="Favourite channel"]').exists()).toBe(true)
    wrapper.unmount()

    const creatorWrapper = mount(ChannelSettingsModal, {
      props: {
        channel: {
          id: 'channel-1',
          name: 'General',
          canManage: true,
          isCreator: true,
          createdById: 'creator-1',
          muted: false,
          favourite: false,
        },
      },
    })
    await flushPromises()

    expect(creatorWrapper.text()).toContain('Message Permissions')
    creatorWrapper.unmount()
  })

  it('shows name and description edit controls only to the creator and resolves the creator name', async () => {
    membersApi.listMembers.mockResolvedValue([
      { id: 'creator-1', name: 'Channel Creator' },
      { id: 'member-1', name: 'Channel Member' },
    ])
    const channel = {
      id: 'channel-1',
      name: 'General',
      description: '',
      createdBy: 'creator-1',
      createdById: 'creator-1',
      canManage: true,
      muted: false,
      favourite: false,
    }

    const memberWrapper = mount(ChannelSettingsModal, {
      props: { channel: { ...channel, isCreator: false } },
    })
    await flushPromises()
    await memberWrapper
      .find('nav')
      .findAll('button')
      .find((button) => button.text() === 'about')
      .trigger('click')

    expect(memberWrapper.findAll('button').filter((button) => button.text() === 'Edit')).toHaveLength(0)
    expect(memberWrapper.text()).toContain('Channel Creator')
    expect(memberWrapper.text()).not.toContain('creator-1')
    memberWrapper.unmount()

    const creatorWrapper = mount(ChannelSettingsModal, {
      props: { channel: { ...channel, isCreator: true } },
    })
    await flushPromises()
    await creatorWrapper
      .find('nav')
      .findAll('button')
      .find((button) => button.text() === 'about')
      .trigger('click')

    expect(creatorWrapper.findAll('button').filter((button) => button.text() === 'Edit')).toHaveLength(2)
    creatorWrapper.unmount()
  })
})
