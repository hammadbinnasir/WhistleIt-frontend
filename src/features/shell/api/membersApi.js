import { apiRequest } from '@/lib/api/client'
import { USE_SHELL_MOCKS } from './config'
import { getCompanyIdForTeam } from './teamsApi'
import { normalizeDeleteResult, normalizeMembers } from './normalizers'

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

export async function addMember(workspaceId, teamId, userIds) {
  const ids = Array.isArray(userIds) ? userIds : [userIds]
  if (!ids.length || ids.some((id) => id == null || String(id).trim() === '')) {
    throw new Error('At least one valid user ID is required.')
  }
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return Promise.all(ids.map((userId) => mock.mockAddMember(teamId, userId)))
  }
  return apiRequest(getMembersPath(workspaceId, teamId), {
    method: 'POST',
    body: JSON.stringify({ user_ids: ids }),
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

export async function searchUsers(query, workspaceId = null) {
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return mock.mockSearchUsers(query)
  }

  const normalizedQuery = String(query ?? '').trim()
  const encodedQuery = encodeURIComponent(normalizedQuery)
  const path = workspaceId
    ? `/v1/${encodeURIComponent(workspaceId)}/users?search=${encodedQuery}`
    : `/v1/users?search=${encodedQuery}`

  const response = await apiRequest(path)
  const data = response?.data ?? response
  const records = data?.users ?? data?.members ?? (Array.isArray(data) ? data : [])

  return records.map((record) => {
    const user = record.user && typeof record.user === 'object' ? record.user : record
    const id = user.id ?? user.user_id ?? record.id
    const name = user.name ?? user.full_name ?? user.fullName ?? ''
    const email = user.email ?? record.email ?? ''
    if (id == null) return null
    return {
      id: String(id),
      name: String(name || email || 'User'),
      email: String(email),
      avatar: user.avatar ?? user.avatar_url ?? record.avatar ?? '',
    }
  }).filter(Boolean)
}
