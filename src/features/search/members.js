import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

export async function listMembers() {
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

export async function removeMember(userId) {
  const teamsStore = useTeamsStore()
  const membersStore = useMembersStore()
  await membersStore.removeMember(
    teamsStore.activeWorkspaceId,
    teamsStore.activeTeamId,
    userId,
  )
}

export async function addMember(user) {
  const teamsStore = useTeamsStore()
  const membersStore = useMembersStore()
  await membersStore.addMember(
    teamsStore.activeWorkspaceId,
    teamsStore.activeTeamId,
    user.id,
  )
}
export async function getWebhookUrl(channelId) {
  await wait(100)
  return `https://app.whistleit.io/api/webhooks/${channelId}`
}
export async function leaveChannel() {
  await wait()
}
