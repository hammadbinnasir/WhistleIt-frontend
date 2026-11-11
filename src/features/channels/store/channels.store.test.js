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
  },
}))

describe('channels store membership visibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.listChannels.mockReset()
    api.browseChannels.mockReset()
    api.joinChannel.mockReset()
    api.listMembers.mockReset()
    api.createChannel.mockReset()
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
    api.listChannels.mockResolvedValue([
      { id: 'joined', isMember: true, isArchived: false },
    ])
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
      messagePermission: 'everyone',
      allowedSenderIds: [],
    })
    expect(store.getById('new-channel')).toMatchObject({
      canManage: true,
      messagePermission: 'everyone',
      allowedSenderIds: [],
    })
    expect(localStorage.getItem('whistleit-managed-channel-ids')).toContain('new-channel')
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