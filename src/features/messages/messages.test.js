import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMessagesStore } from './messages'
import { useActivityStore } from '@/stores/activity'

describe('channel messages store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('stores, edits, soft-deletes, and persists channel messages', () => {
    const messages = useMessagesStore()
    const sent = messages.sendMessage('general', { content: 'First version' }, 'You')

    expect(messages.editMessage('general', sent.id, 'Updated message')).toBe(true)
    expect(messages.messagesFor('general')[0]).toMatchObject({
      content: 'Updated message',
      editedAt: expect.any(String),
    })
    expect(JSON.parse(localStorage.getItem('whistleit:channel-messages')).general).toHaveLength(1)

    expect(messages.deleteMessage('general', sent.id)).toBe(true)
    expect(messages.messagesFor('general')).toHaveLength(1)
    expect(sent).toMatchObject({ deleted: true, content: '', deletedAt: expect.any(String) })
    expect(JSON.parse(localStorage.getItem('whistleit:channel-messages')).general[0].deleted).toBe(
      true,
    )
  })

  it('deletes a message at its scheduled time', () => {
    vi.useFakeTimers()
    try {
      const now = new Date('2026-11-03T12:00:00.000Z')
      vi.setSystemTime(now)
      const messages = useMessagesStore()
      const sent = messages.sendMessage('general', { content: 'Delete later' }, 'You')
      const scheduledAt = new Date(now.getTime() + 60_000).toISOString()

      expect(messages.deleteMessage('general', sent.id, scheduledAt)).toBe(true)
      expect(sent).toMatchObject({ content: 'Delete later', deleteScheduledAt: scheduledAt })
      vi.advanceTimersByTime(60_000)

      expect(sent).toMatchObject({ deleted: true, content: '' })
      expect(sent.deleteScheduledAt).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('restores message history from browser storage', () => {
    const messages = useMessagesStore()
    messages.sendMessage('general', { content: 'Keep this history' }, 'You')

    setActivePinia(createPinia())
    const restored = useMessagesStore()
    expect(restored.messagesFor('general')[0].content).toBe('Keep this history')
  })

  it('allows loading older messages in pages', () => {
    const messages = useMessagesStore()
    for (let index = 0; index < 21; index += 1) {
      messages.sendMessage('general', { content: `Message ${index}` }, 'You')
    }

    expect(messages.visibleMessagesFor('general')).toHaveLength(20)
    expect(messages.hasOlderMessages('general')).toBe(true)
    expect(messages.loadOlder('general')).toBe(true)
    expect(messages.visibleMessagesFor('general')).toHaveLength(21)
    expect(messages.hasOlderMessages('general')).toBe(false)
  })

  it('toggles a user reaction without losing other reactions', () => {
    const messages = useMessagesStore()
    const sent = messages.sendMessage('general', { content: 'React to this' }, 'You')

    messages.toggleReaction('general', sent.id, '👍', 'user-1')
    messages.toggleReaction('general', sent.id, '👍', 'user-2')
    expect(sent.reactions).toEqual([{ emoji: '👍', users: ['user-1', 'user-2'] }])

    messages.toggleReaction('general', sent.id, '👍', 'user-1')
    expect(sent.reactions).toEqual([{ emoji: '👍', users: ['user-2'] }])
    messages.toggleReaction('general', sent.id, '👍', 'user-2')
    expect(sent.reactions).toEqual([])
  })

  it('tracks mentions from sent channel messages and cancels scheduled messages', () => {
    const messages = useMessagesStore()
    const activity = useActivityStore()
    const mentioned = messages.sendMessage('general', { content: 'Hi @Aiman' }, 'You', 'General')
    const scheduled = messages.sendMessage('general', {
      content: '@Muniba later',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    })

    expect(activity.sorted[0]).toMatchObject({
      type: 'mention',
      conversationId: 'general',
      conversationName: 'General',
      body: mentioned.content,
    })
    expect(activity.sorted.filter((item) => item.type === 'mention')).toHaveLength(1)
    expect(messages.cancelScheduledMessage('general', scheduled.id)).toBe(true)
    expect(messages.messagesFor('general')).not.toContain(scheduled)
    expect(messages.cancelScheduledMessage('general', scheduled.id)).toBe(false)
  })
})
