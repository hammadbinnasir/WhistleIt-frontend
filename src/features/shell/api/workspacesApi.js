import { apiRequest } from '@/lib/api/client'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

async function withMockFallback(mockRequest, apiRequestFn) {
  if (USE_MOCKS) return mockRequest()

  try {
    return await apiRequestFn()
  } catch (error) {
    if (error?.status !== 404) throw error
    console.warn('Workspace API endpoint is unavailable; using mock data:', error)
    return mockRequest()
  }
}

export function getWorkspaces() {
  return withMockFallback(
    () => import('./__mocks__/teams.mock').then((mock) => mock.mockWorkspaces()),
    // TODO: Confirm the authenticated user's workspace-list endpoint with the backend.
    () => apiRequest('/workspaces'),
  )
}

export function getWorkspaceTeams(workspaceId) {
  if (!workspaceId) {
    throw new Error('A workspace ID is required to load its teams.')
  }

  return withMockFallback(
    () => import('./__mocks__/teams.mock').then((mock) => mock.mockWorkspaceTeams(workspaceId)),
    // TODO: Confirm the workspace-scoped team-list endpoint with the backend.
    () => apiRequest(`/workspaces/${encodeURIComponent(workspaceId)}/teams`),
  )
}
