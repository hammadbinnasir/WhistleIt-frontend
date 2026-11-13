import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/features/dms/dmApi')
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))
vi.mock('@/features/auth/session', () => ({
  getAuthUser: vi.fn(() => null),
  getAuthUserId: vi.fn(() => null),
}))

import { apiRequest } from '@/lib/api/client'
import { getAuthUser } from '@/features/auth/session'
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
          lastActivityAt: '',
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

  it('marks messages edited from the API edited_at / updated_at fields', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: 'm1', body: 'a', created_at: 'T1', updated_at: 'T1' },
          { id: 'm2', body: 'b', created_at: 'T1', updated_at: 'T2' },
          { id: 'm3', body: 'c', created_at: 'T1', edited_at: 'T3' },
        ],
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(list.map((m) => m.editedAt)).toEqual([undefined, 'T2', 'T3'])
  })

  it('does not mark a message edited when updated_at differs from created_at by milliseconds', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm1',
            body: 'new',
            created_at: '2026-01-01T10:00:00.808Z',
            updated_at: '2026-01-01T10:00:00.810Z',
          },
          {
            id: 'm2',
            body: 'edited',
            created_at: '2026-01-01T10:00:00Z',
            updated_at: '2026-01-01T10:05:00Z',
          },
        ],
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    const editedAt = Object.fromEntries(list.map((m) => [m.id, m.editedAt]))
    expect(editedAt).toEqual({ m1: undefined, m2: '2026-01-01T10:05:00Z' })
  })

  it('reads a paginated messages response and sorts messages oldest first', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        current_page: 1,
        data: [
          { id: 'm2', sender_id: 'user-1', body: 'Second', created_at: '2026-01-01T10:01:00Z' },
          { id: 'm1', sender_id: 'user-2', body: 'First', created_at: '2026-01-01T10:00:00Z' },
        ],
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(list.map((m) => m.text)).toEqual(['First', 'Second'])
  })

  it('reads paginated messages nested under messages.data', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { messages: { data: [{ id: 'm1', body: 'Hello' }], total: 1 } },
    })

    await expect(dmApi.listMessages('company-1', 'channel-1')).resolves.toMatchObject([
      { id: 'm1', text: 'Hello' },
    ])
  })

  it('normalizes message reactions so the other user sees them', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm1',
            body: 'Hi',
            reactions: [
              { emoji: '👍', users: [{ id: 'user-1' }, { id: 'user-2' }] },
              { emoji: '🎉', user_id: 'user-2' },
            ],
          },
        ],
      },
    })

    const [message] = await dmApi.listMessages('company-1', 'channel-1')

    expect(message.reactions).toEqual([
      { emoji: '👍', users: ['user-1', 'user-2'] },
      { emoji: '🎉', users: ['user-2'] },
    ])
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

  // ---------------- Replies line + presence ----------------

  it('reads the reply count and last reply time of a message', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: 'm1', body: 'a', replies_count: 5, last_reply_at: '2026-11-02T08:02:00Z' },
          {
            id: 'm2',
            body: 'b',
            replies: [
              { id: 'r1', created_at: 'T1' },
              { id: 'r2', created_at: 'T2' },
            ],
          },
          { id: 'm3', body: 'c' },
        ],
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(list.map((m) => [m.replyCount, m.lastReplyAt])).toEqual([
      [5, '2026-11-02T08:02:00Z'],
      [2, 'T2'],
      [undefined, undefined],
    ])
  })

  it('reads online / away / offline from the company members response', async () => {
    const now = Date.now()
    const ago = (ms) => new Date(now - ms).toISOString()
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        members: [
          { id: 'mem-1', user: { id: 'u2' }, is_online: true },
          { id: 'u3', presence: 'away' },
          { id: 'u4', last_seen_at: ago(30_000) },
          { id: 'u5', last_seen_at: ago(5 * 60_000) },
          { id: 'u6', last_seen_at: ago(60 * 60_000) },
          { id: 'u7', online: false },
          { id: 'u8', name: 'No presence info' },
        ],
      },
    })

    const presence = await dmApi.presence('company-1')

    expect(apiRequest).toHaveBeenCalledWith('/company/company-1/members')
    expect(Object.fromEntries(Object.entries(presence).map(([id, p]) => [id, p.state]))).toEqual({
      u2: 'online',
      u3: 'away',
      u4: 'online',
      u5: 'away',
      u6: 'offline',
      u7: 'offline',
    })
    expect(presence.u4.lastSeenAt).toBe(ago(30_000))
  })

  it('does not call the API for presence without a company', async () => {
    await expect(dmApi.presence('')).resolves.toEqual({})
    expect(apiRequest).not.toHaveBeenCalled()
  })

  // ---------------- User status ----------------

  it('updates my status with PUT /v1/users/{user}/status', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { user_id: 'user-1', status: 'away' } })

    await expect(dmApi.updateUserStatus('user-1', { status: 'away' })).resolves.toMatchObject({
      state: 'away',
    })
    expect(apiRequest).toHaveBeenCalledWith('/v1/users/user-1/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'away' }),
    })
  })

  it('sends "offline" with keepalive so it survives the page closing', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null })

    await expect(
      dmApi.updateUserStatus('user 1', { status: 'offline' }, { keepalive: true }),
    ).resolves.toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/v1/users/user%201/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'offline' }),
      keepalive: true,
    })
  })

  it('reads a user status with GET and understands different shapes', async () => {
    apiRequest.mockResolvedValueOnce({
      success: true,
      data: { status: 'active', status_text: 'Coding' },
    })
    await expect(dmApi.getUserStatus('user-2')).resolves.toMatchObject({
      state: 'online',
      status: { emoji: '', text: 'Coding' },
    })
    expect(apiRequest).toHaveBeenCalledWith('/v1/users/user-2/status')

    apiRequest.mockResolvedValueOnce({ success: true, data: { user_status: { is_online: false } } })
    await expect(dmApi.getUserStatus('user-2')).resolves.toMatchObject({ state: 'offline' })
  })

  it('requires a user ID for the status', () => {
    expect(() => dmApi.updateUserStatus('', { status: 'online' })).toThrow(
      'A user ID is required for the user status.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })

  // ---------------- Login user ----------------

  it('uses the app login user (getAuthUser) for my user ID', () => {
    getAuthUser.mockReturnValueOnce({ id: 42, fullName: 'Ahmad Imran', email: 'ahmad@example.com' })
    expect(dmApi.meId()).toBe('42')

    getAuthUser.mockReturnValueOnce({
      fullName: 'Ahmad Imran',
      email: 'ahmad@example.com',
      user: { id: 'srv-7' },
    })
    expect(dmApi.meId()).toBe('srv-7')
  })

  it('falls back to sessionStorage authUser when the session module has no user', () => {
    getAuthUser.mockReturnValueOnce(null)
    expect(dmApi.meId()).toBe('user-1')
  })

  it('marks soft-deleted messages from the API as deleted', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: 'm1', body: 'x', deleted_at: '2026-01-01T10:00:00Z' },
          { id: 'm2', body: 'y', is_deleted: '1' },
          { id: 'm3', body: 'z' },
        ],
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(list.map((m) => Boolean(m.deleted))).toEqual([true, true, false])
  })

  // ---------------- Reactions ki mukhtalif shapes ----------------

  it('understands count-only reactions and marks mine', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm1',
            body: 'x',
            reactions: [
              { reaction: '👍', count: 3, reacted: true },
              { reaction: '🎉', count: 1 },
            ],
          },
        ],
      },
    })

    const [message] = await dmApi.listMessages('company-1', 'channel-1')

    expect(
      message.reactions.map((r) => [r.emoji, r.users.length, r.users.includes('user-1')]),
    ).toEqual([
      ['👍', 3, true],
      ['🎉', 1, false],
    ])
  })

  it('understands reactions as an object and under message_reactions', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: 'm1', body: 'a', reactions: { '👍': ['user-2'], '❤️': 2 } },
          { id: 'm2', body: 'b', message_reactions: [{ reaction: '😂', user_id: 'user-2' }] },
        ],
      },
    })

    const [a, b] = await dmApi.listMessages('company-1', 'channel-1')

    expect(a.reactions.map((r) => [r.emoji, r.users.length])).toEqual([
      ['👍', 1],
      ['❤️', 2],
    ])
    expect(b.reactions).toEqual([{ emoji: '😂', users: ['user-2'] }])
  })

  it('counts reaction rows without a user and reads an emoji inside an object', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm1',
            body: 'a',
            reactions: [
              { id: 1, reaction: '👍' },
              { id: 2, reaction: '👍' },
            ],
          },
          { id: 'm2', body: 'b', reactions: [{ reaction: { emoji: '🎉' }, user: 'user-2' }] },
        ],
      },
    })

    const [a, b] = await dmApi.listMessages('company-1', 'channel-1')

    expect(a.reactions.map((r) => [r.emoji, r.users.length])).toEqual([['👍', 2]])
    expect(b.reactions).toEqual([{ emoji: '🎉', users: ['user-2'] }])
  })

  it('does not wipe reactions when their shape is not understood', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apiRequest.mockResolvedValue({
      success: true,
      data: { messages: [{ id: 'm1', body: 'a', reactions: [{ weird: true }] }] },
    })

    const [message] = await dmApi.listMessages('company-1', 'channel-1')

    // kachcha data UI tak nahi: undefined, taake store screen wale reactions rakhe
    expect(message.reactions).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('reads message reactions in the backend "message-reaction" shape', async () => {
    const backendReactions = {
      message_id: 'm1',
      reactions: [
        { reaction: { data: '🙃', category: null, aliases: [] }, user_ids: ['user-1', 'user-2'] },
        { reaction: { data: '👍', category: null, aliases: [] }, user_ids: ['user-2'] },
      ],
    }
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: 'm1', body: 'a', 'message-reaction': backendReactions },
          { id: 'm2', body: 'b', reactions: backendReactions },
        ],
      },
    })

    const [a, b] = await dmApi.listMessages('company-1', 'channel-1')

    const expected = [
      { emoji: '🙃', users: ['user-1', 'user-2'] },
      { emoji: '👍', users: ['user-2'] },
    ]
    expect(a.reactions).toEqual(expected)
    expect(b.reactions).toEqual(expected)
  })

  // ---------------- Backend ki asli shapes (status: mode, members: 403) ----------------

  it('reads the user status from "mode" and custom_status', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { user_id: 'user-2', mode: 'online', custom_status: { emoji: '🍔', text: 'Lunch' } },
    })

    await expect(dmApi.getUserStatus('user-2')).resolves.toMatchObject({
      state: 'online',
      status: { emoji: '🍔', text: 'Lunch' },
    })
  })

  it('stops calling company members after a 403 "Only admins" (no more red errors)', async () => {
    apiRequest.mockRejectedValueOnce(
      Object.assign(new Error('Only admins can see company members.'), { status: 403 }),
    )

    await expect(dmApi.listCompanyMembers('company-403')).resolves.toEqual([])
    await expect(dmApi.presence('company-403')).resolves.toEqual({})
    await expect(dmApi.listCompanyMembers('company-403')).resolves.toEqual([])

    expect(apiRequest).toHaveBeenCalledTimes(1) // sirf pehli dafa
  })

  it('still throws other company members errors', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 500 }))

    await expect(dmApi.listCompanyMembers('company-500')).rejects.toThrow('Server error')
  })

  // ---------------- Pagination ----------------

  it('asks for older pages with ?page=N and reads Laravel pagination info', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { current_page: 2, last_page: 3, data: [{ id: 'm1', body: 'old' }] },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1', { page: 2 })

    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/messages?page=2',
    )
    expect(list.map((m) => m.text)).toEqual(['old'])
    expect(list.pagination).toEqual({ page: 2, hasMore: true, lastPage: 3 })
  })

  it('passes a trimmed body query when searching direct-channel messages', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { messages: [{ id: 'm1', body: 'Search result' }] },
    })

    await dmApi.listMessages('company-1', 'channel-1', { page: 2, query: '  search  ' })

    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/messages?page=2&body=search',
    )
  })

  it('says hasMore is unknown when the backend sends no pagination info', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { messages: [{ id: 'm1', body: 'x' }] } })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/direct-channels/channel-1/messages')
    expect(list.pagination).toEqual({ page: 1, hasMore: null, lastPage: null })
  })

  it('reads the backend pagination block (has_more_pages, last_page)', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      message: 'Messages retrieved successfully.',
      data: {
        messages: [],
        pagination: {
          current_page: 1,
          per_page: 15,
          total: 0,
          last_page: 1,
          has_more_pages: false,
        },
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(list).toEqual([])
    expect(list.pagination).toEqual({ page: 1, hasMore: false, lastPage: 1 })
  })

  it('preserves status_mode from status updates and DM participants', async () => {
    apiRequest.mockResolvedValueOnce({
      success: true,
      message: 'Status updated successfully.',
      data: { id: 'user-1', name: 'Aiman Iqbal', custom_status: null, status_mode: 'online' },
    })
    await expect(dmApi.updateUserStatus('user-1', { mode: 'online' })).resolves.toMatchObject({
      state: 'online',
    })
    apiRequest.mockResolvedValueOnce({
      success: true,
      data: { id: 'user-1', status_mode: 'dnd' },
    })
    await expect(dmApi.updateUserStatus('user-1', { mode: 'dnd' })).resolves.toMatchObject({
      state: 'dnd',
    })

    apiRequest.mockResolvedValueOnce({
      success: true,
      data: {
        direct_channels: [
          {
            id: 'c1',
            participants: [
              { id: 'user-1', name: 'Aiman', status_mode: 'online' },
              { id: 'user-2', name: 'Muniba', status_mode: 'offline' },
              { id: 'user-3', name: 'Ali', status_mode: 'dnd' },
            ],
            messages: [],
          },
        ],
      },
    })
    const [{ users }] = await dmApi.listDirectChannels('company-1')
    expect(users.map((u) => [u.name, u.presence])).toEqual([
      ['Aiman', 'online'],
      ['Muniba', 'offline'],
      ['Ali', 'dnd'],
    ])
  })

  it('marks messages forwarded from forwarded_from / is_forwarded', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: 'm1', body: 'a', is_forwarded: true },
          { id: 'm2', body: 'b', forwarded_from: 'Ali in General' },
          { id: 'm3', body: 'c' },
        ],
      },
    })

    const list = await dmApi.listMessages('company-1', 'channel-1')

    expect(list.map((m) => m.forwardedFrom)).toEqual(['forwarded', 'Ali in General', undefined])
  })
})
