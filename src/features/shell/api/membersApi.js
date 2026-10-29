import { apiRequest } from '@/lib/api/client'
import { USE_SHELL_MOCKS } from './config'
import { getCompanyIdForTeam } from './teamsApi'
import { normalizeMembers } from './normalizers'

function getMembersPath(teamId) {
  const companyId = getCompanyIdForTeam(teamId)
  if (!companyId) throw new Error('The workspace for this team is not available.')
  return `/v1/${encodeURIComponent(companyId)}/teams/${encodeURIComponent(teamId)}/members`
}

export function getMembers(teamId) {
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/members.mock').then((mock) => mock.mockGetMembers(teamId))
  }
  return apiRequest(getMembersPath(teamId)).then(normalizeMembers)
}

export async function addMember(teamId, userId) {
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return mock.mockAddMember(teamId, userId)
  }
  // TODO: Confirm which members response field contains the target user ID.
  // TODO: Confirm the required POST /members body field.
  throw new Error('Adding members is not available yet.')
}

export async function removeMember(teamId, userId) {
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return mock.mockRemoveMember(teamId, userId)
  }
  // TODO: Confirm whether DELETE /members/{targetuser} expects a user ID or membership ID.
  throw new Error('Removing members is not available yet.')
}

export async function searchUsers(query) {
  if (USE_SHELL_MOCKS) {
    const mock = await import('./__mocks__/members.mock')
    return mock.mockSearchUsers(query)
  }
  throw new Error('User search is not available yet.')
}
