import { describe, expect, it } from 'vitest'
import { asList, asObject, normalizeChannel, normalizeMember } from './normalizers'

describe('channel API normalizers', () => {
  it('accepts a channels collection and snake_case backend fields', () => {
    const result = asList({
      success: true,
      data: {
        channels: [
          {
            channel_id: 'channel-1',
            channel_name: 'Announcements',
            channel_type: 'public',
            description: 'Team news',
            member_count: 7,
          },
        ],
      },
    })

    expect(result.items.map(normalizeChannel)).toMatchObject([
      {
        id: 'channel-1',
        name: 'Announcements',
        description: 'Team news',
        isPrivate: false,
        memberCount: 7,
      },
    ])
  })

  it('accepts a wrapped channel detail and recognizes private channel types', () => {
    expect(
      normalizeChannel(
        asObject({
          channel: {
            channel_id: 'channel-2',
            channel_name: 'Leadership',
            type: 'private',
          },
        }),
      ),
    ).toMatchObject({
      id: 'channel-2',
      name: 'Leadership',
      isPrivate: true,
    })
  })

  it('normalizes message permissions and allowed sender IDs', () => {
    expect(
      normalizeChannel({
        id: 'channel-permissions',
        name: 'Permissions',
        message_permission: 'selected_members',
        allowed_sender_ids: ['user-1', { user_id: 'user-2' }],
      }),
    ).toMatchObject({
      messagePermission: 'selected_members',
      allowedSenderIds: ['user-1', 'user-2'],
      messagePermissionConfigured: true,
      allowedSenderIdsConfigured: true,
    })
  })

  it('marks omitted message permission fields as unconfigured', () => {
    expect(normalizeChannel({ id: 'channel-default', name: 'Default' })).toMatchObject({
      messagePermission: 'everyone',
      messagePermissionConfigured: false,
      allowedSenderIdsConfigured: false,
    })
  })

  it('normalizes the backend specific permission mode to selected members', () => {
    expect(
      normalizeChannel({
        id: 'channel-specific',
        name: 'Specific',
        message_permission: 'specific',
        allowed_sender_ids: ['user-1'],
      }),
    ).toMatchObject({
      messagePermission: 'selected_members',
      allowedSenderIds: ['user-1'],
    })
  })

  it('normalizes transferred channel admin IDs and admin flags', () => {
    expect(
      normalizeChannel({
        id: 'channel-admin',
        name: 'Admin channel',
        admin_ids: ['user-1', { user_id: 'user-2' }],
        is_admin: true,
      }),
    ).toMatchObject({
      adminIds: ['user-1', 'user-2'],
      isAdmin: true,
      canManage: true,
    })
  })

  it('does not treat an owner profile object as the current user owning the channel', () => {
    expect(
      normalizeChannel({
        id: 'channel-owner',
        name: 'Owner channel',
        owner: { id: 'creator-1', name: 'Channel Creator' },
      }),
    ).toMatchObject({
      createdById: 'creator-1',
      isOwner: false,
      canManage: false,
    })
  })

  it('does not assume a channel without membership data is joined', () => {
    expect(normalizeChannel({ id: 'channel-4', name: 'Design Reviews' }).isMember).toBe(false)
    expect(normalizeChannel({ id: 'channel-5', name: 'Random', is_member: 'false' }).isMember).toBe(
      false,
    )
  })

  it('normalizes member IDs returned as user_id', () => {
    expect(normalizeMember({ user_id: 'user-42' }).id).toBe('user-42')
  })

  it('normalizes member IDs from primitive and nested user records', () => {
    expect(normalizeMember('user-42').id).toBe('user-42')
    expect(normalizeMember({ id: 'membership-1', user: { id: 'user-42' } }).id).toBe('user-42')
  })

  it('preserves member email from nested account records', () => {
    expect(
      normalizeMember({ user_id: 'user-1', account: { email: 'raw@example.com' } }).email,
    ).toBe('raw@example.com')
    expect(
      normalizeMember({ user: { id: 'user-2', account: { email: 'nested@example.com' } } }).email,
    ).toBe('nested@example.com')
  })

  it('preserves reported member presence and does not invent an offline state', () => {
    expect(normalizeMember({ user_id: 'user-1' }).status).toBeNull()
    expect(normalizeMember({ user_id: 'user-2', user: { presence: 'away' } }).status).toBe('away')
    expect(normalizeMember({ user_id: 'user-3', status: { mode: 'dnd' } }).status).toBe('dnd')
  })

  it('uses joined_by as the user ID for channel membership records', () => {
    expect(
      normalizeMember({
        id: 'membership-1',
        channel_id: 'channel-1',
        joined_by: 'user-42',
      }).id,
    ).toBe('user-42')
  })

  it('rejects channel records without an ID or visible name', () => {
    expect(() => normalizeChannel({ channel_id: 'channel-3' })).toThrow(
      'A channel response is missing its ID or name.',
    )
  })
})
