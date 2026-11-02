import { apiRequest } from '@/lib/api/client'
import { USE_SHELL_MOCKS } from './config'
import { normalizeWorkspaces } from './normalizers'
import { getTeams } from './teamsApi'

export function getWorkspaces() {
  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock').then((mock) => mock.mockWorkspaces())
  }
  return apiRequest('/company').then(normalizeWorkspaces)
}

export function createWorkspace(payload) {
  // TODO: Replace with the workspace creation endpoint when the backend contract is available.
  return import('./__mocks__/teams.mock').then((mock) => mock.mockCreateWorkspace(payload))
}

export function getWorkspaceTeams(workspaceId) {
  if (!workspaceId) {
    throw new Error('A workspace ID is required to load its teams.')
  }

  if (USE_SHELL_MOCKS) {
    return import('./__mocks__/teams.mock').then((mock) => mock.mockWorkspaceTeams(workspaceId))
  }
  return getTeams(workspaceId)
}
