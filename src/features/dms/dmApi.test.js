import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/features/dms/dmApi')
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import { dmApi } from './dmApi'

describe('DM API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'user-1' }))
  })

  it('loads normalized company members', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        members: [
          {
            id: 'membership-1',
            user: {
              id: 'user-2',
              full_name: 'Alex Member',
              email: 'alex@example.com',
              avatar_url: '/avatars/alex.png',
            },
          },
        ],
      },
    })

    await expect(dmApi.listCompanyMembers('company-1')).resolves.toEqual([
      {
        id: 'user-2',
        name: 'Alex Member',
        email: 'alex@example.com',
        avatarUrl: '/avatars/alex.png',
      },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/company/company-1/members')
  })

  it('loads members from the companyusers.members response returned by the API', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      message: 'Company members retrieved successfully.',
      data: {
        companyusers: {
          id: 'company-1',
          name: 'pf',
          creator_id: 'user-1',
          members: [{ id: 'user-1', name: 'Aiman Iqbal' }],
        },
      },
    })

    await expect(dmApi.listCompanyMembers('company-1')).resolves.toEqual([
      {
        id: 'user-1',
        name: 'Aiman Iqbal',
        email: '',
        avatarUrl: '',
      },
    ])
  })

  it('URL-encodes the company ID when loading company members', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { members: [] } })

    await dmApi.listCompanyMembers('company 1')

    expect(apiRequest).toHaveBeenCalledWith('/company/company%201/members')
  })

  it('loads team users who are not members of that team', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        notteamusers: {
          members: [{ id: 'user-3', name: 'Available Member' }],
        },
      },
    })

    await expect(dmApi.listTeamNonMembers('company-1', 'team-1')).resolves.toEqual([
      {
        id: 'user-3',
        name: 'Available Member',
        email: '',
        avatarUrl: '',
      },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams/team-1/notmembers')
  })

  it('lists direct channels for a company', async () => {
    const response = {
      success: true,
      data: {
        direct_channels: [
          {
            id: 'channel-1',
            participants: [
              { id: 'user-1', name: 'Me' },
              { id: 'user-2', name: 'Alex' },
            ],
            messages: [{ id: 'message-1', sender_id: 'user-2', content: 'Hello' }],
          },
        ],
      },
    }
    apiRequest.mockResolvedValue(response)

    await expect(dmApi.listDirectChannels('company-1')).resolves.toEqual([
      {
        conversation: {
          id: 'channel-1',
          type: 'dm',
          members: ['user-1', 'user-2'],
          name: '',
          unreadCount: 0,
          isFavorite: false,
          messages: [
            {
              id: 'message-1',
              sender_id: 'user-2',
              content: 'Hello',
              from: 'user-2',
              text: 'Hello',
              createdAt: '',
            },
          ],
        },
        users: [
          { id: 'user-1', name: 'Me', avatarUrl: '' },
          { id: 'user-2', name: 'Alex', avatarUrl: '' },
        ],
      },
    ])

    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels')
  })

  it('URL-encodes the company ID', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { direct_channels: [] } })

    await dmApi.listDirectChannels('company 1')

    expect(apiRequest).toHaveBeenCalledWith('/v1/company%201/direct-channels')
  })

  it('creates a direct channel for a company', async () => {
    const payload = { recipient_id: 'user-2' }
    const response = { success: true, data: { id: 'channel-1' } }
    apiRequest.mockResolvedValue(response)

    await expect(dmApi.createDirectChannel('company-1', payload)).resolves.toMatchObject({
      conversation: {
        id: 'channel-1',
        members: ['user-1'],
      },
    })

    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })

  it('gets one direct conversation by company and channel ID', async () => {
    const response = {
      success: true,
      data: {
        direct_channel: {
          id: 'channel-1',
          participants: [{ id: 'user-2', name: 'Alex' }],
          messages: [],
        },
      },
    }
    apiRequest.mockResolvedValue(response)

    await expect(dmApi.getDirectChannel('company-1', 'channel-1')).resolves.toMatchObject({
      conversation: {
        id: 'channel-1',
        members: ['user-1', 'user-2'],
        messages: [],
      },
      users: [{ id: 'user-2', name: 'Alex', avatarUrl: '' }],
    })

    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1')
  })

  it('URL-encodes company and channel IDs when getting a direct conversation', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { id: 'channel/1' } })

    await dmApi.getDirectChannel('company 1', 'channel/1')

    expect(apiRequest).toHaveBeenCalledWith('/v1/company%201/direct-channels/channel%2F1')
  })

  it('rejects a list response that does not contain a conversation array', async () => {
    apiRequest.mockResolvedValue({ success: true, data: {} })

    await expect(dmApi.listDirectChannels('company-1')).rejects.toThrow(
      'The direct channels response does not contain a conversation list.',
    )
  })

  it('surfaces a missing authentication token response from the API', async () => {
    const errorResponse = {
      success: false,
      message: 'Missing authentication token.',
      data: null,
    }
    apiRequest.mockRejectedValue({
      message: errorResponse.message,
      details: errorResponse,
    })

    await expect(dmApi.listDirectChannels('company-1')).rejects.toMatchObject({
      message: 'Missing authentication token.',
      details: errorResponse,
    })
  })

  it('requires a company ID', () => {
    expect(() => dmApi.listDirectChannels('')).toThrow(
      'A company ID is required to load direct channels.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('requires both IDs when getting a direct conversation', () => {
    expect(() => dmApi.getDirectChannel('', 'channel-1')).toThrow(
      'A company ID is required to load direct channels.',
    )
    expect(() => dmApi.getDirectChannel('company-1', '')).toThrow(
      'A channel ID is required to load a direct conversation.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('requires a company ID when creating a direct channel', () => {
    expect(() => dmApi.createDirectChannel('', { recipient_id: 'user-2' })).toThrow(
      'A company ID is required to load direct channels.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
