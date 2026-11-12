import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/features/dms/dmApi')
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import { dmApi, normalizeMessage, normalizePublicCustomStatus } from './dmApi'

describe('DM API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'user-1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'user-1' }))
  })

  it('reads the current user ID from local storage', () => {
    expect(dmApi.meId()).toBe('user-1')
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

  it('loads company member email from nested account records', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        members: [
          {
            user: {
              id: 'user-2',
              full_name: 'Alex Member',
              account: { email: 'alex@example.com' },
            },
          },
        ],
      },
    })

    await expect(dmApi.listCompanyMembers('company-1')).resolves.toMatchObject([
      { id: 'user-2', email: 'alex@example.com' },
    ])
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
                  custom_status: {
                    emoji: '📅',
                    text: 'In a meeting',
                    expires_at: '2026-11-11T11:35:32+00:00',
                  },
                },
              },
            },
          },
        },
        'user-2',
      ),
    ).toEqual({
      id: 'user-2',
      customStatus: {
        emoji: '📅',
        text: 'In a meeting',
        expiresAt: '2026-11-11T11:35:32+00:00',
      },
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
          lastActivityAt: '',
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

  it('loads direct channels from nested paginated API response data', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        data: {
          direct_channels: {
            data: [
              {
                direct_channel: {
                  id: 'channel-nested',
                  participants: [{ id: 'user-2', name: 'Alex' }],
                  messages: [],
                },
              },
            ],
          },
        },
      },
    })

    await expect(dmApi.listDirectChannels('company-1')).resolves.toMatchObject([
      { conversation: { id: 'channel-nested' } },
    ])
  })

  it('marks a direct conversation as recent and returns its recent timestamp', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { last_recent_at: '2026-03-17T10:00:00Z' },
    })

    await expect(dmApi.markRecent('company-1', 'channel-1')).resolves.toBe(
      '2026-03-17T10:00:00Z',
    )
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/recent',
      {
        method: 'PATCH',
        body: JSON.stringify({ is_recent: true }),
      },
    )
  })

  it('URL-encodes company and channel IDs when marking a conversation recent', async () => {
    apiRequest.mockResolvedValue(null)

    await expect(dmApi.markRecent('company 1', 'channel/1')).resolves.toBe('')
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company%201/direct-channels/channel%2F1/recent',
      {
        method: 'PATCH',
        body: JSON.stringify({ is_recent: true }),
      },
    )
  })

  it.each([
    'recent_at',
    'recentAt',
    'last_recent_at',
    'lastRecentAt',
    'updated_at',
    'updatedAt',
    'created_at',
    'createdAt',
  ])('reads the %s timestamp from the recent response', async (field) => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { [field]: '2026-03-17T10:00:00Z' },
    })

    await expect(dmApi.markRecent('company-1', 'channel-1')).resolves.toBe(
      '2026-03-17T10:00:00Z',
    )
  })

  it('propagates recent API errors and validates required IDs', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Recent update failed'))
    await expect(dmApi.markRecent('company-1', 'channel-1')).rejects.toThrow(
      'Recent update failed',
    )

    expect(() => dmApi.markRecent('', 'channel-1')).toThrow(
      'A company ID is required to mark a conversation as recent.',
    )
    expect(() => dmApi.markRecent('company-1', '')).toThrow(
      'A channel ID is required to load a direct conversation.',
    )
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

  it('sends code-mode metadata using the backend is_code field', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { message: { id: 'm-code', body: 'const answer = 42', is_code: true } },
    })

    await dmApi.sendMessage('company-1', 'channel-1', {
      body: 'const answer = 42',
      isCode: true,
    })

    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ body: 'const answer = 42', is_code: true }),
      },
    )
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

  it('sends a prepared recent file as multipart binary data without a file ID', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { message: { id: 'm13', sender_id: 'user-1', body: 'See attached' } },
    })
    const file = new File(['report'], 'report.pdf', { type: 'application/pdf' })

    await dmApi.sendMessage('company-1', 'channel-1', {
      body: 'See attached',
      attachment: file,
      attachmentSource: 'recent',
    })

    const [url, options] = apiRequest.mock.calls[0]
    expect(url).toBe('/v1/company-1/direct-channels/channel-1/messages')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBeInstanceOf(File)
    expect(options.body.get('file').name).toBe('report.pdf')
    expect(options.body.get('companyId')).toBe('company-1')
    expect(options.body.get('chatId')).toBe('channel-1')
    expect(options.body.get('fileName')).toBe('report.pdf')
    expect(options.body.get('body')).toBe('See attached')
    expect(options.body.get('attachmentSource')).toBeNull()
    expect(options.body.get('fileId')).toBeNull()
    expect(options.body.get('file_id')).toBeNull()
    expect(options.body.get('attachment')).toBeNull()
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
    ).toMatchObject({ forwardedFrom: 'forwarded' })
  })

  it('recognizes the forwarded body marker when the API omits forwarding metadata', () => {
    expect(normalizeMessage({ id: 'm12', body: '[Forwarded] Forwarded text' })).toMatchObject({
      text: 'Forwarded text',
      forwardedFrom: 'forwarded',
    })
  })

  it('recognizes backend deleted flags and does not infer an edit from delete updated_at', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm13',
            body: 'Original text',
            created_at: '2026-11-11T09:00:00Z',
            updated_at: '2026-11-11T09:05:00Z',
            is_deleted: ' TRUE ',
          },
          {
            id: 'm14',
            body: 'Original text',
            is_deleted: false,
            deleted_at: '2026-11-11T09:05:00Z',
          },
          {
            id: 'm15',
            body: 'Original text',
            deleted: true,
            edited_at: '2026-11-11T09:04:00Z',
          },
          {
            message: {
              id: 'm16',
              body: 'Original text',
              updated_at: '2026-11-11T09:05:00Z',
              created_at: '2026-11-11T09:00:00Z',
            },
            is_deleted: '1',
          },
        ],
      },
    })

    const messages = await dmApi.listMessages('company-1', 'channel-1')

    expect(messages).toMatchObject([
      { id: 'm13', deleted: true },
      { id: 'm14', deleted: true },
      { id: 'm15', deleted: true },
      { id: 'm16', deleted: true },
    ])
    expect(messages.every((message) => !message.editedAt)).toBe(true)
  })

  it('removes API paragraph wrappers from direct-message bodies', () => {
    expect(normalizeMessage({ id: 'm12', body: '<p>byeee</p>' })).toMatchObject({
      text: 'byeee',
    })
  })

  it('normalizes code-mode metadata from direct messages', () => {
    expect(
      normalizeMessage({
        id: 'code-message',
        body: 'const answer = 42',
        is_code: true,
        sender_id: 'user-1',
      }),
    ).toMatchObject({
      text: 'const answer = 42',
      isCode: true,
      from: 'user-1',
    })
  })

  it('normalizes string code flags without treating false-like values as enabled', () => {
    expect(normalizeMessage({ id: 'code-enabled', body: 'x', is_code: '1' }).isCode).toBe(true)
    expect(normalizeMessage({ id: 'code-disabled', body: 'x', is_code: 'false' }).isCode).toBe(false)
    expect(normalizeMessage({ id: 'code-disabled-zero', body: 'x', is_code: '0' }).isCode).toBe(false)
    expect(normalizeMessage({ id: 'code-unspecified', body: 'x', is_code: null }).isCode).toBeUndefined()
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

  it('deletes a message of a direct channel and normalizes the deleted response', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      message: 'Message deleted successfully.',
      data: {
        message: {
          id: 'm9',
          channel_id: 'channel-1',
          parent_id: null,
          body: null,
          sender: null,
          attachment: [],
          embeds: [],
          mentions: [],
          is_important: null,
          is_forwarded: false,
          forward_tag: null,
          forwarded_from_message_id: null,
          is_deleted: true,
          placeholder: 'This message was deleted.',
          edited_at: null,
          created_at: '2026-11-11 09:50:19',
          updated_at: '2026-11-11 15:14:42',
          reactions: null,
        },
      },
    })

    const deletedMessage = await dmApi.deleteMessage('company-1', 'channel-1', 'm9')
    expect(deletedMessage).toMatchObject({
      id: 'm9',
      deleted: true,
      is_deleted: true,
      text: '',
      placeholder: 'This message was deleted.',
    })
    expect(deletedMessage).not.toHaveProperty('editedAt')

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
