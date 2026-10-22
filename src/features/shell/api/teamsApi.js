import { apiRequest } from '@/lib/api/client'

// ── Mock gate ────────────────────────────────────────────
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

async function withMock(mockFn, apiFn) {
  if (USE_MOCKS) return mockFn()
  return apiFn()
}

// ── Live API calls ───────────────────────────────────────

export function getTeams() {
  return withMock(
    () => import('./__mocks__/teams.mock').then((m) => m.mockTeams()),
    () => apiRequest('/teams'),
  )
}

export function createTeam(payload) {
  return withMock(
    () =>
      import('./__mocks__/teams.mock').then((m) => m.mockCreateTeam(payload)),
    () => apiRequest('/teams', { method: 'POST', body: JSON.stringify(payload) }),
  )
}

export function joinTeam(teamId) {
  return withMock(
    () => import('./__mocks__/teams.mock').then((m) => m.mockJoinTeam(teamId)),
    () => apiRequest(`/teams/${teamId}/join`, { method: 'POST' }),
  )
}

export function searchTeams(query) {
  return withMock(
    () =>
      import('./__mocks__/teams.mock').then((m) => m.mockSearchTeams(query)),
    () => apiRequest(`/teams/search?q=${encodeURIComponent(query)}`),
  )
}
