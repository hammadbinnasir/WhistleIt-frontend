import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMessagesStore } from './messages'
import { useActivityStore } from '@/stores/activity'

describe('channel messages store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('stores, edits, deletes, and persists channel messages', () => {
    const messages = useMessagesStore()
    const sent = messages.sendMessage('general', { content: 'First version' }, 'You')

    expect(messages.editMessage('general', sent.id, 'Updated message')).toBe(true)
    expect(messages.messagesFor('general')[0]).toMatchObject({
      content: 'Updated message',
      editedAt: expect.any(String),
    })
    expect(JSON.parse(localStorage.getItem('whistleit:channel-messages')).general).toHaveLength(1)

    expect(messages.deleteMessage('general', sent.id)).toBe(true)
    expect(messages.messagesFor('general')).toHaveLength(0)
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
