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
    expect(dmApi.getDirectChannel).toHaveBeenCalledWith('company-1', 'c1')

    const created = await dms.startDm('u3')
    expect(created.id).toBe('created-channel')
    expect(created.members).toContain('u3')
    expect(dms.activeId).toBe('created-channel')
    expect(dmApi.createDirectChannel).toHaveBeenCalledWith('company-1', {
      user_id: 'u3',
    })
    expect(dmApi.getDirectChannel).toHaveBeenCalledWith('company-1', 'created-channel')
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
