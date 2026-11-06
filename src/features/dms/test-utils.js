import { dmApi } from './dmApi'
import { CONVERSATIONS, ME_ID, PRESENCE, USERS } from './mockData'
import { useTeamsStore } from '@/stores/teams'

function usersForConversation(conversation) {
  return USERS.filter(
    (user) => user.id !== ME_ID && conversation.members.includes(user.id),
  ).map((user) => ({
    ...user,
    avatarUrl: '',
  }))
}

function makeConversation(id, memberIds, messages = []) {
  return {
    id,
    type: memberIds.length > 2 ? 'group' : 'dm',
    members: [...new Set([ME_ID, ...memberIds])],
    unreadCount: 0,
    isFavorite: false,
    messages,
  }
}

export function setupDmsTestState() {
  localStorage.removeItem('whistleit:dm-messages')
  sessionStorage.setItem('authToken', 'test-token')
  sessionStorage.setItem(
    'authUser',
    JSON.stringify({ id: ME_ID }),
  )

  const teams = useTeamsStore()
  teams.activeWorkspaceId = 'company-1'
  teams.activeTeamId = 'team-1'
  teams.teamsByWorkspaceId = { 'company-1': [{ id: 'team-1' }] }

  dmApi.meId = () => ME_ID
  dmApi.currentUser = () => ({ id: ME_ID, fullName: USERS[0].name })
  dmApi.listDirectChannels = async () =>
    structuredClone(CONVERSATIONS).map((conversation) => ({
      conversation,
      users: usersForConversation(conversation),
    }))
  dmApi.listCompanyMembers = async () =>
    USERS.map((user) => ({ ...user, email: '', avatarUrl: '' }))
  dmApi.listTeamMembers = async () => []
  dmApi.listTeamNonMembers = async () => []
  dmApi.getDirectChannel = async (_companyId, channelId) => {
    const conversation =
      structuredClone(CONVERSATIONS).find((item) => item.id === String(channelId)) ??
      makeConversation(String(channelId), [])
    return { conversation, users: usersForConversation(conversation) }
  }
  dmApi.createDirectChannel = async (_companyId, { user_id: userId }) => {
    const conversation = makeConversation(`created-${userId}`, [String(userId)])
    return { conversation, users: usersForConversation(conversation) }
  }
  dmApi.createGroupChannel = async (_companyId, { user_ids: userIds, name }) => {
    const conversation = makeConversation(`group-${Date.now()}`, userIds.map(String))
    conversation.name = name
    return { conversation, users: usersForConversation(conversation) }
  }
  dmApi.presence = async () => structuredClone(PRESENCE)
}
