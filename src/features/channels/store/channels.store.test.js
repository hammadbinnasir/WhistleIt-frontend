import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import api from '../api'
import { useChannelsStore } from './channels.store'

vi.mock('../api', () => ({
  default: {
<<<<<<< Updated upstream
    listChannels: vi.fn(),
=======
    listMyChannels: vi.fn(),
>>>>>>> Stashed changes
    browseChannels: vi.fn(),
  },
}))

describe('channels store membership visibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
<<<<<<< Updated upstream
    api.listChannels.mockReset()
=======
    api.listMyChannels.mockReset()
>>>>>>> Stashed changes
    api.browseChannels.mockReset()
  })

  it('keeps only joined channels in the main channel list', async () => {
<<<<<<< Updated upstream
    api.listChannels.mockResolvedValue([
=======
    api.listMyChannels.mockResolvedValue([
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    api.listChannels.mockResolvedValue([
=======
    api.listMyChannels.mockResolvedValue([
>>>>>>> Stashed changes
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

  it('combines all browse results with joined channels for the sidebar', async () => {
    api.listMyChannels.mockResolvedValue([
      { id: 'joined', name: 'Joined', isMember: true, isArchived: false },
    ])
    api.browseChannels.mockResolvedValue([
      { id: 'joined', name: 'Joined', isMember: false, isArchived: false },
      { id: 'available', name: 'Available', isMember: false, isArchived: false },
      { id: 'archived', name: 'Archived', isMember: false, isArchived: true },
    ])

    const store = useChannelsStore()
    await Promise.all([store.fetchChannels(), store.fetchDirectory()])

    expect(store.allChannels.map(({ id }) => id)).toEqual(['joined', 'available'])
    expect(store.allChannels[0].isMember).toBe(true)
    expect(store.allChannels[1].isMember).toBe(false)
  })
})