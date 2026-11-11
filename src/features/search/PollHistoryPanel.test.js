import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChannelsStore } from '@/features/channels'
import PollHistoryPanel from './PollHistoryPanel.vue'

const messageStore = vi.hoisted(() => ({
  messagesFor: vi.fn(),
  fetchChannelMessages: vi.fn(),
  currentPageByChannel: {},
  hasMorePagesByChannel: {},
}))
vi.mock('@/features/messages/messages', () => ({
  useMessagesStore: () => messageStore,
}))

describe('poll history panel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    messageStore.messagesFor.mockReset().mockReturnValue([])
    messageStore.fetchChannelMessages.mockReset().mockResolvedValue({ success: true })
    messageStore.currentPageByChannel = {}
    messageStore.hasMorePagesByChannel = {}
  })

  it('loads all pages and displays polls from the selected channel message history', async () => {
    const channelId = 'channel-1'
    useChannelsStore().upsertChannel({ id: channelId, name: 'Research' })
    const channelPoll = {
      id: 'message-2',
      poll_id: 'poll-2',
      content: 'My channel poll',
      createdAt: '2026-11-11T10:00:00.000Z',
    }
    messageStore.messagesFor.mockReturnValue([
      {
        id: 'message-1',
        poll_id: 'poll-1',
        content: 'Earlier poll',
        createdAt: '2026-11-10T10:00:00.000Z',
      },
      channelPoll,
      {
        id: 'regular-message',
        content: 'Not a poll',
        createdAt: '2026-11-11T11:00:00.000Z',
      },
      {
        id: 'deleted-poll',
        poll_id: 'poll-deleted',
        content: 'Deleted poll',
        deleted: true,
      },
    ])
    let page = 0
    messageStore.fetchChannelMessages.mockImplementation(async (_id, options = {}) => {
      page = options.page || 1
      messageStore.currentPageByChannel[channelId] = page
      messageStore.hasMorePagesByChannel[channelId] = page < 3
      return { success: true }
    })

    const wrapper = mount(PollHistoryPanel, { props: { channelId } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('My channel poll'))
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(false))

    expect(wrapper.text()).toContain('Polls in Research')
    expect(wrapper.text()).toContain('Earlier poll')
    expect(wrapper.text()).not.toContain('Not a poll')
    expect(wrapper.text()).not.toContain('Deleted poll')
    expect(messageStore.fetchChannelMessages).toHaveBeenNthCalledWith(1, channelId)
    expect(messageStore.fetchChannelMessages).toHaveBeenNthCalledWith(2, channelId, {
      page: 2,
      olderPage: true,
    })
    expect(messageStore.fetchChannelMessages).toHaveBeenNthCalledWith(3, channelId, {
      page: 3,
      olderPage: true,
    })

    wrapper.unmount()
  })

  it('reports an error when channel history cannot be loaded', async () => {
    messageStore.fetchChannelMessages.mockResolvedValue({
      success: false,
      error: 'Channel access denied.',
    })

    const wrapper = mount(PollHistoryPanel, { props: { channelId: 'private-channel' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Channel access denied.'))

    expect(wrapper.get('[role="alert"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps discovered channel polls visible after remount when server history is empty', async () => {
    const channelId = 'persistent-channel'
    useChannelsStore().upsertChannel({ id: channelId, name: 'Persistent Channel' })
    messageStore.messagesFor.mockReturnValue([
      {
        id: 'persistent-poll-message',
        poll_id: 'persistent-poll',
        content: 'Poll: Keep this poll',
        createdAt: '2026-11-11T10:00:00.000Z',
      },
    ])

    const firstPanel = mount(PollHistoryPanel, { props: { channelId } })
    await vi.waitFor(() =>
      expect(localStorage.getItem('whistleit:channel-poll-history')).toContain('persistent-poll'),
    )
    firstPanel.unmount()

    messageStore.messagesFor.mockReturnValue([])
    const refreshedPanel = mount(PollHistoryPanel, { props: { channelId } })
    await vi.waitFor(() => expect(refreshedPanel.text()).toContain('Keep this poll'))

    expect(refreshedPanel.text()).not.toContain('No polls created')
    refreshedPanel.unmount()
  })
})
