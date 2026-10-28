import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMessagesStore } from './messages'

describe('messages store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('paginates older history and appends new messages', () => {
    const store = useMessagesStore()

    expect(store.visibleMessagesFor('general')).toHaveLength(5)
    expect(store.hasOlderMessages('general')).toBe(true)
    store.loadOlder('general')
    expect(store.visibleMessagesFor('general')).toHaveLength(8)
    expect(store.hasOlderMessages('general')).toBe(false)

    store.sendMessage('general', '  A new message  ')
    expect(store.messagesFor('general').at(-1).content).toBe('A new message')
  })

  it('migrates saved current-user names to the configured profile name', () => {
    localStorage.setItem(
      'whistleit.messages.v1',
      JSON.stringify({
        currentUserName: 'Muniba',
        visibleCounts: {},
        messagesByChannel: {
          general: [
            {
              id: 'legacy-message',
              author: 'Muniba',
              content: 'Previously sent',
              createdAt: new Date().toISOString(),
              reactions: { '👍': ['Muniba'] },
              pinned: false,
            },
          ],
        },
      }),
    )

    const store = useMessagesStore()
    const [message] = store.messagesFor('general')

    expect(store.currentUserName).toBe('Muniba')
    expect(message.author).toBe('Muniba')
    expect(message.authorId).toBe('current-user')
    expect(message.reactions['👍']).toEqual(['Muniba'])
  })

  it('supports edit, delete, reactions, and pins and persists changes', () => {
    const store = useMessagesStore()
    const messageId = store.messagesFor('general').at(-1).id

    store.editMessage('general', messageId, 'Updated content')
    store.toggleReaction('general', messageId, '👍')
    store.togglePin('general', messageId)
    store.setReminder('general', messageId, '2026-10-27T10:00:00.000Z', 'Follow up')

    const updated = store.messagesFor('general').at(-1)
    expect(updated.content).toBe('Updated content')
    expect(updated.reactions['👍']).toEqual(['Muniba'])
    expect(updated.pinned).toBe(true)
    expect(updated.reminderAt).toBe('2026-10-27T10:00:00.000Z')
    expect(updated.reminderTitle).toBe('Follow up')
    expect(
      JSON.parse(localStorage.getItem('whistleit.messages.v1')).messagesByChannel.general.at(-1),
    ).toMatchObject({
      content: 'Updated content',
      pinned: true,
    })

    store.toggleReaction('general', messageId, '👍')
    expect(store.messagesFor('general').at(-1).reactions).toEqual({})
    store.togglePin('general', messageId)
    expect(store.messagesFor('general').at(-1).pinned).toBe(false)
    store.deleteMessage('general', messageId)
    expect(store.messagesFor('general').some(({ id }) => id === messageId)).toBe(false)
  })
})
