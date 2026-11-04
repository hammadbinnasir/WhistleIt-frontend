import { apiRequest } from '@/lib/api/client'
import { USE_SHELL_MOCKS } from './config'
import { getCompanyIdForTeam } from './teamsApi'
import {
  normalizeCompanyMembers,
  normalizeDeleteResult,
  normalizeMembers,
  normalizeNotMembers,
} from './normalizers'

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

export function getCompanyMembers(workspaceId) {
  if (!workspaceId) throw new Error('A workspace ID is required to load its members.')
  if (USE_SHELL_MOCKS) {
    return Promise.reject(new Error('Company member data is not available in the shell mocks.'))
  }
  // No pagination; confirmed by the backend developer.
  return apiRequest(`/company/${encodeURIComponent(workspaceId)}/members`).then(
    normalizeCompanyMembers,
  )
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

export async function getWorkspaceMembers(workspaceId) {
  if (!workspaceId) throw new Error('A workspace ID is required to load workspace members.')

  const response = await apiRequest(`/company/${encodeURIComponent(workspaceId)}/members`)
  const preferredKeys = ['members', 'users', 'items', 'results', 'data', 'company_members']

  function findMemberRecords(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return null
    seen.add(value)

    if (Array.isArray(value)) return value

    for (const key of preferredKeys) {
      if (!(key in value)) continue
      const records = findMemberRecords(value[key], seen)
      if (Array.isArray(records)) return records
    }

    for (const nested of Object.values(value)) {
      if (typeof nested !== 'object' || nested === null) continue
      const records = findMemberRecords(nested, seen)
      if (records?.length) return records
    }
    return []
  }

  const records = findMemberRecords(response) ?? []

  return records.map((record) => {
    const user = record?.user && typeof record.user === 'object' ? record.user : record
    const id = user.id ?? user.user_id ?? record.user_id ?? record.id
    if (id == null) return null

    const profileName =
      user.name ??
      user.full_name ??
      user.fullName ??
      [user.first_name, user.last_name].filter(Boolean).join(' ')
    const name = profileName || record.name
    return {
      id: String(id),
      name: String(name || user.email || record.email || 'User'),
      email: String(user.email ?? record.email ?? ''),
      avatar: String(user.avatar ?? user.avatar_url ?? record.avatar ?? ''),
      role: String(record.role ?? user.role ?? 'member'),
      status: String(user.status ?? record.status ?? 'offline'),
    }
  }).filter(Boolean)
}
