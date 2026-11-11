import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMessagesStore } from './messages'
import { useActivityStore } from '@/stores/activity'
import {
  deleteChannelMessage,
  getChannelMessages,
  sendChannelMessage,
  updateChannelMessage,
} from './channelMessageService'
import { useTeamsStore } from '@/stores/teams'

vi.mock('./channelMessageService', () => ({
  getChannelMessages: vi.fn(),
  sendChannelMessage: vi.fn(),
  updateChannelMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
}))

describe('channel messages store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    getChannelMessages.mockReset()
    sendChannelMessage.mockReset()
    updateChannelMessage.mockReset()
    deleteChannelMessage.mockReset()
  })

  it('loads channel messages from the active company and team', async () => {
    useTeamsStore().activeWorkspaceId = '6ae1b17c18c64b137702b4b6'
    useTeamsStore().activeTeamId = '6ae1b17c18c64b137702b4b7'
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: {
          messages: [
            {
              id: 'message-1',
              body: 'Hello channel',
              sender_id: 'user-2',
              created_at: '2026-11-05T10:00:00Z',
            },
          ],
        },
      },
    })
    const messages = useMessagesStore()

    await expect(messages.fetchChannelMessages('6aeb0aa8fbf9fd02ad07048f')).resolves.toMatchObject({
      success: true,
    })

    expect(getChannelMessages).toHaveBeenCalledWith(
      '6ae1b17c18c64b137702b4b6',
      '6ae1b17c18c64b137702b4b7',
      '6aeb0aa8fbf9fd02ad07048f',
      { page: 1, perPage: 15 },
    )
    expect(messages.messagesFor('6aeb0aa8fbf9fd02ad07048f')[0]).toMatchObject({
      id: 'message-1',
      content: 'Hello channel',
      from: 'user-2',
      createdAt: '2026-11-05T10:00:00Z',
      backendSynced: true,
    })
    expect(messages.loadingByChannel['6aeb0aa8fbf9fd02ad07048f']).toBe(false)
    expect(messages.errorsByChannel['6aeb0aa8fbf9fd02ad07048f']).toBe('')
  })

  it('normalizes the backend singular attachment field on fetched messages', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    const attachment = {
      id: 'file-1',
      name: 'men.jpg',
      mime_type: 'image/jpeg',
      path: 'messages/channel-1/men.jpg',
    }
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [{ id: 'message-1', body: 'Photo', attachment: [attachment] }],
      },
    })
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')

    expect(messages.messagesFor('channel-1')[0].attachments).toEqual([attachment])
  })

  it('renders server soft-deleted messages, including messages outside the latest page', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'deleted-old-message',
            body: 'Removed by sender',
            sender_id: 'user-2',
            is_deleted: true,
            created_at: '2026-11-05T09:00:00Z',
          },
          ...Array.from({ length: 20 }, (_, index) => ({
            id: `message-${index}`,
            body: `Message ${index}`,
            sender_id: 'user-2',
            is_deleted: false,
            created_at: `2026-11-05T10:${String(index).padStart(2, '0')}:00Z`,
          })),
        ],
      },
    })
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')

    expect(messages.visibleMessagesFor('channel-1')).toHaveLength(21)
    expect(messages.visibleMessagesFor('channel-1')[0]).toMatchObject({
      id: 'deleted-old-message',
      deleted: true,
      content: '',
    })
  })

  it('does not treat a string false deletion flag as deleted', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [{ id: 'message-1', body: 'Keep visible', is_deleted: 'false' }],
      },
    })
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')

    expect(messages.messagesFor('channel-1')[0]).toMatchObject({
      content: 'Keep visible',
      deleted: false,
    })
  })

  it('removes API paragraph wrappers from channel message bodies', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    getChannelMessages.mockResolvedValue({
      success: true,
      data: { messages: [{ id: 'message-1', body: '<p>byeee</p>' }] },
    })
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')

    expect(messages.messagesFor('channel-1')[0]).toMatchObject({
      content: 'byeee',
      text: 'byeee',
    })
  })

  it('loads older API pages and preserves them when the latest page refreshes', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    const makeMessages = (start, end) =>
      Array.from({ length: end - start + 1 }, (_, index) => {
        const sequence = start + index
        return {
          id: `message-${sequence}`,
          body: `Message ${sequence}`,
          created_at: new Date(Date.UTC(2026, 10, 6, 10, sequence)).toISOString(),
        }
      })
    const response = (records, currentPage) => ({
      success: true,
      data: {
        messages: records,
        pagination: {
          current_page: currentPage,
          per_page: 15,
          total: 30,
          last_page: 2,
          has_more_pages: currentPage < 2,
        },
      },
    })
    getChannelMessages
      .mockResolvedValueOnce(response(makeMessages(15, 29), 1))
      .mockResolvedValueOnce(response(makeMessages(0, 14), 2))
      .mockResolvedValueOnce(response(makeMessages(16, 30), 1))
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')
    expect(messages.hasOlderMessages('channel-1')).toBe(true)
    await expect(messages.loadOlder('channel-1')).resolves.toBe(true)
    expect(getChannelMessages).toHaveBeenNthCalledWith(2, 'company-1', 'team-1', 'channel-1', {
      page: 2,
      perPage: 15,
    })
    expect(messages.messagesFor('channel-1')).toHaveLength(30)
    expect(messages.hasOlderMessages('channel-1')).toBe(false)

    await messages.fetchChannelMessages('channel-1')
    expect(messages.messagesFor('channel-1')).toHaveLength(31)
    expect(messages.messagesFor('channel-1').some((message) => message.id === 'message-0')).toBe(
      true,
    )
    expect(messages.messagesFor('channel-1').at(-1).id).toBe('message-30')
  })

  it('records channel message request errors for the UI', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    getChannelMessages.mockResolvedValue({
      success: false,
      error: 'Your login session is missing. Please sign in again.',
    })
    const messages = useMessagesStore()

    await expect(messages.fetchChannelMessages('channel-1')).resolves.toEqual({
      success: false,
      error: 'Your login session is missing. Please sign in again.',
    })
    expect(messages.errorsByChannel['channel-1']).toBe(
      'Your login session is missing. Please sign in again.',
    )
    expect(messages.loadingByChannel['channel-1']).toBe(false)
  })

  it('updates a server-backed channel message through the API', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    updateChannelMessage.mockResolvedValue({ success: true, data: {} })
    const messages = useMessagesStore()
    messages.messagesByChannel['channel-1'] = [
      { id: 'server-message-1', content: 'Before', mine: true, serverBacked: true },
    ]

    await expect(
      messages.updateServerMessage('channel-1', 'server-message-1', ' After '),
    ).resolves.toMatchObject({ success: true })

    expect(updateChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'channel-1',
      'server-message-1',
      { content: 'After' },
    )
    expect(messages.messagesFor('channel-1')[0]).toMatchObject({
      content: 'After',
      editedAt: expect.any(String),
    })
  })

  it('does not change a server-backed message when the update API fails', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    updateChannelMessage.mockResolvedValue({ success: false, error: 'Update failed' })
    const messages = useMessagesStore()
    messages.messagesByChannel['channel-1'] = [
      { id: 'server-message-1', content: 'Before', mine: true, serverBacked: true },
    ]

    await expect(
      messages.updateServerMessage('channel-1', 'server-message-1', 'After'),
    ).resolves.toEqual({ success: false, error: 'Update failed' })
    expect(messages.messagesFor('channel-1')[0].content).toBe('Before')
  })

  it('deletes a server-backed message through the API and keeps its tombstone on refresh', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    deleteChannelMessage.mockResolvedValue({ success: true, data: null })
    getChannelMessages.mockResolvedValue({
      success: true,
      data: { messages: [{ id: 'server-message-1', body: 'Old message', sender_id: 'user-1' }] },
    })
    const messages = useMessagesStore()
    messages.messagesByChannel['channel-1'] = [
      {
        id: 'server-message-1',
        content: 'Old message',
        text: 'Old message',
        mine: true,
        serverBacked: true,
      },
    ]

    await expect(
      messages.deleteServerMessage('channel-1', 'server-message-1'),
    ).resolves.toMatchObject({
      success: true,
    })

    expect(deleteChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'channel-1',
      'server-message-1',
      'Old message',
    )
    expect(messages.messagesFor('channel-1')[0]).toMatchObject({
      deleted: true,
      content: '',
    })

    await messages.fetchChannelMessages('channel-1')
    expect(messages.messagesFor('channel-1')).toHaveLength(1)
    expect(messages.messagesFor('channel-1')[0]).toMatchObject({
      id: 'server-message-1',
      deleted: true,
      content: '',
    })
  })

  it('shows a server-backed message as deleted before the delete API responds', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    let resolveDelete
    deleteChannelMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve
        }),
    )
    const messages = useMessagesStore()
    messages.messagesByChannel['channel-1'] = [
      { id: 'server-message-1', content: 'Delete now', mine: true, serverBacked: true },
    ]

    const deletion = messages.deleteServerMessage('channel-1', 'server-message-1')
    expect(messages.messagesFor('channel-1')[0]).toMatchObject({
      deleted: true,
      content: '',
    })

    resolveDelete({ success: true, data: null })
    await expect(deletion).resolves.toMatchObject({ success: true })
  })

  it('does not mark a server-backed message deleted when the API fails', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    deleteChannelMessage.mockResolvedValue({ success: false, error: 'Delete failed' })
    const messages = useMessagesStore()
    messages.messagesByChannel['channel-1'] = [
      { id: 'server-message-1', content: 'Keep this', mine: true, serverBacked: true },
    ]

    await expect(messages.deleteServerMessage('channel-1', 'server-message-1')).resolves.toEqual({
      success: false,
      error: 'Delete failed',
    })
    expect(messages.messagesFor('channel-1')[0].content).toBe('Keep this')
    expect(messages.messagesFor('channel-1')[0]).not.toHaveProperty('deleted')
  })

  it('does not request channel messages without an active company and team', async () => {
    const messages = useMessagesStore()

    await expect(messages.fetchChannelMessages('channel-1')).resolves.toMatchObject({
      success: false,
    })
    expect(getChannelMessages).not.toHaveBeenCalled()
  })

  it('syncs optimistic channel messages using the active team endpoint', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    sendChannelMessage.mockResolvedValue({
      success: true,
      data: { message: { id: 'saved-reply-parent', body: 'Thread parent', created_at: 'T1' } },
    })
    const messages = useMessagesStore()

    const sent = messages.sendMessage(
      'channel-1',
      { content: 'Thread parent', replyTo: { id: 'original-message' } },
      'You',
    )

    await vi.waitFor(() =>
      expect(messages.messagesFor('channel-1')[0]).toMatchObject({
        id: 'saved-reply-parent',
        backendSynced: true,
        serverBacked: true,
      }),
    )
    expect(sendChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'channel-1',
      { content: 'Thread parent', parentMessageId: 'original-message' },
    )
    expect(sent.id).toBe('saved-reply-parent')
  })

  it('sends forwarded channel messages through the API and preserves their origin', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    sendChannelMessage.mockResolvedValue({
      success: true,
      data: { message: { id: 'forwarded-1', body: 'Hello', sender_id: 'user-1' } },
    })
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [{ id: 'forwarded-1', body: 'Hello', sender_id: 'user-1' }],
      },
    })
    const messages = useMessagesStore()

    await expect(
      messages.postChannelMessage('channel-2', {
        content: 'Hello',
        forwardedFrom: 'Aiman in General',
      }),
    ).resolves.toMatchObject({ success: true })

    expect(sendChannelMessage).toHaveBeenCalledWith('company-1', 'team-1', 'channel-2', {
      content: 'Hello',
      forwardedFrom: 'Aiman in General',
    })
    expect(messages.messagesFor('channel-2')).toContainEqual(
      expect.objectContaining({
        id: 'forwarded-1',
        content: 'Hello',
        forwardedFrom: 'Aiman in General',
        serverBacked: true,
      }),
    )
  })

  it('keeps the selected attachment visible when the successful response has no attachments', async () => {
    useTeamsStore().activeWorkspaceId = 'company-1'
    useTeamsStore().activeTeamId = 'team-1'
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })
    sendChannelMessage.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: 'message-with-unconfirmed-attachment',
          body: 'Please review',
          attachments: [],
        },
      },
    })
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'message-with-unconfirmed-attachment',
            body: 'Please review',
            attachments: [],
          },
        ],
      },
    })
    const messages = useMessagesStore()

    await expect(
      messages.postChannelMessage('channel-2', {
        content: 'Please review',
        attachment,
      }),
    ).resolves.toMatchObject({
      success: true,
      attachmentPersisted: false,
    })

    expect(messages.messagesFor('channel-2')).toContainEqual(
      expect.objectContaining({
        id: 'message-with-unconfirmed-attachment',
        attachments: [
          {
            name: 'report.txt',
            size: 6,
            type: 'text/plain',
            localOnly: true,
            localPreviewUrl: expect.stringMatching(/^blob:/),
          },
        ],
      }),
    )
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

  it('merges received channel messages while preserving locally sent voice notes', () => {
    const messages = useMessagesStore()
    messages.sendMessage(
      'engineering',
      { content: '', voiceNoteId: 'voice-note-local' },
      'You',
      'Engineering',
    )
    messages.mergeChannelMessages('engineering', [
      {
        id: 'server-message-1',
        content: 'Incoming voice',
        voiceNoteId: 'voice-note-remote',
        createdAt: '2026-11-05T10:00:00Z',
        mine: false,
      },
    ])

    expect(messages.messagesFor('engineering')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ voiceNoteId: 'voice-note-local', mine: true }),
        expect.objectContaining({ id: 'server-message-1', voiceNoteId: 'voice-note-remote' }),
      ]),
    )
    expect(JSON.parse(localStorage.getItem('whistleit:channel-messages')).engineering).toHaveLength(
      2,
    )
  })

  it('normalizes voice-note IDs from wrapped channel message records', async () => {
    const teams = useTeamsStore()
    teams.activeWorkspaceId = 'company-1'
    teams.activeTeamId = 'team-1'
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            message: {
              id: 'wrapped-voice',
              sender_id: 'user-2',
              body: 'Voice message',
            },
            voice_note: { voice_note_id: 'voice-note-wrapped' },
          },
        ],
      },
    })
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')

    expect(messages.messagesFor('channel-1')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'wrapped-voice',
          voiceNoteId: 'voice-note-wrapped',
          content: 'Voice message',
        }),
      ]),
    )
  })

  it('finds a voice-note ID in nested channel message response metadata', async () => {
    const teams = useTeamsStore()
    teams.activeWorkspaceId = 'company-1'
    teams.activeTeamId = 'team-1'
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'received-voice',
            sender_id: 'other-user',
            body: 'Voice message',
            sender: { voice_note: { id: 'voice-note-from-api' } },
          },
        ],
      },
    })
    const messages = useMessagesStore()

    await messages.fetchChannelMessages('channel-1')

    expect(messages.messagesFor('channel-1')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'received-voice',
          voiceNoteId: 'voice-note-from-api',
          content: 'Voice message',
          mine: false,
        }),
      ]),
    )
  })

  it('preserves a sent voice-note ID when a channel refresh omits it', () => {
    const messages = useMessagesStore()
    messages.sendMessage(
      'engineering',
      { id: 'server-message-1', content: 'Voice message', voiceNoteId: 'voice-note-1' },
      'You',
      'Engineering',
    )

    messages.mergeChannelMessages('engineering', [
      {
        id: 'server-message-1',
        content: 'Voice message',
        voiceNoteId: undefined,
        createdAt: new Date().toISOString(),
        mine: true,
      },
    ])

    expect(messages.messagesFor('engineering')).toHaveLength(1)
    expect(messages.messagesFor('engineering')[0]).toMatchObject({
      id: 'server-message-1',
      voiceNoteId: 'voice-note-1',
      content: 'Voice message',
    })
  })

  it('preserves the voice player when a fetched channel message omits the voice-note ID', async () => {
    const teams = useTeamsStore()
    teams.activeWorkspaceId = 'company-1'
    teams.activeTeamId = 'team-1'
    const messages = useMessagesStore()
    messages.sendMessage(
      'engineering',
      {
        id: 'server-voice-message',
        content: 'Voice message',
        voiceNoteId: 'voice-note-1',
        backendSynced: true,
        createdAt: '2026-11-06T10:00:00.000Z',
      },
      'You',
      'Engineering',
    )
    getChannelMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'server-voice-message',
            body: 'Voice message',
            sender_id: 'user-1',
            created_at: '2026-11-06T10:00:00.000Z',
          },
        ],
      },
    })

    await messages.fetchChannelMessages('engineering')

    expect(messages.messagesFor('engineering')).toHaveLength(1)
    expect(messages.messagesFor('engineering')[0]).toMatchObject({
      id: 'server-voice-message',
      voiceNoteId: 'voice-note-1',
      content: 'Voice message',
    })
  })

  it('reconciles an echoed voice message when the server omits its voice-note ID', () => {
    const messages = useMessagesStore()
    messages.sendMessage(
      'engineering',
      {
        id: 'local-message',
        content: 'Voice message',
        voiceNoteId: 'voice-note-1',
        createdAt: '2026-11-06T10:00:00.000Z',
      },
      'You',
      'Engineering',
    )

    messages.mergeChannelMessages('engineering', [
      {
        id: 'server-message',
        content: 'Voice message',
        createdAt: '2026-11-06T10:00:04.000Z',
        mine: true,
      },
    ])

    expect(messages.messagesFor('engineering')).toHaveLength(1)
    expect(messages.messagesFor('engineering')[0]).toMatchObject({
      id: 'server-message',
      voiceNoteId: 'voice-note-1',
    })
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

  it('allows loading older messages in pages', async () => {
    const messages = useMessagesStore()
    for (let index = 0; index < 21; index += 1) {
      messages.sendMessage('general', { content: `Message ${index}` }, 'You')
    }

    expect(messages.visibleMessagesFor('general')).toHaveLength(20)
    expect(messages.hasOlderMessages('general')).toBe(true)
    await expect(messages.loadOlder('general')).resolves.toBe(true)
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
