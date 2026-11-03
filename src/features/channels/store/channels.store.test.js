import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import api from '../api'
import { useChannelsStore } from './channels.store'

vi.mock('../api', () => ({
  default: {
    listChannels: vi.fn(),
    browseChannels: vi.fn(),
  },
}))

describe('channels store membership visibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.listChannels.mockReset()
    api.browseChannels.mockReset()
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
})