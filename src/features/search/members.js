import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useChannelsStore } from '@/features/channels'
import {
  addChannelMember,
  listAvailableMembers as listAvailableChannelMembers,
  listMembers as listChannelMembers,
  removeChannelMember,
} from '@/features/channels/api/channels.api'

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

export async function listMembers(channelId = null) {
  if (channelId) {
    const { items, total } = await listChannelMembers(channelId, { limit: 100 })
    const completeMembers =
      total > items.length ? (await listChannelMembers(channelId, { limit: total })).items : items
    return completeMembers.map((member) => ({
      id: member.userId || member.id,
      name: member.name || member.email || 'Channel member',
      email: member.email || '',
      avatar: member.avatar || '',
      role: member.role || 'member',
      status: member.status || 'offline',
    }))
  }

  const teamsStore = useTeamsStore()
  const membersStore = useMembersStore()

  if (teamsStore.activeWorkspaceId && teamsStore.activeTeamId) {
    await membersStore.fetchMembers(teamsStore.activeWorkspaceId, teamsStore.activeTeamId)
  }

  return membersStore.members.map((member) => ({
    id: member.userId || member.membershipId,
    name: member.name || member.email || 'Team member',
    email: member.email || '',
    avatar: member.avatar || '',
    role: member.role || 'member',
    status: member.status || 'offline',
  }))
}

export async function listAvailableMembers(channelId) {
  if (!channelId) throw new Error('A channel ID is required to list available members.')
  const { items } = await listAvailableChannelMembers(channelId)
  return items
    .filter((member) => member.id)
    .map((member) => ({
      id: member.id,
      name: member.name || member.email || 'User',
      email: member.email || '',
      avatar: member.avatarUrl || '',
      role: member.role || 'member',
      status: member.status || 'offline',
    }))
}

export async function removeMember(userId, channelId) {
  if (!channelId) throw new Error('A channel ID is required to remove a member.')
  await removeChannelMember(channelId, userId)
  await useChannelsStore().fetchMembers(channelId)
}

export async function addMember(user, channelId) {
  if (!channelId) throw new Error('A channel ID is required to add a member.')
  await addChannelMember(channelId, user.id)
  await useChannelsStore().fetchMembers(channelId)
}
export async function getWebhookUrl(channelId) {
  await wait(100)
  return `https://app.whistleit.io/api/webhooks/${channelId}`
}
export async function leaveChannel() {
  await wait()
}
