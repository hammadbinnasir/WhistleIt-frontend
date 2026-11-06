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
    listMessages: vi.fn(),      // <- add
    sendMessage: vi.fn(),       // <- add
    updateMessage: vi.fn(),     // <- add
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
  dmApi.sendMessage.mockImplementation(async (_companyId, _channelId, payload) => ({
    id: 'server-1',
    from: 'u1',
    text: payload.content,
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
    useTeamsStore().teamsByWorkspaceId = {
      'company-1': [{ id: 'team-1' }],
    }
    dmApi.listTeamMembers.mockResolvedValue([
      { id: 'company-user-1', name: 'Company User', email: 'user@example.com', avatarUrl: '' },
    ])
    const dms = useDmStore()
    await dms.init()

    await dms.loadCompanyMembers()

    expect(dmApi.listCompanyMembers).not.toHaveBeenCalled()
    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('company-1', 'team-1')
    expect(dms.usersById['company-user-1']).toMatchObject({
      name: 'Company User',
      email: 'user@example.com',
    })
    expect(dms.companyMembersError).toBe('')
  })

  it('loads missing DM names through team APIs instead of the forbidden company endpoint', async () => {
    useTeamsStore().teamsByWorkspaceId = {
      'company-1': [{ id: 'team-1' }],
    }
    dmApi.listDirectChannels.mockImplementation(async () => [
      {
        conversation: {
          id: 'c1',
          type: 'dm',
          members: ['u1', 'u2'],
          name: '',
          unreadCount: 0,
          isFavorite: false,
          messages: [],
        },
        users: [{ id: 'u2', name: '', email: '', avatarUrl: '' }],
      },
    ])
    dmApi.listTeamMembers.mockResolvedValue([
      { id: 'u2', name: 'Named Team User', email: '', avatarUrl: '' },
    ])
    const dms = useDmStore()

    await dms.init()
    await vi.waitFor(() => {
      expect(dms.usersById.u2.name).toBe('Named Team User')
    })

    expect(dmApi.listCompanyMembers).not.toHaveBeenCalled()
    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('company-1', 'team-1')
  })

  it('combines team members and available users for DM search', async () => {
    useTeamsStore().teamsByWorkspaceId = {
      'company-1': [{ id: 'team-1' }, { id: 'team-2' }],
    }
    dmApi.listTeamMembers.mockImplementation(async (_companyId, teamId) =>
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

    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('company-1', 'team-1')
    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('company-1', 'team-2')
    expect(dmApi.listTeamNonMembers).toHaveBeenCalledWith('company-1', 'team-1')
    expect(dmApi.listTeamNonMembers).toHaveBeenCalledWith('company-1', 'team-2')
    expect(dms.companyMembers.map((user) => user.name)).toEqual([
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
    expect(dmApi.listTeamMembers).toHaveBeenCalledWith('company-1', 'team-loaded')
    expect(dms.companyMembers.map((user) => user.name)).toContain('Muniba Khan')
  })

  it('waits for workspace teams before loading their members', async () => {
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
    await vi.waitFor(() => expect(resolveTeams).toBeTypeOf('function'))
    expect(dmApi.listTeamMembers).not.toHaveBeenCalled()

    teams.teamsByWorkspaceId = {
      'company-1': [{ id: 'team-loaded' }],
    }
    resolveTeams(teams.teams)
    await vi.waitFor(() =>
      expect(dmApi.listTeamMembers).toHaveBeenCalledWith('company-1', 'team-loaded'),
    )
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

  it('restores locally sent DM messages after the conversation store is reloaded', async () => {
    const dms = useDmStore()
    await dms.init()

    const sent = dms.sendMessage('c1', { content: 'Keep this direct message' })
    expect(sent.id).toMatch(/^local-/)
    expect(JSON.parse(localStorage.getItem('whistleit:dm-messages'))['company-1']['c1']).toContainEqual(
      sent,
    )

    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    const reloadedDms = useDmStore()
    await reloadedDms.init()

    expect(reloadedDms.conversations[0].messages).toContainEqual(sent)
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
})
