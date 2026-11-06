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
  },
}))

describe('channels store membership visibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.listChannels.mockReset()
    api.browseChannels.mockReset()
    api.joinChannel.mockReset()
    api.listMembers.mockReset()
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

  it('reuses loaded members on repeated fetches', async () => {
    api.listMembers.mockResolvedValue({ items: [{ id: 'member-1' }], total: 1 })

    const store = useChannelsStore()
    await store.fetchMembers('channel-1', { limit: 5 })
    await store.fetchMembers('channel-1', { limit: 5 })

    expect(api.listMembers).toHaveBeenCalledTimes(1)
    expect(api.listMembers).toHaveBeenCalledWith('channel-1', { limit: 5 })
  })
})