import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/features/dms/dmApi')
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import { dmApi, normalizeMessage, normalizePublicCustomStatus } from './dmApi'

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

  it('preserves custom status details from company member records', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        members: [
          {
            user: {
              id: 'user-2',
              full_name: 'Alex Member',
              custom_status: { emoji: '📅', text: 'In a meeting' },
            },
          },
        ],
      },
    })

    await expect(dmApi.listCompanyMembers('company-1')).resolves.toMatchObject([
      {
        id: 'user-2',
        customStatus: { emoji: '📅', text: 'In a meeting' },
      },
    ])
  })

  it('normalizes custom status details nested in a public user profile', () => {
    expect(
      normalizePublicCustomStatus(
        {
          data: {
            data: {
              user: {
                profile: {
                  custom_status: { emoji: '📅', text: 'In a meeting' },
                },
              },
            },
          },
        },
        'user-2',
      ),
    ).toEqual({
      id: 'user-2',
      customStatus: { emoji: '📅', text: 'In a meeting' },
      customStatusLoaded: true,
    })
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

  it('uses the nested user ID and member name from the workspace members response', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        companyusers: {
          members: [
            {
              id: 'membership-8',
              name: 'Mukarram Ali',
              user: {
                id: 'user-8',
                email: 'mukarram@example.com',
                avatar_url: '/avatars/mukarram.png',
              },
            },
          ],
        },
      },
    })

    await expect(dmApi.listCompanyMembers('company-1')).resolves.toEqual([
      {
        id: 'user-8',
        name: 'Mukarram Ali',
        email: 'mukarram@example.com',
        avatarUrl: '/avatars/mukarram.png',
      },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/company/company-1/members')
  })

  it('URL-encodes the company ID when loading company members', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { members: [] } })

    await dmApi.listCompanyMembers('company 1')

    expect(apiRequest).toHaveBeenCalledWith('/company/company%201/members')
  })

  it('loads team members from the team-scoped members endpoint', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        teamusers: {
          members: [
            {
              id: 'user-2',
              name: 'Team User',
              email: 'user@example.com',
              avatar_url: '/avatars/user.png',
            },
          ],
        },
      },
    })

    await expect(dmApi.listTeamMembers('company-1', 'team-1')).resolves.toEqual([
      {
        id: 'user-2',
        name: 'Team User',
        email: 'user@example.com',
        avatarUrl: '/avatars/user.png',
      },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams/team-1/members')
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
              {
                id: 'user-2',
                name: 'Alex',
                custom_status: { emoji: '📅', text: 'In a meeting' },
              },
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
              backendSynced: true,
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
          {
            id: 'user-2',
            name: 'Alex',
            avatarUrl: '',
            customStatus: { emoji: '📅', text: 'In a meeting' },
            customStatusLoaded: true,
          },
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

  // ---------------- Messages ----------------

  it('lists messages of a direct channel', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { messages: [{ id: 'm1', sender_id: 'user-2', body: 'Hello' }] },
    })

    await expect(dmApi.listMessages('company-1', 'channel-1')).resolves.toMatchObject([
      { id: 'm1', from: 'user-2', text: 'Hello' },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages')
  })

  it('URL-encodes IDs when loading messages', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { messages: [] } })

    await dmApi.listMessages('company 1', 'channel/1')

    expect(apiRequest).toHaveBeenCalledWith('/v1/company%201/direct-channels/channel%2F1/messages')
  })

  it('gets one message of a direct channel', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { message: { id: 'm1', sender_id: 'user-2', body: 'Hello' } },
    })

    await expect(dmApi.getMessage('company-1', 'channel-1', 'm1')).resolves.toMatchObject({
      id: 'm1',
      from: 'user-2',
      text: 'Hello',
    })
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages/m1')
  })

  it('normalizes the backend singular attachment field on direct messages', () => {
    expect(
      normalizeMessage({
        id: 'm1',
        attachment: [{ id: 'file-1', name: 'men.jpg', path: 'messages/men.jpg' }],
      }),
    ).toMatchObject({
      attachments: [{ id: 'file-1', name: 'men.jpg', path: 'messages/men.jpg' }],
    })
  })

  it('sends a message to a direct channel', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { message: { id: 'm9', sender_id: 'user-1', body: 'Hi' } },
    })

    await expect(
      dmApi.sendMessage('company-1', 'channel-1', { body: 'Hi' }),
    ).resolves.toMatchObject({ id: 'm9', from: 'user-1', text: 'Hi' })
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages', {
      method: 'POST',
      body: JSON.stringify({ body: 'Hi' }),
    })
  })

  it('sends a direct message and attachments as multipart form data', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { message: { id: 'm12', sender_id: 'user-1', body: 'See attached' } },
    })
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })

    await expect(
      dmApi.sendMessage('company-1', 'channel-1', {
        body: 'See attached',
        attachment,
        is_important: false,
      }),
    ).resolves.toMatchObject({ id: 'm12', text: 'See attached' })

    const [, options] = apiRequest.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('body')).toBe('See attached')
    expect(options.body.get('message')).toBeNull()
    expect(options.body.get('attachment')).toBeInstanceOf(File)
    expect(options.body.get('attachment').name).toBe('report.txt')
    expect(options.body.get('is_important')).toBe('0')
  })

  it('rejects attachment arrays because only one file can be sent per message', () => {
    expect(() =>
      dmApi.sendMessage('company-1', 'channel-1', {
        body: 'See attached',
        attachments: [new File(['report'], 'report.txt', { type: 'text/plain' })],
      }),
    ).toThrow('Only one message attachment is supported.')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('sends a voice-note ID and normalizes voice notes received from a direct channel', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        message: { id: 'm10', sender_id: 'user-2', body: '', voice_note_id: 'voice-8' },
      },
    })

    await expect(
      dmApi.sendMessage('company-1', 'channel-1', { body: '', voice_note_id: 'voice-8' }),
    ).resolves.toMatchObject({ id: 'm10', voiceNoteId: 'voice-8' })
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages', {
      method: 'POST',
      body: JSON.stringify({ body: 'Voice message', voice_note_id: 'voice-8' }),
    })

    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm11',
            sender_id: 'user-3',
            body: 'Voice message',
            sender: { id: 'user-3', voice_note: { id: 'voice-9' } },
          },
        ],
      },
    })
    await expect(dmApi.listMessages('company-1', 'channel-1')).resolves.toMatchObject([
      { id: 'm11', voiceNoteId: 'voice-9' },
    ])

    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            message: {
              id: 'm12',
              sender_id: 'user-3',
              body: 'Voice message',
            },
            voice_note: { voice_note_id: 'voice-10' },
          },
        ],
      },
    })
    await expect(dmApi.listMessages('company-1', 'channel-1')).resolves.toMatchObject([
      { id: 'm12', voiceNoteId: 'voice-10' },
    ])
  })

  it('sends forwarded metadata and normalizes it for direct-channel messages', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: 'm10',
          sender_id: 'user-1',
          body: 'Forwarded text',
          forwardedFrom: 'Aiman in General',
        },
      },
    })

    await expect(
      dmApi.sendMessage('company-1', 'channel-1', {
        body: 'Forwarded text',
        forwardedFrom: 'Aiman in General',
      }),
    ).resolves.toMatchObject({
      id: 'm10',
      text: 'Forwarded text',
      forwardedFrom: 'Aiman in General',
    })
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        body: 'Forwarded text',
        forwardedFrom: 'Aiman in General',
      }),
    })
  })

  it('normalizes forwarded flags returned by the direct-message API', () => {
    expect(
      normalizeMessage({
        id: 'm11',
        body: 'Forwarded text',
        is_forwarded: true,
      }),
    ).toMatchObject({ forwardedFrom: true })
  })

  it('removes API paragraph wrappers from direct-message bodies', () => {
    expect(normalizeMessage({ id: 'm12', body: '<p>byeee</p>' })).toMatchObject({
      text: 'byeee',
    })
  })

  it('updates a message of a direct channel', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null })

    await expect(
      dmApi.updateMessage('company-1', 'channel-1', 'm9', { body: 'Edited' }),
    ).resolves.toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages/m9', {
      method: 'PATCH',
      body: JSON.stringify({ body: 'Edited' }),
    })
  })

  it('deletes a message of a direct channel', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null })

    await dmApi.deleteMessage('company-1', 'channel-1', 'm9')

    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages/m9', {
      method: 'DELETE',
    })
  })

  it('requires the IDs for message requests', () => {
    expect(() => dmApi.listMessages('', 'channel-1')).toThrow(
      'A company ID is required to load messages.',
    )
    expect(() => dmApi.listMessages('company-1', '')).toThrow(
      'A channel ID is required to load a direct conversation.',
    )
    expect(() => dmApi.updateMessage('company-1', 'channel-1', '', { body: 'x' })).toThrow(
      'A message ID is required.',
    )
    expect(() => dmApi.deleteMessage('company-1', 'channel-1', '')).toThrow(
      'A message ID is required.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
