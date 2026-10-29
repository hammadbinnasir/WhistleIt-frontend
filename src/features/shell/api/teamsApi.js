import { apiRequest } from '@/lib/api/client'

// ── Mock gate ────────────────────────────────────────────
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

async function withMock(mockFn, apiFn) {
  if (USE_MOCKS) return mockFn()
  try {
    return await apiFn()
  } catch (err) {
    console.warn('Teams API request failed; falling back to mock data:', err)
    return mockFn()
  }
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
    () => import('./__mocks__/teams.mock').then((m) => m.mockCreateTeam(payload)),
    () => apiRequest('/teams', { method: 'POST', body: JSON.stringify(payload) }),
  )
}

export function joinTeam(inviteCode) {
  // TODO: Replace the mock with POST /teams/join using { inviteCode }.
  return import('./__mocks__/teams.mock').then((m) => m.mockJoinTeam(inviteCode))
}

export function searchTeams(query) {
  return withMock(
    () => import('./__mocks__/teams.mock').then((m) => m.mockSearchTeams(query)),
    () => apiRequest(`/teams/search?q=${encodeURIComponent(query)}`),
  )
}
