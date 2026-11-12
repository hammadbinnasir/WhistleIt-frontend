import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import api from '../api'
import { useChannelsStore } from './channels.store'

vi.mock('../api', () => ({
  default: {
    listChannels: vi.fn(),
    browseChannels: vi.fn(),
    joinChannel: vi.fn(),
    listMembers: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    leaveChannel: vi.fn(),
  },
}))

describe('channels store membership visibility', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    api.listChannels.mockReset()
    api.browseChannels.mockReset()
    api.joinChannel.mockReset()
    api.listMembers.mockReset()
    api.createChannel.mockReset()
    api.updateChannel.mockReset()
    api.leaveChannel.mockReset().mockResolvedValue(undefined)
  })

  it('keeps only joined channels in the main channel list', async () => {
    api.listChannels.mockResolvedValue([
      { id: 'joined', isMember: true, isArchived: false },
      { id: 'not-joined', isMember: false, isArchived: false },
      { id: 'archived', isMember: true, isArchived: true },
    ])

    const store = useChannelsStore()
    await store.fetchChannels()

    expect(store.channels.map((channel) => channel.id)).toEqual(['joined'])
    expect(store.visibleChannels.map((channel) => channel.id)).toEqual(['joined'])
  })

  it('uses browse membership status instead of inferring it from the main list', async () => {
    api.listChannels.mockResolvedValue([{ id: 'joined', isMember: true, isArchived: false }])
    api.browseChannels.mockResolvedValue([
      { id: 'joined', isMember: false },
      { id: 'available', isMember: false },
    ])

    const store = useChannelsStore()
    await store.fetchBrowse()

    expect(store.browse.items).toMatchObject([
      { id: 'joined', isMember: false },
      { id: 'available', isMember: false },
    ])
  })

  it('merges a successful join into the existing browse channel', async () => {
    api.browseChannels.mockResolvedValue([
      { id: 'available', name: 'Available', isMember: false, memberCount: 4 },
    ])
    api.joinChannel.mockResolvedValue({ id: 'available', isMember: true })

    const store = useChannelsStore()
    await store.fetchBrowse()
    await store.joinChannel('available')

    expect(store.browse.items[0]).toMatchObject({
      id: 'available',
      name: 'Available',
      isMember: true,
      memberCount: 5,
    })
    expect(store.channels[0]).toMatchObject({ id: 'available', name: 'Available' })
  })

  it('lets every channel creator manage message permissions from channel settings', async () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'creator-1')
    api.createChannel.mockResolvedValue({
      id: 'new-channel',
      name: 'New Channel',
      isMember: true,
    })

    const store = useChannelsStore()
    const channel = await store.createChannel({
      name: 'New Channel',
      description: '',
      isPrivate: false,
    })

    expect(channel).toMatchObject({
      id: 'new-channel',
      canManage: true,
      isCreator: true,
      isOwner: true,
      createdById: 'creator-1',
      messagePermission: 'everyone',
      allowedSenderIds: [],
    })
    expect(store.getById('new-channel')).toMatchObject({
      canManage: true,
      isCreator: true,
      isOwner: true,
      messagePermission: 'everyone',
      allowedSenderIds: [],
    })
    expect(localStorage.getItem('whistleit-managed-channel-ids')).toContain('new-channel')

    setActivePinia(createPinia())
    api.listChannels.mockResolvedValue([{ id: 'new-channel', name: 'New Channel', isMember: true }])
    const refreshedStore = useChannelsStore()
    await refreshedStore.fetchChannels()
    expect(refreshedStore.getById('new-channel')).toMatchObject({
      isCreator: true,
      isOwner: true,
      createdById: 'creator-1',
    })
  })

  it('identifies creators of pre-existing channels from the API on every load', async () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'creator-2')
    api.listChannels.mockResolvedValue([
      {
        id: 'existing-channel',
        name: 'Existing Channel',
        isMember: true,
        createdById: 'creator-2',
      },
    ])

    const store = useChannelsStore()
    await store.fetchChannels()

    expect(store.getById('existing-channel')).toMatchObject({
      isCreator: true,
      isOwner: true,
      createdById: 'creator-2',
    })
  })

  it('preserves the API channel creator flag for the settings modal', async () => {
    api.listChannels.mockResolvedValue([
      {
        id: 'api-created-channel',
        name: 'API Created Channel',
        isMember: true,
        isCreator: true,
      },
    ])

    const store = useChannelsStore()
    await store.fetchChannels()

    expect(store.getById('api-created-channel')).toMatchObject({
      isCreator: true,
      isOwner: true,
    })
  })

  it('keeps saved message permissions after refresh when the channel list omits them', async () => {
    api.listChannels.mockResolvedValue([
      { id: 'restricted-channel', name: 'Restricted', isMember: true },
    ])
    api.updateChannel.mockResolvedValue({
      id: 'restricted-channel',
      name: 'Restricted',
      isMember: true,
    })

    const store = useChannelsStore()
    await store.fetchChannels()
    await store.updateChannel('restricted-channel', {
      messagePermission: 'creator_only',
      allowedSenderIds: [],
    })

    expect(store.getById('restricted-channel')).toMatchObject({
      messagePermission: 'creator_only',
      allowedSenderIds: [],
    })

    setActivePinia(createPinia())
    api.listChannels.mockResolvedValue([
      { id: 'restricted-channel', name: 'Restricted', isMember: true },
    ])
    const refreshedStore = useChannelsStore()
    await refreshedStore.fetchChannels()

    expect(refreshedStore.getById('restricted-channel')).toMatchObject({
      messagePermission: 'creator_only',
      allowedSenderIds: [],
    })
  })

  it('transfers management on leave and clears the previous admin local permission', async () => {
    api.createChannel.mockResolvedValue({
      id: 'transfer-channel',
      name: 'Transfer Channel',
      isMember: true,
    })
    const store = useChannelsStore()
    await store.createChannel({ name: 'Transfer Channel', isPrivate: false })

    await store.leaveChannel('transfer-channel', 'new-admin')

    expect(api.leaveChannel).toHaveBeenCalledWith('transfer-channel', 'new-admin')
    expect(store.getById('transfer-channel')).toBeNull()
    expect(localStorage.getItem('whistleit-managed-channel-ids')).not.toContain('transfer-channel')
    store.upsertChannel({
      id: 'transfer-channel',
      name: 'Transfer Channel',
      isMember: true,
      canManage: false,
    })
    expect(store.getById('transfer-channel').canManage).toBe(false)
  })

  it('reuses loaded members on repeated fetches', async () => {
    api.listMembers.mockResolvedValue({ items: [{ id: 'member-1' }], total: 1 })

    const store = useChannelsStore()
    await store.fetchMembers('channel-1', { limit: 5 })
    await store.fetchMembers('channel-1', { limit: 5 })

    expect(api.listMembers).toHaveBeenCalledTimes(1)
    expect(api.listMembers).toHaveBeenCalledWith('channel-1', { limit: 5 })
  })
})
