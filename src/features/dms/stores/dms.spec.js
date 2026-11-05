import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'),
    listDirectChannels: vi.fn(),
    listCompanyMembers: vi.fn(),
    listTeamMembers: vi.fn(),
    listTeamNonMembers: vi.fn(),
    getDirectChannel: vi.fn(),
    createDirectChannel: vi.fn(),
    listMessages: vi.fn(),
    getMessage: vi.fn(),
    sendMessage: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}))

import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from './dms'
import { useTeamsStore } from '@/stores/teams'

function makeConversation(id, userId, messages = []) {
  return {
    conversation: {
      id,
      type: 'dm',
      members: ['u1', userId],
      name: '',
      unreadCount: 0,
      isFavorite: false,
      messages,
    },
    users: [
      { id: 'u1', name: 'Current user', avatarUrl: '' },
      { id: userId, name: `User ${userId}`, avatarUrl: '' },
    ],
  }
}

describe('dms store', () => {
  beforeEach(() => {
    // localStorage.removeItem('whistleit:dm-messages')
    localStorage.clear()
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    vi.clearAllMocks()
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [
        { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      ]),
    ])
    dmApi.listCompanyMembers.mockResolvedValue([])
    dmApi.listTeamMembers.mockResolvedValue([])
    dmApi.listTeamNonMembers.mockResolvedValue([])
    dmApi.getDirectChannel.mockImplementation(async (_companyId, channelId) =>
      makeConversation(String(channelId), channelId === 'created-channel' ? 'u3' : 'u2', [
        { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      ]),
    )
    dmApi.createDirectChannel.mockImplementation(async (_companyId, payload) =>
      makeConversation('created-channel', payload.user_id),
    )
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
    ])
    dmApi.getMessage.mockResolvedValue(null)
    dmApi.sendMessage.mockImplementation(async (_companyId, _channelId, payload) => ({
      id: 'server-1',
      from: 'u1',
      text: payload.body, // store text "body" mein bhejta hai
      createdAt: new Date().toISOString(),
    }))
    dmApi.updateMessage.mockResolvedValue(null)
    dmApi.deleteMessage.mockResolvedValue(null)
  })

  it('loads live conversations using the active company ID', async () => {
    const dms = useDmStore()

    await dms.init()

    expect(dms.error).toBe('')
    expect(dms.meId).toBe('u1')
    expect(dms.usersById.u2.name).toBe('User u2')
    expect(dms.sorted).toHaveLength(1)
    expect(dmApi.listDirectChannels).toHaveBeenCalledWith('company-1')
  })

  it('loads company members and makes them available by user ID', async () => {
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'company-user-1', name: 'Company User', email: 'user@example.com', avatarUrl: '' },
    ])
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(dmApi.listCompanyMembers).toHaveBeenCalledWith('company-1')
    expect(dms.usersById['company-user-1']).toMatchObject({
      name: 'Company User',
      email: 'user@example.com',
    })
    expect(dms.companyMembersError).toBe('')
  })

  it('combines company and team member lists for DM search', async () => {
    useTeamsStore().teamsByWorkspaceId = {
      'company-1': [{ id: 'team-1' }, { id: 'team-2' }],
    }
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'u1', name: 'Current user', email: '', avatarUrl: '' },
    ])
    dmApi.listTeamMembers.mockImplementation(async (teamId) =>
      teamId === 'team-1'
        ? [{ id: 'u2', name: 'Muniba Khan', email: '', avatarUrl: '' }]
        : [{ id: 'u3', name: 'Taha Jawad', email: '', avatarUrl: '' }],
    )
    dmApi.listTeamNonMembers.mockImplementation(async (companyId, teamId) =>
      teamId === 'team-1' ? [{ id: 'u4', name: 'Available User', email: '', avatarUrl: '' }] : [],
    )
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('team-1')
    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('team-2')
    expect(dmApi.listTeamNonMembers).toHaveBeenCalledWith('company-1', 'team-1')
    expect(dmApi.listTeamNonMembers).toHaveBeenCalledWith('company-1', 'team-2')
    expect(dms.companyMembers.map((user) => user.name)).toEqual([
      'Current user',
      'Muniba Khan',
      'Taha Jawad',
      'Available User',
    ])
  })

  it('fetches workspace teams before requesting their members when the list is empty', async () => {
    const teams = useTeamsStore()
    teams.teamsByWorkspaceId = {}
    teams.fetchTeams = vi.fn(async () => {
      teams.teamsByWorkspaceId = {
        'company-1': [{ id: 'team-loaded' }],
      }
      return teams.teams
    })
    dmApi.listTeamMembers.mockResolvedValue([
      { id: 'u2', name: 'Muniba Khan', email: '', avatarUrl: '' },
    ])
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(teams.fetchTeams).toHaveBeenCalledWith('company-1')
    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('team-loaded')
    expect(dms.companyMembers.map((user) => user.name)).toContain('Muniba Khan')
  })

  it('starts the company members request while workspace teams are still loading', async () => {
    const teams = useTeamsStore()
    teams.teamsByWorkspaceId = {}
    let resolveTeams
    teams.fetchTeams = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveTeams = resolve
        }),
    )
    const dms = useDmStore()

    const loading = dms.loadCompanyMembers()
    await vi.waitFor(() => {
      expect(dmApi.listCompanyMembers).toHaveBeenCalledWith('company-1')
    })

    resolveTeams([])
    await loading
  })

  it('opens existing DMs and creates new DMs through the API', async () => {
    const dms = useDmStore()
    await dms.init()

    const existing = await dms.startDm('u2')
    expect(existing.id).toBe('c1')
    expect(dms.activeId).toBe('c1')
    expect(dmApi.createDirectChannel).not.toHaveBeenCalled()
    expect(dmApi.getDirectChannel).not.toHaveBeenCalled()

    const created = await dms.startDm('u3')
    expect(created.id).toBe('created-channel')
    expect(created.members).toContain('u3')
    expect(dms.activeId).toBe('created-channel')
    expect(dmApi.createDirectChannel).toHaveBeenCalledWith('company-1', {
      user_id: 'u3',
    })
    expect(dmApi.getDirectChannel).not.toHaveBeenCalled()
  })

  it('keeps messages from the DM list without issuing a failing detail request', async () => {
    dmApi.getDirectChannel.mockRejectedValue(new Error('Failed to fetch'))
    const dms = useDmStore()
    await dms.init()

    expect(dms.openConversation('c1')).toBe(true)
    await Promise.resolve()

    expect(dmApi.getDirectChannel).not.toHaveBeenCalled()
    expect(dms.conversations[0].messages[0].text).toBe('Received')
    expect(dms.detailError).toBe('')
  })

  it('loads details for an existing conversation with no messages yet', async () => {
    dmApi.listDirectChannels.mockResolvedValue([makeConversation('empty-dm', 'u2')])
    const dms = useDmStore()
    await dms.init()

    expect(dms.openConversation('empty-dm')).toBe(true)
    await vi.waitFor(() => {
      expect(dmApi.getDirectChannel).toHaveBeenCalledWith('company-1', 'empty-dm')
      expect(dms.conversations[0].messages).toHaveLength(1)
    })
  })

  it('restores an unsent DM message as failed after the conversation store is reloaded', async () => {
    dmApi.sendMessage.mockImplementation(() => new Promise(() => {})) // reload se pehle jawab nahi aaya
    // har request par naya data (asli server ki tarah), taake pehle store ki tabdeeli na aaye
    dmApi.listDirectChannels.mockImplementation(async () => [
      makeConversation('c1', 'u2', [
        { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      ]),
    ])
    const dms = useDmStore()
    await dms.init()

    const sent = dms.sendMessage('c1', { content: 'Keep this direct message' })
    expect(sent.id).toMatch(/^local-/)
    expect(
      JSON.parse(localStorage.getItem('whistleit:dm-messages'))['company-1']['c1'],
    ).toContainEqual(expect.objectContaining({ id: sent.id, status: 'sending' }))

    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    const reloadedDms = useDmStore()
    await reloadedDms.init()

    expect(reloadedDms.conversations[0].messages).toContainEqual(
      expect.objectContaining({
        id: sent.id,
        text: 'Keep this direct message',
        status: 'failed',
        error: 'Not sent',
      }),
    )
  })

  it('loads details from the API when a conversation opens', async () => {
    const dms = useDmStore()
    await dms.init()

    expect(dms.openConversation('c1')).toBe(true)
    await vi.waitFor(() => {
      expect(dms.conversations[0].messages[0].text).toBe('Received')
    })
    expect(dms.openConversation('missing')).toBe(false)
  })

  it('toggles a favorite for a direct message conversation', async () => {
    const dms = useDmStore()
    await dms.init()

    expect(dms.isFavorite('c1')).toBe(false)
    expect(dms.toggleFavorite('c1')).toBe(true)
    expect(dms.isFavorite('c1')).toBe(true)
    expect(dms.toggleFavorite('c1')).toBe(false)
    expect(dms.isFavorite('c1')).toBe(false)
    expect(dms.toggleFavorite('missing')).toBe(false)
  })

  it('cancels a scheduled message without removing other conversation messages', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = dms.conversations[0]
    const originalMessageCount = conversation.messages.length
    const scheduled = dms.sendMessage(conversation.id, {
      content: 'Later',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    })

    expect(dms.cancelScheduledMessage(conversation.id, scheduled.id)).toBe(true)
    expect(conversation.messages).toHaveLength(originalMessageCount)
    expect(dms.cancelScheduledMessage(conversation.id, 'missing-message')).toBe(false)
  })

  it('edits, deletes, and reacts to messages authored by the current user', async () => {
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [
        { id: 'm1', from: 'u1', text: 'Original', createdAt: '2026-01-01T10:00:00Z' },
      ]),
    ])
    const dms = useDmStore()
    await dms.init()
    const sent = dms.conversations[0].messages[0]

    expect(dms.editMessage('c1', sent.id, 'Updated')).toBe(true)
    expect(sent).toMatchObject({ text: 'Updated', editedAt: expect.any(String) })
    expect(dms.toggleReaction('c1', sent.id, '🎉')).toBe(true)
    expect(sent.reactions).toEqual([{ emoji: '🎉', users: [dms.meId] }])
    expect(dms.deleteMessage('c1', sent.id)).toBe(true)
    expect(dms.conversations[0].messages).not.toContain(sent)
  })

  it('does not allow editing or deleting another user message', async () => {
    const dms = useDmStore()
    await dms.init()
    const received = dms.conversations[0].messages[0]

    expect(dms.editMessage('c1', received.id, 'Changed')).toBe(false)
    expect(dms.deleteMessage('c1', received.id)).toBe(false)
    expect(dms.conversations[0].messages).toContain(received)
  })

  // ---------------- Messages API ----------------

  it('sends a message with POST and swaps the local copy for the server message', async () => {
    const dms = useDmStore()
    await dms.init()

    const sent = dms.sendMessage('c1', { content: 'Hello Muniba' })
    expect(sent).toMatchObject({ status: 'sending', text: 'Hello Muniba' })
    expect(dmApi.sendMessage).toHaveBeenCalledWith('company-1', 'c1', { body: 'Hello Muniba' })

    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))
    expect(dms.conversations[0].messages.at(-1)).toMatchObject({ text: 'Hello Muniba', from: 'u1' })
  })

  it('marks a message failed when POST fails and retries it', async () => {
    dmApi.sendMessage.mockRejectedValueOnce(new Error('Failed to fetch'))
    const dms = useDmStore()
    await dms.init()

    const sent = dms.sendMessage('c1', { content: 'Try again' })
    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).status).toBe('failed'))
    expect(dms.actionError).toBe('Failed to fetch')

    expect(dms.retryMessage('c1', sent.id)).toBe(true)
    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))
  })

  it('sends PATCH with the new body and confirms it with GET single message', async () => {
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [{ id: 'm1', from: 'u1', text: 'Original', createdAt: '' }]),
    ])
    dmApi.getMessage.mockResolvedValue({
      id: 'm1',
      from: 'u1',
      text: 'Updated',
      createdAt: '',
      editedAt: '2026-01-01T11:00:00Z',
    })
    const dms = useDmStore()
    await dms.init()

    dms.editMessage('c1', 'm1', 'Updated')

    expect(dmApi.updateMessage).toHaveBeenCalledWith('company-1', 'c1', 'm1', { body: 'Updated' })
    await vi.waitFor(() => expect(dmApi.getMessage).toHaveBeenCalledWith('company-1', 'c1', 'm1'))
    await vi.waitFor(() =>
      expect(dms.conversations[0].messages[0]).toMatchObject({
        text: 'Updated',
        editedAt: '2026-01-01T11:00:00Z',
      }),
    )
  })

  it('puts the old text back when PATCH fails', async () => {
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [{ id: 'm1', from: 'u1', text: 'Original', createdAt: '' }]),
    ])
    dmApi.updateMessage.mockRejectedValue(new Error('Forbidden'))
    const dms = useDmStore()
    await dms.init()

    dms.editMessage('c1', 'm1', 'Updated')

    await vi.waitFor(() => expect(dms.conversations[0].messages[0].text).toBe('Original'))
    expect(dms.actionError).toBe('Forbidden')
  })

  it('sends DELETE and puts the message back when it fails', async () => {
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [{ id: 'm1', from: 'u1', text: 'Mine', createdAt: '' }]),
    ])
    dmApi.deleteMessage.mockRejectedValue(new Error('Failed to fetch'))
    const dms = useDmStore()
    await dms.init()

    expect(dms.deleteMessage('c1', 'm1')).toBe(true)
    expect(dmApi.deleteMessage).toHaveBeenCalledWith('company-1', 'c1', 'm1')
    expect(dms.conversations[0].messages).toHaveLength(0)

    await vi.waitFor(() => expect(dms.conversations[0].messages[0]?.text).toBe('Mine'))
  })

  it('refreshes one message with GET single message', async () => {
    dmApi.getMessage.mockResolvedValue({ id: 'm1', from: 'u2', text: 'Received (edited)', createdAt: '' })
    const dms = useDmStore()
    await dms.init()

    await dms.refreshMessage('c1', 'm1')

    expect(dms.conversations[0].messages[0].text).toBe('Received (edited)')
  })

  // ---------------- Receiving (polling) ----------------

  it('receives new, edited and deleted messages of the other user while polling', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dmApi.listMessages).toHaveBeenCalled())

    // dusre user ne naya message bheja
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'm2', from: 'u2', text: 'New from u2', createdAt: '2026-01-01T10:01:00Z' },
    ])
    await dms.pollOnce()
    expect(dms.conversations[0].messages.map((m) => m.text)).toEqual(['Received', 'New from u2'])
    expect(JSON.parse(localStorage.getItem('whistleit:dm-messages'))['company-1'].c1).toHaveLength(2)

    // usne edit kiya
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'm2', from: 'u2', text: 'Edited by u2', createdAt: '', editedAt: 'T' },
    ])
    await dms.pollOnce()
    expect(dms.conversations[0].messages[1]).toMatchObject({ text: 'Edited by u2', editedAt: 'T' })

    // usne delete kiya
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
    ])
    await dms.pollOnce()
    expect(dms.conversations[0].messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('polls silently without loading state or error banner', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    dmApi.listMessages.mockRejectedValue(new Error('Failed to fetch'))
    const polling = dms.pollOnce()
    expect(dms.messagesLoading).toBe(false)
    await polling
    expect(dms.messagesError).toBe('')
    expect(dms.conversations[0].messages[0].text).toBe('Received')
  })

  it('does not lose a message sent while a poll request was in flight', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    let answerPoll
    dmApi.listMessages.mockImplementation(() => new Promise((resolve) => (answerPoll = resolve)))
    const polling = dms.pollOnce()
    dms.sendMessage('c1', { content: 'Sent during poll' })
    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))

    // purani list (naya message is mein nahi)
    answerPoll([{ id: 'm1', from: 'u2', text: 'Received', createdAt: '' }])
    await polling
    expect(dms.conversations[0].messages.map((m) => m.text)).toEqual(['Received', 'Sent during poll'])
  })

  it('does not bring back a message that is being deleted during a poll', async () => {
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [{ id: 'm1', from: 'u1', text: 'Delete me', createdAt: '' }]),
    ])
    dmApi.listMessages.mockResolvedValue([{ id: 'm1', from: 'u1', text: 'Delete me', createdAt: '' }])
    let finishDelete
    dmApi.deleteMessage.mockImplementation(() => new Promise((resolve) => (finishDelete = resolve)))
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    dms.deleteMessage('c1', 'm1')
    await dms.pollOnce()

    expect(dms.conversations[0].messages).toHaveLength(0)
    finishDelete(null)
  })

  it('starts and stops the polling timer', async () => {
    vi.useFakeTimers()
    try {
      const dms = useDmStore()
      await dms.init()
      dms.openConversation('c1')
      await vi.advanceTimersByTimeAsync(0)
      dmApi.listMessages.mockClear()

      dms.startPolling(1000)
      await vi.advanceTimersByTimeAsync(3000)
      expect(dmApi.listMessages).toHaveBeenCalledTimes(3)

      dms.stopPolling()
      await vi.advanceTimersByTimeAsync(3000)
      expect(dmApi.listMessages).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('deactivates the open DM without removing it from the list', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')

    dms.deactivateConversation()

    expect(dms.activeId).toBeNull()
    expect(dms.activeConversation).toBeNull()
    expect(dms.sorted.map((c) => c.id)).toEqual(['c1'])
    await dms.pollOnce() // band DM ke messages poll nahi hote
  })
})