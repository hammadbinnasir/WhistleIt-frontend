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
    ensureLoaded: vi.fn(),
    loadMessages: vi.fn(),
    hasMoreOlder: vi.fn(),
    loadOlderMessages: vi.fn(),
  },
  dmApi: {
    listMessages: vi.fn(),
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
vi.mock('@/features/dms/dmApi', () => ({ dmApi: mocks.dmApi }))
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
    mocks.dms.ensureLoaded.mockResolvedValue()
    mocks.dms.loadMessages.mockResolvedValue(true)
    mocks.dms.hasMoreOlder.mockReturnValue(false)
    mocks.dms.loadOlderMessages.mockResolvedValue(false)
    mocks.dmApi.listMessages.mockResolvedValue(
      Object.assign([], { pagination: { page: 1, hasMore: false, lastPage: 1 } }),
    )
    mocks.members.members = []
    mocks.messages.currentPageByChannel = {}
    mocks.messages.hasMorePagesByChannel = {}
    mocks.messages.recordsByChannel = {}
    mocks.messages.fetchChannelMessages.mockImplementation(
      async (id, { page = 1, searchOnly } = {}) => {
        const key = String(id)
        const message = {
          id: `message-${key}-${page}`,
          content: `Searchable message from ${key}`,
          author: 'Channel User',
          authorId: 'user-1',
          createdAt: '2026-11-05T10:00:00.000Z',
        }
        return {
          success: true,
          data: [message],
          ...(searchOnly
            ? {
                currentPage: page,
                hasMorePages: key === 'channel-1' && page === 1,
              }
            : {}),
        }
      },
    )
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
    expect(mocks.messages.fetchChannelMessages).toHaveBeenNthCalledWith(1, 'channel-1', {
      query: 'searchable',
      searchOnly: true,
    })
    expect(mocks.messages.fetchChannelMessages).toHaveBeenNthCalledWith(2, 'channel-1', {
      page: 2,
      olderPage: true,
      query: 'searchable',
      searchOnly: true,
    })
    expect(mocks.messages.fetchChannelMessages).toHaveBeenNthCalledWith(3, 'channel-2', {
      query: 'searchable',
      searchOnly: true,
    })
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

  it('searches direct messages from paginated API results and excludes cached messages', async () => {
    mocks.dms.conversations = [
      {
        id: 'dm-1',
        name: 'Alex',
        messages: [{ id: 'cached-only', text: 'Searchable cached message', from: 'user-2' }],
      },
    ]
    mocks.dms.titleOf.mockReturnValue('Alex')
    mocks.dmApi.listMessages.mockImplementation(async (_companyId, _conversationId, { page }) => {
      const messages =
        page === 1
          ? [
              {
                id: 'api-dm-message-1',
                text: 'Searchable direct message',
                from: 'user-2',
                createdAt: '2026-11-05T10:00:00.000Z',
              },
            ]
          : [
              {
                id: 'api-dm-message-2',
                text: 'Older searchable direct message',
                from: 'user-2',
                createdAt: '2026-11-04T10:00:00.000Z',
              },
            ]
      return Object.assign(messages, {
        pagination: {
          page,
          hasMore: page === 1,
          lastPage: 2,
        },
      })
    })

    const wrapper = mount(SearchPage, { props: { dmConversationId: 'dm-1' } })
    await wrapper.get('input[placeholder="Type here..."]').setValue('searchable')

    await vi.waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled())

    expect(mocks.dmApi.listMessages).toHaveBeenNthCalledWith(1, 'company-1', 'dm-1', {
      page: 1,
      query: 'searchable',
    })
    expect(mocks.dmApi.listMessages).toHaveBeenNthCalledWith(2, 'company-1', 'dm-1', {
      page: 2,
      query: 'searchable',
    })
    expect(mocks.searchMessages.mock.calls.at(-1)[0].dmMessages).toMatchObject([
      {
        id: 'api-dm-message-1',
        text: 'Searchable direct message',
        conversation: { id: 'dm-1', name: 'Alex', kind: 'dm' },
      },
      {
        id: 'api-dm-message-2',
        text: 'Older searchable direct message',
        conversation: { id: 'dm-1', name: 'Alex', kind: 'dm' },
      },
    ])
    expect(mocks.searchMessages.mock.calls.at(-1)[0].dmMessages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'cached-only' })]),
    )

    wrapper.unmount()
  })

  it('passes file search terms to the API and explains when no files match in the chat', async () => {
    const wrapper = mount(SearchPage, { props: { channelId: 'channel-1' } })
    const fileTab = wrapper.findAll('nav button').find((button) => button.text().trim() === 'File')
    await fileTab.trigger('click')
    await wrapper.get('input[placeholder="Type here..."]').setValue('missing-file')

    await vi.waitFor(() =>
      expect(mocks.messages.fetchChannelMessages).toHaveBeenCalledWith('channel-1', {
        searchOnly: true,
        query: 'missing-file',
      }),
    )
    await vi.waitFor(() =>
      expect(mocks.searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'missing-file' }),
      ),
    )
    await vi.waitFor(() => expect(wrapper.text()).toContain('No matching files found'))
    expect(wrapper.text()).toContain('in this chat')

    wrapper.unmount()
  })
})
