import { describe, expect, it } from 'vitest'
import { asList, asObject, normalizeChannel } from './normalizers'

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
      normalizeChannel(asObject({
        channel: {
          channel_id: 'channel-2',
          channel_name: 'Leadership',
          type: 'private',
        },
      })),
    ).toMatchObject({
      id: 'channel-2',
      name: 'Leadership',
      isPrivate: true,
    })
  })

  it('rejects channel records without an ID or visible name', () => {
    expect(() => normalizeChannel({ channel_id: 'channel-3' })).toThrow(
      'A channel response is missing its ID or name.',
    )
  })
})
