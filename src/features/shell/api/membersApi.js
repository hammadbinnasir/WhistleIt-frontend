import { apiRequest } from '@/lib/api/client'

// ── Mock gate ────────────────────────────────────────────
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

async function withMock(mockFn, apiFn) {
  if (USE_MOCKS) return mockFn()
  try {
    return await apiFn()
  } catch (err) {
    console.warn('Members API request failed; falling back to mock data:', err)
    return mockFn()
  }
}

// ── Live API calls ───────────────────────────────────────

export function getMembers(teamId) {
  return withMock(
    () => import('./__mocks__/members.mock').then((m) => m.mockGetMembers(teamId)),
    () => apiRequest(`/teams/${teamId}/members`),
  )
}

export function addMember(teamId, userId) {
  return withMock(
    () => import('./__mocks__/members.mock').then((m) => m.mockAddMember(teamId, userId)),
    () =>
      apiRequest(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
  )
}

export function removeMember(teamId, userId) {
  return withMock(
    () => import('./__mocks__/members.mock').then((m) => m.mockRemoveMember(teamId, userId)),
    () => apiRequest(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  )
}

export function searchUsers(query) {
  return withMock(
    () => import('./__mocks__/members.mock').then((m) => m.mockSearchUsers(query)),
    () => apiRequest(`/users/search?q=${encodeURIComponent(query)}`),
  )
}
