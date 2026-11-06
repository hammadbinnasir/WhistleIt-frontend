import { describe, expect, it } from 'vitest'
import { addMockMessage, searchMessages, updateMockMessage, removeMockMessage } from './search'

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
