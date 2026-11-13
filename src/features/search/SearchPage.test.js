import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SearchPage from './SearchPage.vue'

const mocks = vi.hoisted(() => ({
  channels: {
    channels: [],
    getById: vi.fn(),
  },
  dms: {
    conversations: [],
    usersById: {},
    titleOf: vi.fn(),
  },
  messages: {
    fetchChannelMessages: vi.fn(),
    messagesFor: vi.fn(),
    currentPageByChannel: {},
    hasMorePagesByChannel: {},
    recordsByChannel: {},
  },
  members: { members: [], fetchMembers: vi.fn() },
  teams: {
    workspaces: [{ id: 'company-1' }],
    teams: [{ id: 'team-1' }],
    activeWorkspaceId: 'company-1',
    activeTeamId: 'team-1',
    fetchWorkspaces: vi.fn(),
    fetchTeams: vi.fn(),
  },
  searchMessages: vi.fn(),
  searchFiles: vi.fn(),
  searchLinks: vi.fn(),
  searchUsers: vi.fn(),
}))

vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ closePanel: vi.fn() }) }))
vi.mock('@/features/channels', () => ({ useChannelsStore: () => mocks.channels }))
vi.mock('@/features/dms/stores/dms', () => ({ useDmStore: () => mocks.dms }))
vi.mock('@/features/messages/messages', () => ({ useMessagesStore: () => mocks.messages }))
vi.mock('@/stores/members', () => ({ useMembersStore: () => mocks.members }))
vi.mock('@/stores/teams', () => ({ useTeamsStore: () => mocks.teams }))
vi.mock('@/features/channels/composables/useActiveChannel', () => ({
  useActiveChannel: () => ({ select: vi.fn() }),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/features/messages/MessageAttachment.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('./search', () => ({
  searchMessages: mocks.searchMessages,
  searchFiles: mocks.searchFiles,
  searchLinks: mocks.searchLinks,
  searchUsers: mocks.searchUsers,
}))

describe('SearchPage channel-message search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.channels.channels = [
      { id: 'channel-1', name: 'General' },
      { id: 'channel-2', name: 'Announcements' },
    ]
    mocks.channels.getById.mockImplementation(
      (id) => mocks.channels.channels.find((channel) => channel.id === String(id)) ?? null,
    )
    mocks.dms.conversations = []
    mocks.dms.usersById = {}
    mocks.members.members = []
    mocks.messages.currentPageByChannel = {}
    mocks.messages.hasMorePagesByChannel = {}
    mocks.messages.recordsByChannel = {}
    mocks.messages.fetchChannelMessages.mockImplementation(async (id, { page = 1 } = {}) => {
      const key = String(id)
      mocks.messages.currentPageByChannel[key] = page
      mocks.messages.recordsByChannel[key] ||= []
      mocks.messages.recordsByChannel[key].push({
        id: `message-${key}-${page}`,
        content: `Searchable message from ${key}`,
        author: 'Channel User',
        authorId: 'user-1',
        createdAt: '2026-11-05T10:00:00.000Z',
      })
      mocks.messages.hasMorePagesByChannel[key] = key === 'channel-1' && page === 1
      return { success: true }
    })
    mocks.messages.messagesFor.mockImplementation(
      (id) => mocks.messages.recordsByChannel[String(id)],
    )
    mocks.searchMessages.mockResolvedValue({ items: [], totalPages: 1, total: 0 })
    mocks.searchFiles.mockResolvedValue({ items: [], totalPages: 1, total: 0 })
    mocks.searchLinks.mockResolvedValue({ items: [], totalPages: 1, total: 0 })
    mocks.searchUsers.mockResolvedValue([])
  })

  it('loads channel messages from the API for “over Whistle It” text searches', async () => {
    const wrapper = mount(SearchPage)
    await wrapper.get('input[value="all"]').setValue()
    await wrapper.get('input[placeholder="Type here..."]').setValue('searchable')

    await vi.waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled())

    expect(mocks.messages.fetchChannelMessages).toHaveBeenCalledTimes(3)
    expect(mocks.messages.fetchChannelMessages).toHaveBeenNthCalledWith(1, 'channel-1')
    expect(mocks.messages.fetchChannelMessages).toHaveBeenNthCalledWith(2, 'channel-1', {
      page: 2,
      olderPage: true,
    })
    expect(mocks.messages.fetchChannelMessages).toHaveBeenNthCalledWith(3, 'channel-2')
    expect(mocks.searchMessages.mock.calls.at(-1)[0].channelMessages).toMatchObject([
      {
        id: 'message-channel-1-1',
        text: 'Searchable message from channel-1',
        conversation: { id: 'channel-1', name: 'General' },
      },
      {
        id: 'message-channel-1-2',
        text: 'Searchable message from channel-1',
        conversation: { id: 'channel-1', name: 'General' },
      },
      {
        id: 'message-channel-2-1',
        text: 'Searchable message from channel-2',
        conversation: { id: 'channel-2', name: 'Announcements' },
      },
    ])

    wrapper.unmount()
  })
})
