import { vi } from 'vitest'

vi.mock('@/features/dms/dmApi', async () => {
  const { CONVERSATIONS, ME_ID, PRESENCE, USERS } = await import('@/test/fixtures/dms')
  const usersById = Object.fromEntries(USERS.map((user) => [user.id, user]))

  function withUsers(conversation) {
    const users = conversation.members.map((id) => usersById[id]).filter(Boolean)
    return { conversation: structuredClone(conversation), users: structuredClone(users) }
  }

  return {
    dmApi: {
      meId: () => ME_ID,
      listDirectChannels: vi.fn(async () => CONVERSATIONS.map(withUsers)),
      listCompanyMembers: vi.fn(async () => []),
      listTeamMembers: vi.fn(async () => []),
      listTeamNonMembers: vi.fn(async () => []),
      getDirectChannel: vi.fn(async (_companyId, channelId) => {
        const conversation = CONVERSATIONS.find((item) => item.id === channelId)
        if (conversation) return withUsers(conversation)
        const userId = String(channelId).replace(/^created-/, '')
        return {
          conversation: {
            id: String(channelId),
            type: 'dm',
            members: [ME_ID, userId],
            name: '',
            unreadCount: 0,
            isFavorite: false,
            messages: [],
          },
          users: [usersById[userId] ?? { id: userId, name: 'Member', avatarUrl: '' }],
        }
      }),
      createDirectChannel: vi.fn(async (_companyId, { user_id: userId }) => ({
        conversation: {
          id: `created-${userId}`,
          type: 'dm',
          members: [ME_ID, String(userId)],
          name: '',
          unreadCount: 0,
          isFavorite: false,
          messages: [],
        },
        users: [usersById[userId] ?? { id: String(userId), name: 'Member', avatarUrl: '' }],
      })),
      presence: vi.fn(async () => PRESENCE),
    },
  }
})
