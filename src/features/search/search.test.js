import { describe, expect, it } from 'vitest'
import {
  addMockMessage,
  searchFiles,
  searchLinks,
  searchMessages,
  updateMockMessage,
  removeMockMessage,
} from './search'

describe('search date filters', () => {
  it('filters messages before and after a selected date', async () => {
    addMockMessage({
      id: 'dated-message',
      text: 'Dated test message',
      sender: 'Test User',
      createdAt: '2026-10-21T08:30:00Z',
    })
    const before = await searchMessages({ date: '2026-10-22', dateMode: 'before' })
    const after = await searchMessages({ date: '2026-10-20', dateMode: 'after' })

    expect(before.items).toHaveLength(1)
    expect(after.items).toHaveLength(1)
  })

  it('filters messages within an inclusive date range', async () => {
    const result = await searchMessages({
      date: '2026-10-21',
      dateEnd: '2026-10-21',
      dateMode: 'range',
    })

    expect(result.items).toHaveLength(1)
  })
})

describe('persisted channel messages', () => {
  it('finds channel attachments by file name and returns image metadata', async () => {
    const result = await searchFiles({
      q: 'team-photo',
      channelId: 'live-channel',
      channelMessages: [
        {
          id: 'channel-file-message',
          text: 'Here is the team photo',
          sender: 'Channel User',
          userId: 'user-5',
          createdAt: '2026-11-05T10:00:00.000Z',
          attachments: [
            {
              id: 'photo-1',
              name: 'team-photo.jpg',
              mime_type: 'image/jpeg',
              file_url: 'https://files.example.com/team-photo.jpg',
            },
          ],
          conversation: { id: 'live-channel', name: 'Live Channel', kind: 'public' },
        },
        {
          id: 'other-channel-file-message',
          attachments: [{ id: 'photo-2', name: 'team-photo.png', type: 'image/png' }],
          conversation: { id: 'another-channel', name: 'Another Channel', kind: 'public' },
        },
      ],
    })

    expect(result.items).toMatchObject([
      {
        id: 'channel-file-message-photo-1',
        messageId: 'channel-file-message',
        name: 'team-photo.jpg',
        type: 'image',
        url: 'https://files.example.com/team-photo.jpg',
        sharedBy: 'Channel User',
        conversation: { id: 'live-channel', name: 'Live Channel' },
      },
    ])
    expect(result.total).toBe(1)
  })

  it('finds file and image attachments in direct messages', async () => {
    const result = await searchFiles({
      q: 'invoice',
      dmConversationId: 'dm-1',
      dmMessages: [
        {
          id: 'dm-file-message',
          sender: 'DM User',
          userId: 'user-8',
          attachments: [{ attachment_id: 'doc-1', file_name: 'invoice.pdf' }],
          conversation: { id: 'dm-1', name: 'DM User', kind: 'dm' },
        },
        {
          id: 'other-dm-file-message',
          attachments: [{ id: 'doc-2', name: 'invoice.pdf' }],
          conversation: { id: 'dm-2', name: 'Other User', kind: 'dm' },
        },
      ],
    })

    expect(result.items).toMatchObject([
      {
        messageId: 'dm-file-message',
        name: 'invoice.pdf',
        type: 'pdf',
        sharedBy: 'DM User',
        conversation: { id: 'dm-1', kind: 'dm' },
      },
    ])
    expect(result.total).toBe(1)
  })

  it('searches server-loaded messages supplied for the current channel', async () => {
    const result = await searchMessages({
      q: 'server loaded search',
      channelId: 'live-channel',
      channelMessages: [
        {
          id: 'live-message',
          text: 'Server loaded search result',
          sender: 'Channel User',
          userId: 'user-3',
          createdAt: '2026-11-05T10:00:00.000Z',
          conversation: {
            id: 'live-channel',
            name: 'Live Channel',
            kind: 'public',
          },
        },
        {
          id: 'other-live-message',
          text: 'Server loaded search result',
          conversation: { id: 'another-channel', name: 'Another Channel', kind: 'public' },
        },
      ],
    })

    expect(result.items).toMatchObject([
      {
        id: 'live-message',
        text: 'Server loaded search result',
        conversation: { id: 'live-channel', name: 'Live Channel' },
      },
    ])
  })

  it('finds links in server-loaded messages for the current channel', async () => {
    const result = await searchLinks({
      q: 'release-notes',
      channelId: 'live-channel',
      channelMessages: [
        {
          id: 'live-channel-link',
          text: 'Read https://example.com/release-notes',
          sender: 'Channel User',
          userId: 'user-4',
          createdAt: '2026-11-05T10:00:00.000Z',
          conversation: {
            id: 'live-channel',
            name: 'Live Channel',
            kind: 'public',
          },
        },
        {
          id: 'other-channel-link',
          text: 'https://example.com/release-notes',
          conversation: { id: 'another-channel', name: 'Another Channel', kind: 'public' },
        },
      ],
    })

    expect(result.items).toMatchObject([
      {
        id: 'live-channel-link',
        url: 'https://example.com/release-notes',
        sender: 'Channel User',
        conversation: { id: 'live-channel', name: 'Live Channel' },
      },
    ])
    expect(result.total).toBe(1)
  })

  it('finds channel messages after browser storage is restored', async () => {
    localStorage.setItem(
      'whistleit:channel-messages',
      JSON.stringify({
        general: [
          {
            id: 'persisted-message',
            content: 'Persistent search text',
            author: 'Test User',
            authorId: 'user-1',
            createdAt: '2026-11-05T10:00:00.000Z',
          },
        ],
      }),
    )

    const result = await searchMessages({
      q: 'Persistent search',
      channelId: 'general',
    })

    expect(result.items.map((item) => item.id)).toContain('persisted-message')
  })

  it('finds links in persisted channel messages with conversation and sender details', async () => {
    localStorage.setItem(
      'whistleit:channel-messages',
      JSON.stringify({
        general: [
          {
            id: 'channel-link',
            content: 'Check this https://example.com/shared.',
            author: 'Channel User',
            authorId: 'user-2',
            createdAt: '2026-11-05T10:00:00.000Z',
          },
        ],
        other: [
          {
            id: 'other-link',
            content: 'https://other.example/path',
            author: 'Other User',
            createdAt: '2026-11-05T10:00:00.000Z',
          },
        ],
      }),
    )

    const result = await searchLinks({ channelId: 'general' })

    expect(result.items).toMatchObject([
      {
        id: 'channel-link',
        url: 'https://example.com/shared',
        sender: 'Channel User',
        userId: 'user-2',
        conversation: { id: 'general' },
      },
    ])
    expect(result.total).toBe(1)
  })

  it('finds links in direct-message results and applies the search query', async () => {
    const result = await searchLinks({
      q: 'localhost',
      dmConversationId: 'dm-1',
      dmMessages: [
        {
          id: 'dm-link',
          text: 'http://localhost:5173/app/shared',
          sender: 'DM User',
          userId: 'user-3',
          createdAt: '2026-11-05T10:00:00.000Z',
          conversation: { id: 'dm-1', name: 'DM User', kind: 'dm' },
        },
        {
          id: 'other-dm-link',
          text: 'https://example.com',
          conversation: { id: 'dm-2', kind: 'dm' },
        },
      ],
    })

    expect(result.items).toMatchObject([
      {
        id: 'dm-link',
        url: 'http://localhost:5173/app/shared',
        sender: 'DM User',
        conversation: { id: 'dm-1', kind: 'dm' },
      },
    ])
    expect(result.total).toBe(1)
  })

  it('reflects in-memory edits and deletions', async () => {
    addMockMessage({ id: 'mutable-message', text: 'Original text' })
    updateMockMessage('mutable-message', 'Edited text')

    const edited = await searchMessages({ q: 'Edited text' })
    expect(edited.items.map((item) => item.id)).toContain('mutable-message')

    removeMockMessage('mutable-message')
    const deleted = await searchMessages({ q: 'Edited text' })
    expect(deleted.items.map((item) => item.id)).not.toContain('mutable-message')
  })
})
