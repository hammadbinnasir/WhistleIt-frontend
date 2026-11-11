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
})
