import { apiRequest } from '@/lib/api/client'
import { USE_SHELL_MOCKS } from './config'
import { getCompanyIdForTeam } from './teamsApi'
import { normalizeDeleteResult, normalizeMembers, normalizeNotMembers } from './normalizers'

function getMembersPath(workspaceId, teamId) {
  const resolvedTeamId = teamId ?? workspaceId
  const companyId = (teamId == null ? null : workspaceId) ?? getCompanyIdForTeam(resolvedTeamId)
  if (!companyId) throw new Error('The workspace for this team is not available.')
  return `/v1/${encodeURIComponent(companyId)}/teams/${encodeURIComponent(resolvedTeamId)}/members`
}

export function getMembers(workspaceId, teamId = null) {
  const resolvedTeamId = teamId ?? workspaceId
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/members.mock').then(async (mock) => {
      const members = await mock.mockGetMembers(resolvedTeamId)
      return members.map((member) => ({
        userId: String(member.id),
        membershipId: String(member.id),
        name: member.name,
        email: member.email,
        role: member.role ?? 'member',
        joinedDate: null,
        status: member.status ?? 'offline',
        ...(member.avatar ? { avatar: member.avatar } : {}),
      }))
    })
  }
  return apiRequest(getMembersPath(workspaceId, teamId)).then(normalizeMembers)
}

export function getNotMembers(workspaceId, teamId) {
  if (USE_SHELL_MOCKS) {
    return Promise.all([import('./__mocks__/members.mock'), getMembers(workspaceId, teamId)]).then(
      ([mock, currentMembers]) =>
        mock.mockSearchUsers('').then((users) =>
          users
            .filter(
              (user) => !currentMembers.some((member) => String(member.userId) === String(user.id)),
            )
            .map((user) => ({
              userId: String(user.id),
              name: user.name,
              ...(user.email ? { email: user.email } : {}),
            })),
        ),
    )
  }
  return apiRequest(
    `${getMembersPath(workspaceId, teamId).replace(/\/members$/, '')}/notmembers`,
  ).then(normalizeNotMembers)
}

function validateUserIds(userIds, minimumCount) {
  if (
    !Array.isArray(userIds) ||
    userIds.length < minimumCount ||
    userIds.some((id) => id == null || String(id).trim() === '')
  ) {
    throw new Error('Select valid users to add to the team.')
  }
}

export async function addMember(workspaceId, teamId, userId) {
  validateUserIds([userId], 1)
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return mock.mockAddMember(teamId, userId)
  }
  const teamPath = getMembersPath(workspaceId, teamId).replace(/\/members$/, '')
  return apiRequest(`${teamPath}/member`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: [userId] }),
  })
}

export async function addMembers(workspaceId, teamId, userIds) {
  validateUserIds(userIds, 2)
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return Promise.all(userIds.map((userId) => mock.mockAddMember(teamId, userId)))
  }
  const teamPath = getMembersPath(workspaceId, teamId).replace(/\/members$/, '')
  return apiRequest(`${teamPath}/multiplemembers`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  })
}

export async function removeMember(workspaceId, teamId, userId) {
  if (userId == null || String(userId).trim() === '') {
    throw new Error('A user ID is required to remove a team member.')
  }
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return mock.mockRemoveMember(teamId, userId)
  }
  return apiRequest(`${getMembersPath(workspaceId, teamId)}/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  }).then(normalizeDeleteResult)
}
