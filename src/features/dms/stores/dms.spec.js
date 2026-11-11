import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/features/dms/dmApi', () => ({
  normalizePublicCustomStatus: vi.fn((response, id) => ({
    id,
    customStatus: response.data.customStatus,
    customStatusLoaded: true,
  })),
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
vi.mock('@/features/account/api', () => ({ getUser: vi.fn() }))
vi.mock('@/features/reactions/reactionsApi', () => ({
  reactionsApi: { toggleReaction: vi.fn() },
}))

import { getUser } from '@/features/account/api'
import { dmApi } from '@/features/dms/dmApi'
import { reactionsApi } from '@/features/reactions/reactionsApi'
import { useMembersStore } from '@/stores/members'
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
    getUser.mockResolvedValue({
      data: { customStatus: { emoji: '📅', text: 'In a meeting' } },
    })
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
    reactionsApi.toggleReaction.mockResolvedValue(null)
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

  it('loads missing public custom statuses for DM participants', async () => {
    const dms = useDmStore()
    await dms.init()

    await dms.loadCustomStatuses(['u2'])

    expect(getUser).toHaveBeenCalledWith('u2')
    expect(dms.usersById.u2.customStatus).toEqual({ emoji: '📅', text: 'In a meeting' })
    expect(dms.usersById.u2.customStatusLoaded).toBe(true)
    expect(dms.customStatusError).toBe('')
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

  it('keeps a queued DM message "sending" after a reload and resends it (no "Not sent")', async () => {
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
      expect.objectContaining({ id: sent.id, text: 'Keep this direct message', status: 'sending', resend: true }),
    )

    // chat khulte hi (server par nahi pahuncha tha) khud dobara bheja jata hai
    dmApi.sendMessage.mockClear()
    dmApi.sendMessage.mockResolvedValue({ id: 'srv-9', from: 'u1', text: 'Keep this direct message', createdAt: new Date().toISOString() })
    reloadedDms.openConversation('c1')
    await vi.waitFor(() => expect(dmApi.sendMessage).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(reloadedDms.conversations[0].messages.at(-1).id).toBe('srv-9'))
    reloadedDms.stopPolling()
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
    // gayab nahi: "(message deleted)"
    expect(dms.conversations[0].messages[0]).toMatchObject({ id: sent.id, deleted: true })
    expect(dms.deleteMessage('c1', sent.id)).toBe(false) // dobara delete nahi
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
    expect(dmApi.sendMessage).toHaveBeenCalledWith(
      'company-1',
      'c1',
      expect.objectContaining({
        body: 'Hello Muniba',
        text: 'Hello Muniba',
        is_code: false,
        senderId: 'u1',
        receiverId: 'u2',
        timestamp: expect.any(String),
        is_important: false,
      }),
    )

    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))
    expect(dms.conversations[0].messages.at(-1)).toMatchObject({ text: 'Hello Muniba', from: 'u1' })
  })

  it('sends and preserves an important direct message', async () => {
    const dms = useDmStore()
    await dms.init()

    dms.sendMessage('c1', { content: 'Urgent update', important: true })

    expect(dmApi.sendMessage).toHaveBeenCalledWith(
      'company-1',
      'c1',
      expect.objectContaining({
        body: 'Urgent update',
        is_important: true,
      }),
    )
    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))
    expect(dms.conversations[0].messages.at(-1).important).toBe(true)
  })

  it('sends code messages with sender, receiver, mode, and timestamp metadata', async () => {
    const dms = useDmStore()
    await dms.init()
    const timestamp = '2026-11-11T09:00:00.000Z'

    dms.sendMessage('c1', {
      content: 'const answer = 42',
      is_code: true,
      senderId: 'u1',
      receiverId: 'u2',
      timestamp,
    })

    expect(dmApi.sendMessage).toHaveBeenCalledWith(
      'company-1',
      'c1',
      expect.objectContaining({
        body: 'const answer = 42',
        text: 'const answer = 42',
        is_code: true,
        senderId: 'u1',
        receiverId: 'u2',
        timestamp,
      }),
    )
    expect(dms.conversations[0].messages.at(-1)).toMatchObject({
      text: 'const answer = 42',
      isCode: true,
    })
  })

  it('marks a message failed when POST fails and retries it', async () => {
    // 422 jaisa error dobara bhejne se theek nahi hota: seedha "failed"
    dmApi.sendMessage.mockRejectedValueOnce(Object.assign(new Error('Failed to fetch'), { status: 422 }))
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
    expect(dms.conversations[0].messages[0].deleted).toBe(true)

    await vi.waitFor(() => expect(dms.conversations[0].messages[0].deleted).toBe(false))
    expect(dms.conversations[0].messages[0].text).toBe('Mine')
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
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

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
    await dms.pollOnce() // server list mein abhi message hai

    expect(dms.conversations[0].messages).toHaveLength(1)
    expect(dms.conversations[0].messages[0].deleted).toBe(true)
    finishDelete(null)
  })

  it('starts and stops the polling timer', async () => {
    vi.useFakeTimers()
    try {
      const dms = useDmStore()
      await dms.init()
      dms.openConversation('c1')
      await vi.advanceTimersByTimeAsync(0)
      dms.stopPolling() // conversation kholne par 4 sec wala chalu ho gaya tha
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

  // ---------------- Reactions API ----------------

  it('shows a reaction instantly and sends it with POST reactions', async () => {
    reactionsApi.toggleReaction.mockResolvedValue([{ emoji: '👍', users: ['u2', 'u1'] }])
    const dms = useDmStore()
    await dms.init()

    expect(dms.toggleReaction('c1', 'm1', '👍')).toBe(true)
    expect(dms.conversations[0].messages[0].reactions).toEqual([{ emoji: '👍', users: ['u1'] }])
    expect(reactionsApi.toggleReaction).toHaveBeenCalledWith(
      { companyId: 'company-1', channelId: 'c1', messageId: 'm1' },
      '👍',
    )

    // server ki list (dusre user ka reaction bhi) lag jati hai
    await vi.waitFor(() =>
      expect(dms.conversations[0].messages[0].reactions).toEqual([
        { emoji: '👍', users: ['u2', 'u1'] },
      ]),
    )
    expect(
      JSON.parse(localStorage.getItem('whistleit:dm-messages'))['company-1'].c1[0].reactions,
    ).toEqual([{ emoji: '👍', users: ['u2', 'u1'] }])
  })

  it('removes my reaction on a second click', async () => {
    const dms = useDmStore()
    await dms.init()

    dms.toggleReaction('c1', 'm1', '👍')
    dms.toggleReaction('c1', 'm1', '👍')

    expect(dms.conversations[0].messages[0].reactions).toEqual([])
    expect(reactionsApi.toggleReaction).toHaveBeenCalledTimes(2)
  })

  it('undoes the reaction when the POST fails', async () => {
    reactionsApi.toggleReaction.mockRejectedValue(new Error('Failed to fetch'))
    const dms = useDmStore()
    await dms.init()

    dms.toggleReaction('c1', 'm1', '🎉')
    expect(dms.conversations[0].messages[0].reactions).toHaveLength(1)

    await vi.waitFor(() => expect(dms.conversations[0].messages[0].reactions).toEqual([]))
    expect(dms.actionError).toBe('Failed to fetch')
  })

  it('ignores an old server answer when the user clicked again', async () => {
    const answers = []
    reactionsApi.toggleReaction.mockImplementation(
      () => new Promise((resolve) => answers.push(resolve)),
    )
    const dms = useDmStore()
    await dms.init()

    dms.toggleReaction('c1', 'm1', '👍') // add
    dms.toggleReaction('c1', 'm1', '👍') // remove
    answers[0]([{ emoji: '👍', users: ['u1'] }]) // pehle click ka purana jawab
    await Promise.resolve()
    expect(dms.conversations[0].messages[0].reactions).toEqual([])

    answers[1]([])
    await vi.waitFor(() => expect(dms.conversations[0].messages[0].reactions).toEqual([]))
  })

  it('keeps a reaction local for a message that is not on the server yet', async () => {
    dmApi.sendMessage.mockImplementation(() => new Promise(() => {}))
    const dms = useDmStore()
    await dms.init()
    const sent = dms.sendMessage('c1', { content: 'Pending' })

    expect(dms.toggleReaction('c1', sent.id, '👍')).toBe(true)
    expect(reactionsApi.toggleReaction).not.toHaveBeenCalled()
  })

  it('receives reactions of the other user while polling', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '', reactions: [{ emoji: '❤️', users: ['u2'] }] },
    ])
    await dms.pollOnce()

    expect(dms.conversations[0].messages[0].reactions).toEqual([{ emoji: '❤️', users: ['u2'] }])
    dms.stopPolling()
  })

  it('does not let a poll undo a reaction that is still being sent', async () => {
    reactionsApi.toggleReaction.mockImplementation(() => new Promise(() => {}))
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    dms.toggleReaction('c1', 'm1', '👍')
    await dms.pollOnce() // server list mein abhi reaction nahi

    expect(dms.conversations[0].messages[0].reactions).toEqual([{ emoji: '👍', users: ['u1'] }])
    dms.stopPolling()
  })

  // ---------------- Receiving without reload ----------------

  it('starts polling by itself when a conversation is opened', async () => {
    vi.useFakeTimers()
    try {
      const dms = useDmStore()
      await dms.init()
      dms.openConversation('c1')
      await vi.advanceTimersByTimeAsync(0)
      dmApi.listMessages.mockClear()
      dmApi.listMessages.mockResolvedValue([
        { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
        { id: 'm2', from: 'u2', text: 'Arrived without reload', createdAt: '2026-01-01T10:01:00Z' },
      ])

      await vi.advanceTimersByTimeAsync(4000)

      expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c1')
      expect(dms.conversations[0].messages.at(-1).text).toBe('Arrived without reload')
      dms.stopPolling()
    } finally {
      vi.useRealTimers()
    }
  })

  it('checks for new messages right away when the tab becomes visible again', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))
    dmApi.listMessages.mockClear()

    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c1'))
    dms.stopPolling()
  })

  // ---------------- Members store (pehle wali DM list ke users) ----------------

  it('adds the team members from the members store to the DM search list', async () => {
    const membersStore = useMembersStore()
    membersStore.members = [
      { id: 'u5', name: 'Afia Noor', status: 'online' },
      { id: 'm-6', user: { id: 'u6', full_name: 'Salman Zahoor' } },
      { id: 'u2', name: 'Duplicate of company user' },
    ]
    dmApi.listCompanyMembers.mockResolvedValue([{ id: 'u2', name: 'Muniba Naseer', email: '', avatarUrl: '' }])
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(dms.companyMembers.map((u) => u.name)).toEqual(['Muniba Naseer', 'Afia Noor', 'Salman Zahoor'])
    expect(dms.usersById.u6.name).toBe('Salman Zahoor')
    membersStore.members = []
  })

  it('loads the members store for the active team when it is empty', async () => {
    const membersStore = useMembersStore()
    membersStore.members = []
    membersStore.fetchMembers.mockImplementation(async () => {
      membersStore.members = [{ id: 'u7', name: 'Taha Jawad' }]
    })
    useTeamsStore().activeTeamId = 'team-9'
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(membersStore.fetchMembers).toHaveBeenCalledWith('team-9')
    expect(dms.companyMembers.map((u) => u.name)).toContain('Taha Jawad')
    membersStore.members = []
  })

  it('uses the first team (or team-1) for the members store like the old DM store', async () => {
    const membersStore = useMembersStore()
    membersStore.members = []
    membersStore.fetchMembers.mockClear()
    membersStore.fetchMembers.mockImplementation(async () => {
      membersStore.members = [{ id: 'u8', name: 'Esha Fayyaz' }]
    })
    const teams = useTeamsStore()
    teams.activeTeamId = undefined
    teams.teamsByWorkspaceId = {}
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(membersStore.fetchMembers).toHaveBeenCalledWith('team-1')
    expect(dms.companyMembers.map((u) => u.name)).toContain('Esha Fayyaz')
    membersStore.members = []
  })

  // ---------------- Delete: "(message deleted)" ----------------

  it('removes an unsent local message completely', async () => {
    dmApi.sendMessage.mockImplementation(() => new Promise(() => {}))
    const dms = useDmStore()
    await dms.init()
    const sent = dms.sendMessage('c1', { content: 'Oops' })

    expect(dms.deleteMessage('c1', sent.id)).toBe(true)
    expect(dms.conversations[0].messages.map((m) => m.id)).toEqual(['m1'])
    expect(dmApi.deleteMessage).not.toHaveBeenCalled()
  })

  it('shows "(message deleted)" to the other user when the message disappears from the server', async () => {
    const at = (min) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString()
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'One', createdAt: at(0) },
      { id: 'm2', from: 'u2', text: 'Two', createdAt: at(1) },
      { id: 'm3', from: 'u2', text: 'Three', createdAt: at(2) },
    ])
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.conversations[0].messages).toHaveLength(3))

    // u2 ne "Two" delete kiya: server list mein ab nahi
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'One', createdAt: at(0) },
      { id: 'm3', from: 'u2', text: 'Three', createdAt: at(2) },
    ])
    await dms.pollOnce()

    expect(dms.conversations[0].messages.map((m) => [m.id, Boolean(m.deleted)])).toEqual([
      ['m1', false],
      ['m2', true],
      ['m3', false],
    ])
    dms.stopPolling()
  })

  it('does not mark older messages deleted just because they are outside the latest page', async () => {
    const at = (min) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString()
    dmApi.listDirectChannels.mockResolvedValue([
      makeConversation('c1', 'u2', [{ id: 'old', from: 'u2', text: 'Old', createdAt: at(0) }]),
    ])
    dmApi.listMessages.mockResolvedValue([{ id: 'm5', from: 'u2', text: 'Newest page', createdAt: at(5) }])
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await dms.pollOnce()

    // page se bahar wala purana message rehta hai (na gayab, na "deleted")
    expect(dms.conversations[0].messages.find((m) => m.id === 'old')).toMatchObject({ text: 'Old' })
    expect(dms.conversations[0].messages.find((m) => m.id === 'old').deleted).toBeFalsy()
    dms.stopPolling()
  })

  it('keeps my reaction on screen when the server sends reactions it cannot understand', async () => {
    reactionsApi.toggleReaction.mockResolvedValue(null) // jawab samajh nahi aaya
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    dms.toggleReaction('c1', 'm1', '👍')
    await flushReactions()
    // poll: dmApi ne samajh na aane wale reactions ko undefined kar diya
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z', reactions: undefined },
    ])
    await dms.pollOnce()

    expect(dms.conversations[0].messages[0].reactions).toEqual([{ emoji: '👍', users: ['u1'] }])
    dms.stopPolling()
  })

  // ---------------- Unread + notification ----------------

  function twoDms() {
    const a = makeConversation('c1', 'u2', [
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
    ])
    const b = makeConversation('c2', 'u3', [
      { id: 'x1', from: 'u3', text: 'Old', createdAt: '2026-01-01T09:00:00Z' },
    ])
    b.users[1].name = 'Muniba Naseer'
    return [a, b]
  }

  it('counts unread messages in a closed DM and shows a notification, then clears on open', async () => {
    dmApi.listDirectChannels.mockImplementation(async () => twoDms())
    dmApi.listMessages.mockImplementation(async (_c, id) =>
      id === 'c2'
        ? [
            { id: 'x1', from: 'u3', text: 'Old', createdAt: '2026-01-01T09:00:00Z' },
            { id: 'x2', from: 'u3', text: 'j', createdAt: '2026-01-01T11:00:00Z' },
            { id: 'x3', from: 'u3', text: 'kahan ho?', createdAt: '2026-01-01T11:01:00Z' },
          ]
        : [{ id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' }],
    )
    const dms = useDmStore()
    await dms.init()
    expect(dms.notifications).toHaveLength(0) // purane messages par notification nahi
    dms.openConversation('c1')

    for (let i = 0; i < 4; i += 1) await dms.pollOnce() // ~16 sec: band DMs check

    const c2 = dms.conversations.find((c) => c.id === 'c2')
    expect(c2.unreadCount).toBe(2)
    expect(dms.notifications.map((n) => [n.title, n.sender, n.text])).toEqual([
      ['Muniba Naseer', 'Muniba Naseer', 'j'],
      ['Muniba Naseer', 'Muniba Naseer', 'kahan ho?'],
    ])
    expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c2')

    // khol li: unread 0, aur reload ke baad bhi 0
    dms.openConversation('c2')
    expect(c2.unreadCount).toBe(0)
    expect(dms.notifications).toHaveLength(0) // chat khuli: notifications band
    expect(dms.hasNewMessage).toBe(false)
    dms.stopPolling()
  })

  it('remembers what was read across a reload and counts only newer messages', async () => {
    dmApi.listDirectChannels.mockImplementation(async () => twoDms())
    let dms = useDmStore()
    await dms.init() // pehli dafa: purani history unread nahi
    expect(dms.conversations.find((c) => c.id === 'c2').unreadCount).toBe(0)

    // reload, aur c2 mein 1 naya message
    dmApi.listDirectChannels.mockImplementation(async () => {
      const [a, b] = twoDms()
      b.conversation.messages.push({ id: 'x9', from: 'u3', text: 'New', createdAt: '2026-01-01T12:00:00Z' })
      return [a, b]
    })
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dms = useDmStore()
    await dms.init()

    expect(dms.conversations.find((c) => c.id === 'c2').unreadCount).toBe(1)
  })

  it('does not notify for my own messages or the chat that is open', async () => {
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'm2', from: 'u2', text: 'Open chat', createdAt: '2026-01-01T10:01:00Z' },
      { id: 'm3', from: 'u1', text: 'Mine', createdAt: '2026-01-01T10:02:00Z' },
    ])
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await dms.pollOnce()

    expect(dms.notifications).toHaveLength(0)
    expect(dms.conversations[0].unreadCount).toBe(0)
    dms.stopPolling()
  })

  it('does not remove my reaction when the same emoji is picked again from the picker', async () => {
    const dms = useDmStore()
    await dms.init()

    dms.setReactionPicker('m1')
    expect(dms.toggleReaction('c1', 'm1', '🙃')).toBe(true)
    expect(dms.toggleReaction('c1', 'm1', '🙃')).toBe(true) // picker se dobara
    dms.setReactionPicker(null)

    expect(dms.conversations[0].messages[0].reactions).toEqual([{ emoji: '🙃', users: ['u1'] }])
    expect(reactionsApi.toggleReaction).toHaveBeenCalledTimes(1)

    // pill par click: hat jata hai
    dms.toggleReaction('c1', 'm1', '🙃')
    expect(dms.conversations[0].messages[0].reactions).toEqual([])
  })

  // ---------------- hasNewMessage key ----------------

  it('sets hasNewMessage (and localStorage key) true only while a new message notification is shown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      dmApi.listDirectChannels.mockImplementation(async () => twoDms())
      dmApi.listMessages.mockImplementation(async (_c, id) =>
        id === 'c2'
          ? [
              { id: 'x1', from: 'u3', text: 'Old', createdAt: '2026-01-01T09:00:00Z' },
              { id: 'x2', from: 'u3', text: 'Naya', createdAt: '2026-01-01T11:00:00Z' },
            ]
          : [{ id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' }],
      )
      const dms = useDmStore()
      await dms.init()
      dms.openConversation('c1')

      // abhi koi naya message nahi
      expect(dms.hasNewMessage).toBe(false)
      expect(localStorage.getItem('whistleit:dm-new-message')).toBe('false')

      for (let i = 0; i < 4; i += 1) await dms.pollOnce() // messages API se naya message
      expect(dms.hasNewMessage).toBe(true)
      expect(localStorage.getItem('whistleit:dm-new-message')).toBe('true')

      // 6 sec baad notification khud band -> false
      await vi.advanceTimersByTimeAsync(6000)
      expect(dms.hasNewMessage).toBe(false)
      expect(localStorage.getItem('whistleit:dm-new-message')).toBe('false')
      dms.stopPolling()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sets hasNewMessage false when that chat is opened', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.notifications = [{ id: 'n1', conversationId: 'c1', title: 'A', sender: 'A', text: 'hi' }]
    expect(dms.hasNewMessage).toBe(true)

    dms.openConversation('c1')

    expect(dms.hasNewMessage).toBe(false)
    expect(localStorage.getItem('whistleit:dm-new-message')).toBe('false')
    dms.stopPolling()
  })

  it('checks a closed DM for new messages even if the backend gives no last_message_at', async () => {
    const list = () => {
      const [a, b] = twoDms()
      b.conversation.lastActivityAt = ''
      return [a, b]
    }
    dmApi.listDirectChannels.mockImplementation(async () => list())
    dmApi.listMessages.mockImplementation(async (_c, id) =>
      id === 'c2'
        ? [
            { id: 'x1', from: 'u3', text: 'Old', createdAt: '2026-01-01T09:00:00Z' },
            { id: 'x2', from: 'u3', text: 'Naya', createdAt: '2026-01-01T11:00:00Z' },
          ]
        : [{ id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' }],
    )
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')

    for (let i = 0; i < 4; i += 1) await dms.pollOnce()

    expect(dms.conversations.find((c) => c.id === 'c2').unreadCount).toBe(1)
    expect(dms.hasNewMessage).toBe(true)
    dms.stopPolling()
  })

  // ---------------- 20-30 messages ek saath (queue + retry) ----------------

  it('sends a burst of 25 messages quickly (3 at a time), started in order, without failing', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const order = []
    let n = 0
    dmApi.sendMessage.mockImplementation(async (_c, _ch, payload) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      order.push(payload.body) // shuru hone ki tarteeb
      await new Promise((r) => setTimeout(r, 1))
      inFlight -= 1
      n += 1
      return { id: `s-${n}`, from: 'u1', text: payload.body, createdAt: new Date(Date.UTC(2026, 0, 2, 0, 0, n)).toISOString() }
    })
    const dms = useDmStore()
    await dms.init()

    for (let i = 1; i <= 25; i += 1) dms.sendMessage('c1', { content: `msg ${i}` })

    await vi.waitFor(() => expect(order).toHaveLength(25))
    expect(order).toEqual(Array.from({ length: 25 }, (_, i) => `msg ${i + 1}`))
    expect(maxInFlight).toBe(3) // ek waqt mein 3 (tez), zyada nahi
    await vi.waitFor(() =>
      expect(dms.conversations[0].messages.filter((m) => m.status === 'failed' || m.status === 'sending')).toHaveLength(0),
    )
    expect(dms.conversations[0].messages).toHaveLength(26) // 1 purana + 25 naye
  })

  it('retries automatically on 429 / network errors and then sends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      dmApi.sendMessage
        .mockRejectedValueOnce(Object.assign(new Error('Too Many Requests'), { status: 429 }))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      const dms = useDmStore()
      await dms.init()

      dms.sendMessage('c1', { content: 'Zaroor jaye' })
      await vi.advanceTimersByTimeAsync(5000)

      await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))
      expect(dmApi.sendMessage).toHaveBeenCalledTimes(3)
      expect(dms.conversations[0].messages.at(-1).status).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  // ---------------- Pagination ----------------

  it('keeps older messages when 30 new ones push them off the first page', async () => {
    const at = (min) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString()
    const all = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, from: 'u2', text: `t${i}`, createdAt: at(i) }))
    dmApi.listMessages.mockImplementation(async () => all.slice(0, 15)) // pehle 15
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.conversations[0].messages.length).toBeGreaterThanOrEqual(15))

    // ab server ka pehla page sirf aakhri 20 deta hai
    dmApi.listMessages.mockImplementation(async () => all.slice(20, 40))
    await dms.pollOnce()

    const ids = dms.conversations[0].messages.map((m) => m.id)
    expect(ids).toContain('p0') // purane gayab nahi hue
    expect(ids).toContain('p39')
    expect(dms.conversations[0].messages.filter((m) => m.id.startsWith('p') && m.deleted)).toHaveLength(0)
    dms.stopPolling()
  })

  it('loads older messages page by page from the server', async () => {
    const at = (min) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString()
    const page = (from, to, hasMore) =>
      Object.defineProperty(
        Array.from({ length: to - from }, (_, i) => ({ id: `q${from + i}`, from: 'u2', text: `q${from + i}`, createdAt: at(from + i) })),
        'pagination',
        { value: { hasMore } },
      )
    dmApi.listMessages.mockImplementation(async (_c, _ch, opts = {}) =>
      opts.page === 2 ? page(0, 20, false) : page(20, 40, true),
    )
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.conversations[0].messages.some((m) => m.id === 'q39')).toBe(true))
    expect(dms.hasMoreOlder('c1')).toBe(true)

    await expect(dms.loadOlderMessages('c1')).resolves.toBe(20)

    expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c1', { page: 2 })
    const ids = dms.conversations[0].messages.map((m) => m.id)
    const qs = ids.filter((id) => id.startsWith('q'))
    expect(qs).toEqual(Array.from({ length: 40 }, (_, i) => `q${i}`)) // purane upar, sahi tarteeb
    expect(ids).toContain('q39')
    expect(dms.hasMoreOlder('c1')).toBe(false)
    expect(dms.notifications).toHaveLength(0) // purane messages par notification nahi
    dms.stopPolling()
  })

  // ---------------- Backend pagination (per_page 15) ----------------

  it('uses the newest page when page 1 holds the oldest messages, and keeps everything', async () => {
    const at = (min) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString()
    const msgs = Array.from({ length: 40 }, (_, i) => ({ id: `z${i}`, from: 'u2', text: `z${i}`, createdAt: at(i) }))
    const page = (n) =>
      Object.defineProperty(msgs.slice((n - 1) * 15, n * 15), 'pagination', {
        value: { page: n, hasMore: n < 3, lastPage: 3 },
      })
    dmApi.listMessages.mockImplementation(async (_c, _ch, opts = {}) => page(opts.page ?? 1))
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    let ids = dms.conversations[0].messages.map((m) => m.id)
    expect(ids).toContain('z39')
    expect(dms.conversations[0].messages.filter((m) => m.id.startsWith('z') && m.deleted)).toHaveLength(0)

    dmApi.listMessages.mockClear()
    await dms.pollOnce()
    expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c1', { page: 3 })

    expect(dms.hasMoreOlder('c1')).toBe(true)
    await dms.loadOlderMessages('c1')
    await dms.loadOlderMessages('c1')
    ids = dms.conversations[0].messages.map((m) => m.id)
    expect(ids.filter((id) => id.startsWith('z'))).toHaveLength(40)
    expect(dms.hasMoreOlder('c1')).toBe(false)
    dms.stopPolling()
  })

  // ---------------- "Not sent" sirf internet na hone par ----------------

  it('keeps "Sending…" while the backend says 429 and only fails when there is no internet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const online = vi.spyOn(navigator, 'onLine', 'get')
    try {
      online.mockReturnValue(true)
      const tooMany = () => Object.assign(new Error('Too Many Attempts.'), { status: 429 })
      dmApi.sendMessage
        .mockRejectedValueOnce(tooMany())
        .mockRejectedValueOnce(tooMany())
        .mockRejectedValueOnce(tooMany())
        .mockRejectedValueOnce(tooMany())
      const dms = useDmStore()
      await dms.init()
      const sent = dms.sendMessage('c1', { content: 'Limit ke baad bhi jaye' })

      await vi.advanceTimersByTimeAsync(9000)
      expect(dms.conversations[0].messages.find((m) => m.id === sent.id)?.status).toBe('sending')
      await vi.advanceTimersByTimeAsync(25000) // 3+6+9+12 sec intezar ke baad
      await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('server-1'))

      online.mockReturnValue(false)
      const offlineMsg = dms.sendMessage('c1', { content: 'Bina internet' })
      await vi.waitFor(() =>
        expect(dms.conversations[0].messages.find((m) => m.id === offlineMsg.id)).toMatchObject({
          status: 'failed',
          error: 'No internet connection',
        }),
      )
    } finally {
      online.mockRestore()
      vi.useRealTimers()
    }
  })

  it('keeps messages sent in the same second in the right order (by id)', async () => {
    const same = '2026-01-01T10:05:00Z'
    dmApi.listMessages.mockResolvedValue(
      ['6aec00000000000000000004', '6aec00000000000000000002', '6aec00000000000000000003', '6aec00000000000000000001'].map(
        (id) => ({ id, from: 'u1', text: id.slice(-1), createdAt: same }),
      ),
    )
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    const texts = dms.conversations[0].messages.filter((m) => m.createdAt === same).map((m) => m.text)
    expect(texts).toEqual(['1', '2', '3', '4'])
    dms.stopPolling()
  })

  // ---------------- "Sending…" atakna ----------------

  it('does not get stuck on "Sending…" when the DM list refreshes while a message is being sent', async () => {
    let answer
    dmApi.sendMessage.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    dmApi.listDirectChannels.mockImplementation(async () => [
      makeConversation('c1', 'u2', [{ id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' }]),
    ])
    const dms = useDmStore()
    await dms.init()
    const before = dms.conversations[0]
    const sent = dms.sendMessage('c1', { content: 'Atakna nahi' })
    await vi.waitFor(() => expect(dmApi.sendMessage).toHaveBeenCalled())

    await dms.init() // list refresh (har ~16 sec) beech mein
    expect(dms.conversations[0]).toBe(before) // wahi object

    answer({ id: 'srv-1', from: 'u1', text: 'Atakna nahi', createdAt: '2026-01-01T10:01:00Z' })
    await vi.waitFor(() => expect(dms.conversations[0].messages.at(-1).id).toBe('srv-1'))
    expect(dms.conversations[0].messages.some((m) => m.id === sent.id)).toBe(false)
    expect(dms.conversations[0].messages.filter((m) => m.status === 'sending')).toHaveLength(0)
  })

  // ---------------- Forward ----------------

  it('sends a forwarded message with is_forwarded so the receiver sees (forwarded)', async () => {
    const dms = useDmStore()
    await dms.init()

    dms.sendMessage('c1', { content: 'hlw', forwardedFrom: 'Muniba Naseer in General' })

    await vi.waitFor(() =>
      expect(dmApi.sendMessage).toHaveBeenCalledWith('company-1', 'c1', {
        body: '[Forwarded] hlw',
        is_forwarded: true,
        forwarded_from: 'Muniba Naseer in General',
        forward_tag: 'Muniba Naseer in General',
        is_important: false,
      }),
    )
  })

  it('removes my "Sending…" copy as soon as the server copy shows up (no duplicate)', async () => {
    let answer
    dmApi.sendMessage.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const dms = useDmStore()
    await dms.init()
    dms.openConversation('c1')
    await vi.waitFor(() => expect(dms.messagesLoading).toBe(false))

    const sent = dms.sendMessage('c1', { content: 'tez' })
    await vi.waitFor(() => expect(dmApi.sendMessage).toHaveBeenCalled())

    // server ne save kar liya, list mein aa gaya (POST ka jawab abhi raaste mein)
    dmApi.listMessages.mockResolvedValue([
      { id: 'm1', from: 'u2', text: 'Received', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'srv-7', from: 'u1', text: 'tez', createdAt: new Date().toISOString() },
    ])
    await dms.loadMessages('c1', { force: true })

    const texts = dms.conversations[0].messages.filter((m) => m.text === 'tez')
    expect(texts.map((m) => m.id)).toEqual(['srv-7']) // sirf ek, ✓✓ wali
    expect(dms.conversations[0].messages.some((m) => m.id === sent.id)).toBe(false)

    answer({ id: 'srv-7', from: 'u1', text: 'tez', createdAt: new Date().toISOString() })
    await new Promise((r) => setTimeout(r, 0))
    expect(dms.conversations[0].messages.filter((m) => m.text === 'tez')).toHaveLength(1)
    dms.stopPolling()
  })

  it('stops "Loading members…" even if a members request never answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      dmApi.listCompanyMembers.mockImplementation(() => new Promise(() => {})) // kabhi jawab nahi
      const dms = useDmStore()
      await dms.init()

      const loading = dms.loadCompanyMembers()
      expect(dms.companyMembersLoading).toBe(true)
      await vi.advanceTimersByTimeAsync(7000)
      await loading

      expect(dms.companyMembersLoading).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

async function flushReactions() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}